import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

let db: PrismaClient;
let active: PrismaClient;
let repo: typeof import("./repository");
let trash: typeof import("./trash");
const previousUrl = process.env.DATABASE_URL;
beforeAll(async () => {
  const directory = mkdtempSync(join(tmpdir(), "lujie-trash-"));
  const file = join(directory, "test.db");
  writeFileSync(file, "");
  process.env.DATABASE_URL = `file:${file.replaceAll("\\", "/")}`;
  const migration = spawnSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: process.env, encoding: "utf8" });
  if (migration.status !== 0) throw new Error(migration.stderr || migration.stdout);
  delete (globalThis as { prisma?: PrismaClient }).prisma;
  vi.resetModules();
  ({ database: db, prisma: active } = await import("./db"));
  repo = await import("./repository");
  trash = await import("./trash");
}, 30_000);
beforeEach(async () => {
  await db.trashSnapshot.deleteMany();
  await repo.resetAppDataToSample();
});
afterAll(async () => {
  await db?.$disconnect();
  delete (globalThis as { prisma?: PrismaClient }).prisma;
  if (previousUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousUrl;
});

async function fixture() {
  const base = await db.resumeVersion.findFirstOrThrow({ where: { jobId: null } });
  const application = await db.application.findFirstOrThrow({ where: { resumeVersionId: { not: null } } });
  const optimized = await db.resumeVersion.findUniqueOrThrow({ where: { id: application.resumeVersionId! } });
  await repo.updateResumeVersion({ versionId: optimized.id, content: { ...optimized.content as object, marker: "hours of manual editing" } as never });
  return { base, application, optimized };
}

it("returns a recoverable application conflict without overwriting notes or progress", async () => {
  const { application } = await fixture();
  await db.application.update({ where: { id: application.id }, data: { notes: "keep my interview notes", status: "INTERVIEW" } });
  await repo.deleteApplication(application.id);
  const { POST } = await import("@/app/api/applications/route");
  const response = await POST(new Request("http://localhost/api/applications", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: application.jobId, notes: "must not overwrite", status: "APPLIED" }),
  }));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "APPLICATION_IN_TRASH", applicationId: application.id });
  expect(await active.application.findUnique({ where: { id: application.id } })).toBeNull();
  await trash.restoreTrash("application", application.id);
  expect(await active.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({ notes: "keep my interview notes", status: "INTERVIEW", resumeVersionId: application.resumeVersionId });
});

it("keeps every resume under its own ID regardless of which one was saved last", async () => {
  const { base, optimized } = await fixture();
  const before = await repo.getAppData();
  expect(before.versions.map((item) => item.id)).toEqual(expect.arrayContaining([base.id, optimized.id]));
  await repo.updateResumeVersion({ versionId: base.id, content: base.content as never });
  const after = await repo.getAppData();
  expect(after.versions.map((item) => item.id).sort()).toEqual(before.versions.map((item) => item.id).sort());
  expect(after).not.toHaveProperty("resume");
});

it("deleting the original through the API preserves edited descendants and links", async () => {
  const { base, optimized, application } = await fixture();
  const { DELETE } = await import("@/app/api/resume-versions/[id]/route");
  const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: base.id }) });
  expect((await response.json()).deletedIds).toEqual([base.id]);
  expect(await active.resumeVersion.findUnique({ where: { id: base.id } })).toBeNull();
  expect((await active.resumeVersion.findUniqueOrThrow({ where: { id: optimized.id } })).content).toHaveProperty("marker", "hours of manual editing");
  expect((await active.application.findUniqueOrThrow({ where: { id: application.id } })).resumeVersionId).toBe(optimized.id);
  await trash.restoreTrash("resumeVersion", base.id);
  expect((await active.resumeVersion.findUniqueOrThrow({ where: { id: base.id } })).content).toEqual(base.content);
});

it("restores linked records in either order with their original identity and associations", async () => {
  const { optimized, application } = await fixture();
  for (const first of ["application", "resumeVersion"] as const) {
    await repo.deleteResumeVersion(optimized.id);
    await repo.deleteApplication(application.id);
    await trash.restoreTrash(first, first === "application" ? application.id : optimized.id);
    const second = first === "application" ? "resumeVersion" : "application";
    await trash.restoreTrash(second, second === "application" ? application.id : optimized.id);
    expect((await active.application.findUniqueOrThrow({ where: { id: application.id } })).resumeVersionId).toBe(optimized.id);
    expect(await active.resumeVersion.findUnique({ where: { id: optimized.id } })).not.toBeNull();
  }
});

it("blocks late saves and removes trashed work from app data", async () => {
  const { optimized } = await fixture();
  await repo.deleteResumeVersion(optimized.id);
  await expect(repo.updateResumeVersion({ versionId: optimized.id, content: optimized.content as never })).rejects.toThrow();
  expect((await repo.getAppData()).versions.some((item) => item.id === optimized.id)).toBe(false);
  expect((await trash.listTrash()).some((item) => item.id === optimized.id)).toBe(true);
});

it("job material removal preserves resumes, applications, and interviews", async () => {
  const { optimized, application } = await fixture();
  const before = await db.job.findUniqueOrThrow({ where: { id: application.jobId } });
  const sessions = await active.interviewSession.count();
  const preparations = await active.interviewPreparation.count();
  await repo.clearJobAnalysis(application.jobId);
  expect(await active.resumeVersion.findUnique({ where: { id: optimized.id } })).not.toBeNull();
  expect(await active.application.findUnique({ where: { id: application.id } })).not.toBeNull();
  expect(await active.interviewSession.count()).toBe(sessions);
  expect(await active.interviewPreparation.count()).toBe(preparations);
  const snapshot = await db.trashSnapshot.findFirstOrThrow();
  await trash.restoreTrash("snapshot", snapshot.id);
  expect((await db.job.findUniqueOrThrow({ where: { id: before.id } })).jd).toBe(before.jd);
});

it("moves a whole role archive and restores it without overwriting newer material", async () => {
  const { base, optimized, application } = await fixture();
  const job = await db.job.findUniqueOrThrow({ where: { id: application.jobId } });
  const prep = await db.interviewPreparation.findFirstOrThrow({ where: { jobId: job.id } });
  const session = await db.interviewSession.findFirstOrThrow({ where: { jobId: job.id } });
  await db.interviewPreparation.update({ where: { id: prep.id }, data: { jobId: null, resumeVersionId: optimized.id } });
  await repo.deleteInterviewSessionSection(session.id, "questions");
  const other = await db.application.findFirstOrThrow({ where: { jobId: { not: job.id } } });
  const unrelatedSession = await db.interviewSession.create({ data: {
    context: { company: "Other company", title: "Other role", jd: job.jd }, questions: [], answers: {}, feedback: {},
  } });
  const counts = await repo.deleteJobWithApplications(job.id);
  expect(counts).toEqual({ interviewPreparations: 1, interviews: 1, applications: 1, resumeVersions: 1 });
  expect(await repo.deleteJobWithApplications(job.id)).toEqual({ interviewPreparations: 0, interviews: 0, applications: 0, resumeVersions: 0 });
  expect(await active.resumeVersion.findUnique({ where: { id: base.id } })).not.toBeNull();
  expect(await active.application.findUnique({ where: { id: other.id } })).not.toBeNull();
  expect(await active.interviewSession.findUnique({ where: { id: unrelatedSession.id } })).not.toBeNull();
  expect(await active.application.findUnique({ where: { id: application.id } })).toBeNull();
  await repo.updateJobDescription(job.id, "new content");
  const { POST } = await import("@/app/api/trash/route");
  const response = await POST(new Request("http://localhost/api/trash", { method: "POST", body: JSON.stringify({ action: "restoreAll" }) }));
  expect(response.status).toBe(200);
  expect((await response.json()).items).toMatchObject([{ kind: "snapshot", section: "job-analysis" }]);
  expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).jd).toBe("new content");
  expect((await active.interviewSession.findUniqueOrThrow({ where: { id: session.id } })).questions).toEqual(session.questions);
  expect(await active.interviewPreparation.findUnique({ where: { id: prep.id } })).not.toBeNull();
  expect((await active.application.findUniqueOrThrow({ where: { id: application.id } })).resumeVersionId).toBe(optimized.id);
});

it("refuses to overwrite new job content and keeps the recovery copy", async () => {
  const job = await db.job.findFirstOrThrow();
  await repo.clearJobAnalysis(job.id);
  const snapshot = await db.trashSnapshot.findFirstOrThrow();
  await repo.updateJobDescription(job.id, "new content");
  await expect(trash.restoreTrash("snapshot", snapshot.id)).rejects.toThrow("覆盖");
  expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).jd).toBe("new content");
  expect(await db.trashSnapshot.findUnique({ where: { id: snapshot.id } })).not.toBeNull();
});

it("recovers partial interview answers and blocks progress writes to trashed sessions", async () => {
  const session = await db.interviewSession.findFirstOrThrow();
  await repo.deleteInterviewSessionSection(session.id, "questions");
  const snapshot = await db.trashSnapshot.findFirstOrThrow();
  await trash.restoreTrash("snapshot", snapshot.id);
  expect((await db.interviewSession.findUniqueOrThrow({ where: { id: session.id } })).answers).toEqual(session.answers);
  await repo.interviewSessionRepository.deleteSession(session.id);
  await expect(repo.interviewSessionRepository.saveProgress(session.id, { currentQuestionIndex: 0 })).rejects.toThrow();
  await trash.restoreTrash("interviewSession", session.id);
  expect(await active.interviewSession.findUnique({ where: { id: session.id } })).not.toBeNull();
});

it("bulk removal is recoverable; permanent deletion only affects trash", async () => {
  const { base, optimized } = await fixture();
  await repo.deleteOptimizedResumeVersions();
  expect(await active.resumeVersion.findUnique({ where: { id: optimized.id } })).toBeNull();
  await trash.permanentlyDeleteTrash("resumeVersion", base.id);
  expect(await active.resumeVersion.findUnique({ where: { id: base.id } })).not.toBeNull();
  await trash.permanentlyDeleteTrash("resumeVersion", optimized.id);
  expect(await db.resumeVersion.findUnique({ where: { id: optimized.id } })).toBeNull();
  expect(await active.resumeVersion.findUnique({ where: { id: base.id } })).not.toBeNull();
});

it("recovers preparations and conversations; emptying trash leaves active work", async () => {
  const preparation = await db.interviewPreparation.findFirstOrThrow();
  const { createAgentThread, deleteAgentThread, getAgentThread } = await import("./agent/thread-store");
  const thread = await createAgentThread("test conversation");
  await repo.deleteInterviewPreparationRecord(preparation.id);
  await deleteAgentThread(thread.id);
  expect(await getAgentThread(thread.id)).toBeNull();
  await trash.restoreTrash("agentThread", thread.id);
  expect(await getAgentThread(thread.id)).not.toBeNull();
  await trash.restoreTrash("interviewPreparation", preparation.id);
  expect(await active.interviewPreparation.findUnique({ where: { id: preparation.id } })).not.toBeNull();
  await repo.clearInterviewPreparationRecords();
  await trash.permanentlyDeleteTrash();
  expect(await trash.listTrash()).toEqual([]);
  expect(await getAgentThread(thread.id)).not.toBeNull();
  expect(await active.resumeVersion.count()).toBeGreaterThan(0);
});

it("requires explicit confirmation for permanent deletion via the API", async () => {
  const { POST } = await import("@/app/api/trash/route");
  const response = await POST(new Request("http://localhost/api/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "empty" }) }));
  expect(response.status).toBe(400);
});

it("clears the workspace recoverably, preserving settings and earlier trash", async () => {
  const { base, optimized } = await fixture();
  await repo.deleteResumeVersion(base.id);
  const settings = await db.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  await trash.moveWorkspaceToTrash();
  const data = await repo.getAppData();
  expect(data.versions).toEqual([]);
  expect(data.applications).toEqual([]);
  expect(data.interviews).toEqual([]);
  expect(data.interviewPreparations).toEqual([]);
  expect(data.jobs.every((job) => !job.jd && !job.analysis)).toBe(true);
  expect((await db.settings.findUniqueOrThrow({ where: { id: "singleton" } })).aiApiKey).toBe(settings.aiApiKey);
  await trash.restoreTrash("resumeVersion", base.id);
  await trash.restoreTrash("resumeVersion", optimized.id);
  expect(await active.resumeVersion.count()).toBe(2);
});

it("rolls back partial removal if saving the recovery snapshot fails", async () => {
  const job = await db.job.findFirstOrThrow();
  await db.$executeRawUnsafe("CREATE TRIGGER fail_trash BEFORE INSERT ON TrashSnapshot BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  try {
    await expect(repo.clearJobAnalysis(job.id)).rejects.toThrow();
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).jd).toBe(job.jd);
  } finally {
    await db.$executeRawUnsafe("DROP TRIGGER fail_trash");
  }
});

it("resets through the API repeatedly without overwriting earlier trash and clears fresh samples", async () => {
  const { base, optimized } = await fixture();
  const saved = await db.resumeVersion.findUniqueOrThrow({ where: { id: optimized.id } });
  const settings = await db.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  const { POST } = await import("@/app/api/settings/reset-data/route");
  let previousIds = [base.id, optimized.id];
  for (let round = 0; round < 2; round++) {
    const response = await POST();
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.versions).toHaveLength(2);
    expect(data.versions.every((item: { id: string }) => !previousIds.includes(item.id))).toBe(true);
    expect(data.applications.length).toBeGreaterThan(0);
    expect(data.interviews).toHaveLength(1);
    expect(data.interviewPreparations).toHaveLength(1);
    previousIds = data.versions.map((item: { id: string }) => item.id);
  }
  expect((await db.resumeVersion.findUniqueOrThrow({ where: { id: optimized.id } })).content).toEqual(saved.content);
  expect((await db.settings.findUniqueOrThrow({ where: { id: "singleton" } })).aiApiKey).toBe(settings.aiApiKey);
  await repo.clearSampleData();
  expect((await repo.getAppData()).versions).toEqual([]);
  await trash.restoreTrash("resumeVersion", optimized.id);
  expect((await active.resumeVersion.findUniqueOrThrow({ where: { id: optimized.id } })).content).toEqual(saved.content);
});

it("rolls back the entire reset when creating fresh samples fails", async () => {
  const before = await repo.getAppData();
  await db.$executeRawUnsafe("CREATE TRIGGER fail_seed BEFORE INSERT ON ResumeVersion BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  try {
    await expect(repo.moveWorkspaceToTrashAndRestoreSamples()).rejects.toThrow();
    expect(await repo.getAppData()).toEqual(before);
    expect(await trash.listTrash()).toEqual([]);
  } finally {
    await db.$executeRawUnsafe("DROP TRIGGER fail_seed");
  }
});
