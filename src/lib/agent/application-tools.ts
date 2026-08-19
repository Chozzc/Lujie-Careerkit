import { z } from "zod";

import { dateInputSchema } from "@/lib/api-request";
import {
  createApplication,
  createJob,
  getAppData,
  updateApplication,
} from "@/lib/repository";
import type { ApplicationStatus, InterviewRound } from "@/lib/types";

const optionalDateSchema = dateInputSchema.nullable().optional();

export const applicationChangeSchema = z.object({
  action: z.enum(["create", "update"]),
  applicationId: z.string().trim().min(1).optional(),
  jobId: z.string().trim().min(1).optional(),
  company: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"]).optional(),
  interviewRound: z.enum(["", "FIRST", "SECOND", "THIRD", "HR"]).optional(),
  stageDate: optionalDateSchema,
  nextFollowUpAt: optionalDateSchema,
  notesToAppend: z.string().trim().max(2_000).optional(),
  city: z.string().trim().max(120).optional(),
  source: z.string().trim().max(120).optional(),
  link: z.string().trim().url().max(2_000).optional(),
  jd: z.string().trim().max(30_000).optional(),
}).superRefine((input, context) => {
  if (input.action === "update" && !input.applicationId) {
    context.addIssue({ code: "custom", path: ["applicationId"], message: "更新投递卡片时必须提供 applicationId。" });
  }
  if (input.action === "create" && !input.jobId && (!input.company || !input.title)) {
    context.addIssue({ code: "custom", path: ["company"], message: "新建投递卡片需要 jobId，或者同时提供公司和岗位。" });
  }
  if (
    input.action === "update" &&
    input.status === undefined &&
    input.stageDate === undefined &&
    input.nextFollowUpAt === undefined &&
    input.interviewRound === undefined &&
    !input.notesToAppend
  ) {
    context.addIssue({ code: "custom", message: "没有可更新的投递信息。" });
  }
});

export type ApplicationChangeInput = z.infer<typeof applicationChangeSchema>;

export async function searchApplicationContext(query: string) {
  const data = await getAppData();
  const normalizedQuery = normalizeSearchText(query);

  return data.jobs
    .map((job) => ({
      job,
      application: data.applications.find((application) => application.jobId === job.id) ?? null,
    }))
    .filter(({ job, application }) => {
      if (!normalizedQuery) return true;
      const searchable = normalizeSearchText([
        job.company,
        job.title,
        job.city,
        job.source,
        job.jd,
        application?.notes ?? "",
      ].join(" "));
      return searchable.includes(normalizedQuery);
    })
    .slice(0, 8)
    .map(({ job, application }) => ({
      job: {
        id: job.id,
        company: job.company,
        title: job.title,
        city: job.city,
        source: job.source,
        deadline: job.deadline,
        jdExcerpt: job.jd.slice(0, 1_200),
        analysis: job.analysis,
      },
      application,
    }));
}

export async function getResumeContext() {
  const data = await getAppData();
  const versions = [
    ...(data.resume ? [{
      id: data.resume.id,
      name: data.resume.name,
      summary: data.resume.summary,
      content: data.resume.content,
      jobId: null,
    }] : []),
    ...data.versions,
  ];

  return versions.slice(0, 10).map((version) => ({
    id: version.id,
    jobId: version.jobId,
    name: version.name,
    summary: version.summary,
    profileTitle: version.content.profile.title,
    skills: version.content.skills.slice(0, 30),
    experiences: [
      ...version.content.experiences.map((item) => ({ company: item.company, role: item.role })),
      ...version.content.internships.map((item) => ({ company: item.company, role: item.role })),
      ...version.content.projects.map((item) => ({ company: item.name, role: item.role })),
    ].slice(0, 20),
  }));
}

export async function applyApplicationChange(input: ApplicationChangeInput) {
  const current = await getAppData();

  if (input.action === "update") {
    const existing = current.applications.find((application) => application.id === input.applicationId);
    if (!existing) throw new Error("找不到要更新的投递卡片。");

    await updateApplication({
      id: existing.id,
      status: input.status as ApplicationStatus | undefined,
      stageDate: input.stageDate,
      nextFollowUpAt: input.nextFollowUpAt,
      interviewRound: input.interviewRound as InterviewRound | undefined,
      notes: appendNote(existing.notes, input.notesToAppend),
    });
    return readApplicationChangeResult(existing.jobId, existing.id, "updated");
  }

  let job = input.jobId ? current.jobs.find((item) => item.id === input.jobId) : undefined;
  if (!job && input.company && input.title) {
    const identity = jobIdentity(input.company, input.title);
    job = current.jobs.find((item) => jobIdentity(item.company, item.title) === identity);
  }
  if (!job) {
    const company = input.company?.trim();
    const title = input.title?.trim();
    if (!company || !title) throw new Error("新建投递卡片前需要公司和岗位名称。");
    const created = await createJob({
      company,
      title,
      city: input.city || "待填写",
      source: input.source || "手动录入",
      link: input.link || "",
      jd: input.jd || `${company} ${title}，暂未补充完整 JD。`,
    });
    job = (await getAppData()).jobs.find((item) => item.id === created.id);
  }
  if (!job) throw new Error("岗位创建失败。");

  const existing = current.applications.find((application) => application.jobId === job.id);
  if (existing) throw new Error("该岗位已有投递卡片，请更新原卡片。");

  const application = await createApplication({
    jobId: job.id,
    status: (input.status ?? "APPLIED") as ApplicationStatus,
    stageDate: input.stageDate,
    nextFollowUpAt: input.nextFollowUpAt,
    interviewRound: input.interviewRound as InterviewRound | undefined,
    notes: input.notesToAppend || "由录阶 Agent 创建。",
  });
  return readApplicationChangeResult(job.id, application.id, "created");
}

async function readApplicationChangeResult(jobId: string, applicationId: string, operation: "created" | "updated") {
  const data = await getAppData();
  const job = data.jobs.find((item) => item.id === jobId);
  const application = data.applications.find((item) => item.id === applicationId);
  if (!job || !application) throw new Error("投递卡片已写入，但回读失败。");
  return { operation, job, application };
}

function appendNote(existing: string, addition?: string) {
  const next = addition?.trim();
  if (!next || existing.includes(next)) return existing;
  return existing.trim() ? `${existing.trim()}\n${next}` : next;
}

function jobIdentity(company: string, title: string) {
  return `${normalizeSearchText(company)}:${normalizeSearchText(title)}`;
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s·•\-_—–|/\\()[\]{}（）]+/g, "");
}
