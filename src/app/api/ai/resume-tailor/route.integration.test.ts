import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import type { ResumeContent } from "@/lib/types";
import { sampleResumeVersions } from "@/lib/sample-data";
import { tailorResumeWithAI } from "@/lib/ai-service";

vi.mock("@/lib/ai-service", () => ({ tailorResumeWithAI: vi.fn() }));

const model = vi.mocked(tailorResumeWithAI);
const original = sampleResumeVersions[0].content;
const meta = { company: "示例公司", title: "软件工程师", keywords: [], changes: [], summary: "优化", versionName: "定制" };
const jd = "负责产品开发及测试";
const directory = mkdtempSync(join(tmpdir(), "lujie-tailoring-"));
const url = "file:" + join(directory, "test.db").replaceAll("\\", "/");
const db = new PrismaClient({ datasourceUrl: url });
const singleton = globalThis as { prisma?: PrismaClient };
const previous = singleton.prisma;
let post: typeof import("./route").POST;
let agentTailor: typeof import("@/lib/agent/workflow-tools").createJdTailoredResume;
let deleteJobWithApplications: typeof import("@/lib/repository").deleteJobWithApplications;
let sourceId: string;
let familyId: string;

beforeAll(async () => {
  writeFileSync(join(directory, "test.db"), "");
  const migration = spawnSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url }, encoding: "utf8",
  });
  if (migration.status !== 0) throw new Error(migration.stderr || migration.stdout);
  singleton.prisma = db;
  ({ POST: post } = await import("./route"));
  ({ createJdTailoredResume: agentTailor } = await import("@/lib/agent/workflow-tools"));
  ({ deleteJobWithApplications } = await import("@/lib/repository"));
}, 30_000);

afterAll(async () => {
  singleton.prisma = previous;
  await db.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  model.mockReset();
  const family = await db.resume.create({ data: { name: "测试原件" } });
  familyId = family.id;
  sourceId = (await db.resumeVersion.create({ data: { name: "原件", summary: "", resumeId: family.id, content: original } })).id;
});

function request(body: Record<string, unknown>) {
  return post(new Request("http://localhost/api/ai/resume-tailor", { method: "POST", body: JSON.stringify({ jd, ...body }) }));
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function holdModel() {
  const started = deferred();
  const release = deferred();
  model.mockImplementationOnce(async ({ resume }) => {
    started.resolve();
    await release.promise;
    return { source: "ai", data: { ...resume, selfReview: "已优化" }, meta, message: "ok" };
  });
  return { started: started.promise, release: release.resolve };
}

it("keeps the generation-time source when a concurrent edit finishes before saving", async () => {
  const supplied = { ...original, selfReview: "编辑器当前文本" };
  const modelCall = holdModel();
  const pending = request({ resumeVersionId: sourceId, resumeContent: supplied });
  await modelCall.started;
  await db.resumeVersion.update({ where: { id: sourceId }, data: { content: { ...original, selfReview: "另一个窗口" } } });
  modelCall.release();
  const response = await pending;
  expect(response.status).toBe(200);
  const { version, job } = await response.json();
  expect(version.resumeId).toBe(familyId);
  expect(version.jobId).toBe(job.id);
  expect(version.content._tailoringBaseResume).toEqual(model.mock.calls[0][0].resume);
  expect(version.content._tailoringBaseResume.selfReview).toBe(supplied.selfReview);
  expect((await db.resumeVersion.findUniqueOrThrow({ where: { id: sourceId } })).content).toMatchObject({ selfReview: "另一个窗口" });
});

it.each(["page", "agent"])("rolls back the %s workflow if the selected source is deleted during generation", async (entry) => {
  const jobs = await db.job.count();
  const versionCount = await db.resumeVersion.count();
  const modelCall = holdModel();
  const pending = entry === "page" ? request({ resumeVersionId: sourceId })
    : agentTailor({ resumeVersionId: sourceId, jd, company: meta.company, title: meta.title }, {} as never);
  await modelCall.started;
  await db.resumeVersion.update({ where: { id: sourceId }, data: { deletedAt: new Date() } });
  modelCall.release();
  if (entry === "page") expect((await pending as Response).status).toBe(404);
  else await expect(pending).rejects.toThrow("找不到所选简历版本");
  expect(await db.job.count()).toBe(jobs);
  expect(await db.resumeVersion.count()).toBe(versionCount);
});

it("keeps explicit job and application ownership when another posting shares the JD", async () => {
  const posting = { jd, city: "", source: "测试", link: "" };
  const selected = await db.job.create({ data: { ...posting, company: "甲公司", title: "目标开发岗" } });
  const other = await db.job.create({ data: { ...posting, company: "乙公司", title: "测试岗" } });
  const application = await db.application.create({ data: { jobId: selected.id } });
  const foreignApplication = await db.application.create({ data: { jobId: other.id } });
  model.mockResolvedValue({ source: "ai", data: original, meta, message: "ok" });

  const rejected = await request({ resumeVersionId: sourceId, jobId: selected.id, applicationId: foreignApplication.id });
  expect(rejected.status).toBe(400);
  const response = await request({ resumeVersionId: sourceId, jobId: selected.id, applicationId: application.id });
  expect(response.status).toBe(200);
  const saved = await response.json();
  expect(saved.job).toMatchObject({ id: selected.id, company: selected.company });
  expect(saved.analysis).toMatchObject({ company: selected.company, title: selected.title });
  expect(saved.version.jobId).toBe(selected.id);
  expect(await db.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({ resumeVersionId: saved.version.id });
  expect(await db.application.findUniqueOrThrow({ where: { id: foreignApplication.id } })).toMatchObject({ resumeVersionId: null });
});

it.each(["page", "agent"])("does not reopen an explicitly selected job archived during %s generation", async (entry) => {
  const job = await db.job.create({ data: { company: "待归档公司", title: "开发岗", jd, city: "", source: "测试", link: "" } });
  const modelCall = holdModel();
  const pending = entry === "page" ? request({ resumeVersionId: sourceId, jobId: job.id })
    : agentTailor({ resumeVersionId: sourceId, jobId: job.id }, {} as never);
  await modelCall.started;
  await deleteJobWithApplications(job.id);
  modelCall.release();
  if (entry === "page") expect((await pending as Response).status).toBe(409);
  else await expect(pending).rejects.toThrow("目标岗位的 JD 已变更");
  expect(await db.resumeVersion.count({ where: { jobId: job.id } })).toBe(0);
  expect(await db.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ jd: "", analysis: null });
});

it("keeps uploaded sources and target jobs atomic when a later validation fails", async () => {
  const counts = () => Promise.all([db.resume.count(), db.resumeVersion.count(), db.job.count()]);
  const before = await counts();
  model.mockResolvedValue({ source: "ai", data: original, meta, message: "ok" });
  const failed = await request({ resumeContent: original, applicationId: "missing" });
  expect(failed.status).toBe(400);
  expect(await counts()).toEqual(before);
  const saved = await request({ resumeContent: original });
  expect(saved.status).toBe(200);
  const { version } = await saved.json();
  const versions = await db.resumeVersion.findMany({ where: { resumeId: version.resumeId } });
  expect(versions).toHaveLength(2);
  const base = versions.find((item) => !item.jobId)!.content as ResumeContent;
  expect(base).toEqual(version.content._tailoringBaseResume);
});
