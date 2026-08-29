import { z } from "zod";

import { dateInputSchema } from "@/lib/api-request";
import { buildAiResumeSnapshot } from "@/lib/ai/resume-snapshot";
import {
  createApplication,
  createJob,
  getAppData,
  updateApplication,
} from "@/lib/repository";
import type { ApplicationStatus, InterviewRound } from "@/lib/types";

const optionalDateSchema = dateInputSchema.nullable().optional();

export const pipelineSearchSchema = z.object({
  jobId: z.string().trim().min(1).optional().describe("Known Job ID for an exact lookup. Prefer this over text search when available."),
  query: z.string().trim().max(200).default("").describe("Company, role, city, source, or note keywords. Leave empty only when the user asks for recent records."),
  offset: z.number().int().min(0).max(10_000).default(0).describe("Result offset for pagination."),
  limit: z.number().int().min(1).max(20).default(8).describe("Number of records to return, up to 20."),
});

export const resumeContextSchema = z.object({
  resumeVersionId: z.string().trim().min(1).optional().describe("Known resume-version ID for an exact, full privacy-filtered read."),
  query: z.string().trim().max(200).default("").describe("Resume name, target role, skill, school, company, or project keywords."),
  offset: z.number().int().min(0).max(10_000).default(0).describe("Result offset for pagination."),
  limit: z.number().int().min(1).max(20).default(8).describe("Number of resume summaries to return, up to 20."),
});

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
  resumeVersionId: z.string().trim().min(1).nullable().optional(),
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
    input.resumeVersionId === undefined &&
    !input.notesToAppend
  ) {
    context.addIssue({ code: "custom", message: "没有可更新的投递信息。" });
  }
});

export type ApplicationChangeInput = z.infer<typeof applicationChangeSchema>;

export async function searchApplicationContext(input: z.input<typeof pipelineSearchSchema> | string) {
  const data = await getAppData();
  const search = pipelineSearchSchema.parse(typeof input === "string" ? { query: input } : input);
  // ponytail: a local personal library is small enough for cross-field in-memory search; move this behind indexed repository queries if records reach the thousands.

  const records = data.jobs
    .map((job) => ({
      job,
      application: data.applications.find((application) => application.jobId === job.id) ?? null,
    }))
    .filter(({ job, application }) => {
      if (search.jobId) return job.id === search.jobId;
      return matchesSearch([
        job.company,
        job.title,
        job.city,
        job.source,
        job.jd,
        application?.notes ?? "",
      ].join(" "), search.query);
    })
    .sort((left, right) => recordTimestamp(right) - recordTimestamp(left));
  const page = records
    .slice(search.offset, search.offset + search.limit)
    .map(({ job, application }) => ({
      job: {
        id: job.id,
        company: job.company,
        title: job.title,
        city: job.city,
        source: job.source,
        deadline: job.deadline,
        ...(search.jobId ? { jd: job.jd } : { jdExcerpt: job.jd.slice(0, 1_200) }),
        analysis: job.analysis,
        updatedAt: job.updatedAt,
      },
      application,
    }));
  return {
    total: records.length,
    offset: search.offset,
    hasMore: search.offset + page.length < records.length,
    records: page,
  };
}

export async function getResumeContext(input: z.input<typeof resumeContextSchema> = {}) {
  const data = await getAppData();
  const search = resumeContextSchema.parse(input);
  const versions = [
    ...(data.resume ? [{
      id: data.resume.id,
      resumeId: data.resume.resumeId,
      name: data.resume.name,
      summary: data.resume.summary,
      content: data.resume.content,
      jobId: null,
      updatedAt: data.resume.updatedAt,
    }] : []),
    ...data.versions,
  ];

  if (search.resumeVersionId) {
    const version = versions.find((item) => item.id === search.resumeVersionId);
    if (!version) return { resume: null };
    return {
      resume: {
        id: version.id,
        resumeId: version.resumeId,
        jobId: version.jobId,
        name: version.name,
        summary: version.summary,
        updatedAt: version.updatedAt,
        content: buildAiResumeSnapshot(version.content),
      },
    };
  }

  const matches = versions.filter((version) => matchesSearch([
    version.name,
    version.summary,
    version.content.profile.title,
    version.content.basics.city,
    ...version.content.skills,
    ...version.content.education.flatMap((item) => [item.school, item.degree, item.major]),
    ...version.content.experiences.flatMap((item) => [item.company, item.role]),
    ...version.content.internships.flatMap((item) => [item.company, item.role]),
    ...version.content.projects.flatMap((item) => [item.name, item.role]),
  ].join(" "), search.query));
  const page = matches.slice(search.offset, search.offset + search.limit).map((version) => ({
    id: version.id,
    resumeId: version.resumeId,
    jobId: version.jobId,
    name: version.name,
    summary: version.summary,
    updatedAt: version.updatedAt,
    profileTitle: version.content.profile.title,
    skills: version.content.skills.slice(0, 30),
    experiences: [
      ...version.content.experiences.map((item) => ({ company: item.company, role: item.role })),
      ...version.content.internships.map((item) => ({ company: item.company, role: item.role })),
      ...version.content.projects.map((item) => ({ company: item.name, role: item.role })),
    ].slice(0, 20),
  }));
  return {
    total: matches.length,
    offset: search.offset,
    hasMore: search.offset + page.length < matches.length,
    resumes: page,
  };
}

export async function applyApplicationChange(input: ApplicationChangeInput) {
  const current = await getAppData();
  if (input.resumeVersionId && ![current.resume, ...current.versions].some((version) => version?.id === input.resumeVersionId)) {
    throw new Error("找不到要关联的简历，请重新搜索后再试。");
  }

  if (input.action === "update") {
    const existing = current.applications.find((application) => application.id === input.applicationId);
    if (!existing) throw new Error("找不到要更新的投递卡片。");

    await updateApplication({
      id: existing.id,
      status: input.status as ApplicationStatus | undefined,
      stageDate: input.stageDate,
      nextFollowUpAt: input.nextFollowUpAt,
      interviewRound: input.interviewRound as InterviewRound | undefined,
      resumeVersionId: input.resumeVersionId,
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
    resumeVersionId: input.resumeVersionId,
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

function matchesSearch(value: string, query: string) {
  const searchable = normalizeSearchText(value);
  const terms = query
    .normalize("NFKC")
    .toLocaleLowerCase()
    .split(/[\s·•\-_—–|/\\()[\]{}（）]+/)
    .map(normalizeSearchText)
    .filter(Boolean);
  return terms.every((term) => searchable.includes(term));
}

function recordTimestamp(record: { job: { updatedAt: string }; application: { updatedAt: string } | null }) {
  return Math.max(Date.parse(record.job.updatedAt) || 0, Date.parse(record.application?.updatedAt ?? "") || 0);
}
