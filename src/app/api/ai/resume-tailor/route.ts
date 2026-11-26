import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { tailorResumeWithAI } from "@/lib/ai-service";
import { analyzeJobInput, jobAnalysisInputSchema } from "@/lib/job-analysis";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { createTailoredVersionForJob, getTailoringJob, getTailoringSource } from "@/lib/repository";
import type { JobAnalysis, ResumeOptimizationMeta } from "@/lib/types";

const schema = z.object({
  jobId: z.string().trim().min(1).max(200).optional(),
  applicationId: z.string().trim().min(1).max(200).optional(),
  resumeVersionId: z.string().trim().min(1).max(200).optional(),
  resumeContent: resumeContentInputSchema.optional(),
  preferences: z
    .object({
      emphasizeImpact: z.boolean().optional(),
      quantifyResults: z.boolean().optional(),
      atsFriendly: z.boolean().optional(),
      highlightMatchedSkills: z.boolean().optional(),
    })
    .optional(),
  analysis: jobAnalysisInputSchema.optional(),
  jd: z.string().trim().min(1).max(50_000),
});

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;
  let source;
  try {
    source = await getTailoringSource({
      resumeVersionId: input.resumeVersionId,
      resumeContent: input.resumeContent,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "找不到所选简历版本。") {
      return Response.json({ message: error.message }, { status: 404 });
    }
    throw error;
  }
  const jobBeforeGeneration = input.jobId ? await getTailoringJob(input.jobId) : null;
  if (input.jobId && !jobBeforeGeneration) {
    return Response.json({ message: "找不到目标岗位。" }, { status: 404 });
  }
  const analysis = input.analysis ?? analyzeJobInput(input.jd);
  const tailored = await tailorResumeWithAI({
    resume: source.content,
    jd: input.jd,
    job: {
      id: input.jobId ?? "new-job",
      company: jobBeforeGeneration?.company ?? analysis.company,
      title: jobBeforeGeneration?.title ?? analysis.title,
    },
    analysis,
    preferences: input.preferences,
  });
  if (tailored.source !== "ai") {
    return Response.json({ message: tailored.message }, { status: 503 });
  }
  const meta = tailored.meta ?? {
    company: "",
    title: "",
    keywords: [],
    summary: "",
    changes: [],
    versionName: "",
  };
  const effectiveAnalysis = mergeAnalysisMeta(analysis, meta);
  let version;
  try {
    version = await createTailoredVersionForJob({
      target: jobBeforeGeneration ? { jobId: jobBeforeGeneration.id, expectedJd: jobBeforeGeneration.jd } : { newJob: {
        company: effectiveAnalysis.company, title: effectiveAnalysis.title, jd: input.jd, source: "JD匹配优化",
      } },
      applicationId: input.applicationId,
      source,
      tailoredContent: tailored.data,
      analysis: effectiveAnalysis,
      optimizationMeta: meta,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("多个岗位符合") || error.message === "目标岗位的 JD 已变更，请重新生成。")) {
      return Response.json({ message: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "投递记录不属于该岗位。") {
      return Response.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof Error && ["找不到所选简历版本。", "找不到目标岗位。"].includes(error.message)) {
      return Response.json({ message: error.message }, { status: 404 });
    }
    throw error;
  }

  const { job, ...savedVersion } = version;
  return Response.json({
    analysis: job?.analysis ?? effectiveAnalysis,
    version: savedVersion,
    job,
    optimization: meta,
    source: "ai",
    message: tailored.message,
  });
}

function mergeAnalysisMeta(analysis: JobAnalysis, meta: ResumeOptimizationMeta): JobAnalysis {
  const company = cleanMetaText(meta.company) || analysis.company;
  const title = cleanMetaText(meta.title) || analysis.title;
  const keywords = meta.keywords.length ? meta.keywords : analysis.keywords;
  const suggestions = meta.summary
    ? [meta.summary, ...analysis.suggestions.filter((item) => item !== meta.summary)]
    : analysis.suggestions;
  return {
    ...analysis,
    company,
    title,
    keywords,
    suggestions,
  };
}

function cleanMetaText(value?: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (/待|未知|未识别|目标公司|目标岗位/.test(text)) return "";
  return text.length > 100 ? "" : text;
}
