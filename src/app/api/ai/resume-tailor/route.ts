import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { tailorResumeWithAI } from "@/lib/ai-service";
import { analyzeJobInput, jobAnalysisInputSchema } from "@/lib/job-analysis";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { createTailoredVersionForJob, getTailoringBaseResume, saveJobAnalysis } from "@/lib/repository";
import type { JobAnalysis, ResumeOptimizationMeta } from "@/lib/types";

const schema = z.object({
  jobId: z.string().trim().min(1).max(200),
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
  const analysis = input.analysis ?? analyzeJobInput(input.jd);
  const baseResume = await getTailoringBaseResume({
    resumeVersionId: input.resumeVersionId,
    resumeContent: input.resumeContent,
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
    resumeContent: input.resumeContent,
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
