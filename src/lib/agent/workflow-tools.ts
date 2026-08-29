import { z } from "zod";

import { generateInterviewPreparationWithAI } from "@/lib/ai/interview-preparation-task";
import { generateResumeDraftWithAI } from "@/lib/ai/resume-draft";
import type { EffectiveAiSettings } from "@/lib/ai/settings";
import { tailorResumeWithAI } from "@/lib/ai-service";
import { careerLibraryTargetPath } from "@/lib/career-library";
import { TEMPLATES } from "@/lib/constants";
import { interviewService } from "@/lib/interview-runtime";
import { createInterviewPreparationInputSchema } from "@/lib/interview-preparation";
import { createInterviewSessionInputSchema, interviewModeSchema } from "@/lib/interview";
import { analyzeJobInput } from "@/lib/job-analysis";
import {
  createInterviewPreparationRecord,
  createJob,
  createResumeVersion,
  createTailoredVersionForJob,
  getAppData,
  getTailoringBaseResume,
  updateResumeVersion,
} from "@/lib/repository";
import type { JobAnalysis, ResumeContent, ResumeOptimizationMeta } from "@/lib/types";

export const createResumeFromExperienceSchema = z.object({
  sourceText: z.string().trim().min(20).max(30_000).describe("Only the candidate facts stated by the user. Do not add inferred facts."),
  resumeName: z.string().trim().min(1).max(200).describe("User-facing name for the new independent resume."),
  targetRole: z.string().trim().min(1).max(120).optional().describe("Target role only when the user stated one."),
});

export const matchOptimizationPreferencesSchema = z.object({
  emphasizeImpact: z.boolean(),
  quantifyResults: z.boolean(),
  atsFriendly: z.boolean(),
  highlightMatchedSkills: z.boolean(),
});

export const configureJdOptimizationSchema = z.object({
  jobName: z.string().trim().min(1).max(240),
  resumeName: z.string().trim().min(1).max(200),
  recommended: matchOptimizationPreferencesSchema,
  reason: z.string().trim().min(1).max(240),
});

export const configureJdOptimizationOutputSchema = z.object({
  preferences: matchOptimizationPreferencesSchema,
});

export const configureInterviewSchema = z.object({
  jobName: z.string().trim().min(1).max(240),
  resumeName: z.string().trim().min(1).max(200),
  task: z.enum(["preparation", "simulation"]),
  recommendedMode: interviewModeSchema,
  reason: z.string().trim().min(1).max(240),
});

export const configureInterviewOutputSchema = z.object({
  task: z.enum(["preparation", "simulation"]).optional(),
  mode: interviewModeSchema,
});

export const createJdTailoredResumeSchema = z.object({
  resumeVersionId: z.string().trim().min(1).describe("Exact source resume-version ID returned by get_resume_context."),
  jobId: z.string().trim().min(1).optional().describe("Exact existing Job ID returned by search_pipeline."),
  company: z.string().trim().min(1).max(120).optional().describe("Required with title and JD only when creating a new Job."),
  title: z.string().trim().min(1).max(120).optional().describe("Required with company and JD only when creating a new Job."),
  jd: z.string().trim().min(1).max(50_000).optional().describe("Full JD. Omit only when jobId identifies a Job that already stores the full JD."),
  preferences: matchOptimizationPreferencesSchema.partial().optional(),
}).superRefine((input, context) => {
  if (input.jobId) return;
  for (const key of ["company", "title", "jd"] as const) {
    if (!input[key]) context.addIssue({ code: "custom", path: [key], message: "创建新岗位定制简历时需要公司、岗位和完整 JD。" });
  }
});

export const createInterviewPreparationSchema = z.object({
  jobId: z.string().trim().min(1).describe("Exact existing Job ID returned by search_pipeline."),
  resumeVersionId: z.string().trim().min(1).describe("Exact resume-version ID returned by get_resume_context."),
  focus: z.enum(["comprehensive", "project", "behavioral", "hr"]).default("comprehensive"),
});

export const createMockInterviewSchema = z.object({
  jobId: z.string().trim().min(1).describe("Exact existing Job ID returned by search_pipeline."),
  resumeVersionId: z.string().trim().min(1).describe("Exact resume-version ID returned by get_resume_context."),
  mode: interviewModeSchema.default("comprehensive"),
});

export const updateResumePresentationSchema = z.object({
  resumeVersionId: z.string().trim().min(1).describe("Exact resume-version ID returned by get_resume_context."),
  template: z.enum(TEMPLATES).describe("Exact LuJie template key selected by the user."),
});

export async function createResumeFromExperience(
  input: z.infer<typeof createResumeFromExperienceSchema>,
  settings: EffectiveAiSettings,
  locale: "zh-CN" | "en",
) {
  const draft = await generateResumeDraftWithAI({ settings, locale, ...input });
  if (draft.source !== "ai") throw new Error(draft.message);
  const version = await createResumeVersion({
    name: input.resumeName,
    summary: input.targetRole ? `根据口述经历整理，目标岗位：${input.targetRole}` : "根据口述经历整理的独立简历。",
    content: draft.data,
  });
  return {
    operation: "created" as const,
    version: serializeVersion(version),
    href: `/resume/edit?version=${encodeURIComponent(version.id)}`,
  };
}

export async function createJdTailoredResume(
  input: z.infer<typeof createJdTailoredResumeSchema>,
  settings: EffectiveAiSettings,
) {
  const data = await getAppData();
  const existingJob = input.jobId ? data.jobs.find((job) => job.id === input.jobId) : undefined;
  if (input.jobId && !existingJob) throw new Error("找不到指定岗位，请重新搜索后再试。");
  const jd = existingJob?.jd.trim() ? existingJob.jd : input.jd ?? "";
  if (!jd.trim()) throw new Error("目标岗位没有可用于匹配的完整 JD。");
  const company = existingJob?.company ?? input.company?.trim() ?? "";
  const title = existingJob?.title ?? input.title?.trim() ?? "";
  if (!company || !title) throw new Error("创建岗位前需要明确公司和岗位名称。");

  const baseResume = await getTailoringBaseResume({ resumeVersionId: input.resumeVersionId });
  const analysis = withConfirmedJobIdentity(analyzeJobInput(`${company} - ${title}\n${jd}`), company, title);
  const tailored = await tailorResumeWithAI({
    resume: baseResume,
    jd,
    job: { id: existingJob?.id ?? "new-job", company, title },
    analysis,
    preferences: input.preferences,
    settings,
  });
  if (tailored.source !== "ai") throw new Error(tailored.message);
  const effectiveAnalysis = mergeTailoringAnalysis(analysis, tailored.meta);

  const job = existingJob ?? await createJob({ company, title, jd, source: "录阶 Agent" });
  const version = await createTailoredVersionForJob({
    jobId: job.id,
    resumeVersionId: input.resumeVersionId,
    tailoredContent: tailored.data,
    analysis: effectiveAnalysis,
    optimizationMeta: tailored.meta,
  });
  const savedJob = (await getAppData()).jobs.find((item) => item.id === job.id);
  if (!savedJob) throw new Error("定制简历已生成，但岗位回读失败。");
  return {
    operation: "created" as const,
    job: savedJob,
    version: serializeVersion(version),
    optimization: tailored.meta,
    href: careerLibraryTargetPath({ type: "job", id: savedJob.id }),
  };
}

export async function createInterviewPreparation(
  input: z.infer<typeof createInterviewPreparationSchema>,
  settings: EffectiveAiSettings,
  locale: "zh-CN" | "en",
) {
  const data = await getAppData();
  const job = data.jobs.find((item) => item.id === input.jobId);
  if (!job) throw new Error("找不到指定岗位，请重新搜索后再试。");
  const resume = [data.resume, ...data.versions].find((item) => item?.id === input.resumeVersionId);
  if (!resume) throw new Error("找不到指定简历，请重新搜索后再试。");

  const context = createInterviewPreparationInputSchema.parse({
    jobId: job.id,
    resumeVersionId: resume.id,
    jd: job.jd,
    resumeName: resume.name,
    resume: resume.content,
    focus: input.focus,
    locale,
  });
  const generated = await generateInterviewPreparationWithAI(settings, context);
  if (generated.source !== "ai") throw new Error(generated.message);
  const record = await createInterviewPreparationRecord(context, generated.data);
  return {
    operation: "created" as const,
    record,
    href: careerLibraryTargetPath({ type: "job", id: job.id }),
  };
}

export async function createMockInterview(input: z.infer<typeof createMockInterviewSchema>) {
  const data = await getAppData();
  const job = data.jobs.find((item) => item.id === input.jobId);
  if (!job) throw new Error("找不到指定岗位，请重新搜索后再试。");
  const resume = [data.resume, ...data.versions].find((item) => item?.id === input.resumeVersionId);
  if (!resume) throw new Error("找不到指定简历，请重新搜索后再试。");
  if (!job.jd.trim()) throw new Error("目标岗位没有可用于模拟面试的完整 JD。");

  const session = await interviewService.createSession(createInterviewSessionInputSchema.parse({
    jobId: job.id,
    resumeVersionId: resume.id,
    mode: input.mode,
    context: {
      company: job.company,
      title: job.title,
      jd: job.jd,
      resumeName: resume.name,
      resume: resume.content,
    },
  }));
  return {
    operation: "created" as const,
    session,
    href: `/interview?session=${encodeURIComponent(session.id)}`,
  };
}

export async function updateResumePresentation(input: z.infer<typeof updateResumePresentationSchema>) {
  const data = await getAppData();
  const resume = [data.resume, ...data.versions].find((item) => item?.id === input.resumeVersionId);
  if (!resume) throw new Error("找不到指定简历，请重新搜索后再试。");

  const version = await updateResumeVersion({
    versionId: resume.id,
    content: {
      ...resume.content,
      editor: { ...resume.content.editor, template: input.template },
    },
  });
  return {
    operation: "updated" as const,
    version: serializeVersion(version),
    href: `/resume/edit?version=${encodeURIComponent(version.id)}`,
  };
}

function serializeVersion(version: {
  id: string;
  resumeId: string;
  jobId: string | null;
  name: string;
  summary: string;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: version.id,
    resumeId: version.resumeId,
    jobId: version.jobId,
    name: version.name,
    summary: version.summary,
    content: version.content as ResumeContent,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}

function withConfirmedJobIdentity(analysis: JobAnalysis, company: string, title: string): JobAnalysis {
  return { ...analysis, company, title };
}

function mergeTailoringAnalysis(analysis: JobAnalysis, meta: ResumeOptimizationMeta): JobAnalysis {
  return {
    ...analysis,
    keywords: meta.keywords.length ? meta.keywords : analysis.keywords,
    suggestions: meta.summary
      ? [meta.summary, ...analysis.suggestions.filter((item) => item !== meta.summary)]
      : analysis.suggestions,
  };
}
