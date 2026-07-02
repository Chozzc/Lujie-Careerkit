import { z } from "zod";

import { tailorResumeWithAI } from "@/lib/ai-service";
import { analyzeJobInput } from "@/lib/job-analysis";
import { isResumeContentLike } from "@/lib/resume-content";
import { createTailoredVersionForJob, getTailoringBaseResume, saveJobAnalysis } from "@/lib/repository";
import type { JobAnalysis, ResumeOptimizationMeta } from "@/lib/types";

const schema = z.object({
  jobId: z.string(),
  applicationId: z.string().optional(),
  resumeVersionId: z.string().optional(),
  resumeContent: z.unknown().optional(),
  preferences: z
    .object({
      emphasizeImpact: z.boolean().optional(),
      quantifyResults: z.boolean().optional(),
      atsFriendly: z.boolean().optional(),
      highlightMatchedSkills: z.boolean().optional(),
    })
    .optional(),
  analysis: z.unknown().optional(),
  jd: z.string().default(""),
});

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const providedAnalysis = isJobAnalysisLike(input.analysis) ? input.analysis : null;
  const analysis = providedAnalysis ?? analyzeJobInput(input.jd);
  const baseResume = await getTailoringBaseResume({
    resumeVersionId: input.resumeVersionId,
    resumeContent: isResumeContentLike(input.resumeContent) ? input.resumeContent : undefined,
  });
  const tailored = await tailorResumeWithAI({
    resume: baseResume,
    jd: input.jd,
    job: {
      id: input.jobId,
      company: analysis.company,
      title: analysis.title,
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
  await saveJobAnalysis(input.jobId, effectiveAnalysis);
  const version = await createTailoredVersionForJob({
    jobId: input.jobId,
    applicationId: input.applicationId,
    resumeVersionId: input.resumeVersionId,
    resumeContent: isResumeContentLike(input.resumeContent) ? input.resumeContent : undefined,
    tailoredContent: tailored.data,
    analysis: effectiveAnalysis,
    optimizationMeta: meta,
  });

  return Response.json({
    analysis: effectiveAnalysis,
    version,
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
  return text.length > 32 ? "" : text;
}

function isJobAnalysisLike(value: unknown): value is JobAnalysis {
  if (!value || typeof value !== "object") return false;
  const analysis = value as Partial<JobAnalysis>;
  return Boolean(
    typeof analysis.company === "string" &&
      typeof analysis.title === "string" &&
      Array.isArray(analysis.requirements) &&
      Array.isArray(analysis.keywords) &&
      Array.isArray(analysis.suggestions),
  );
}
