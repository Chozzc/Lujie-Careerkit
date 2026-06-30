import { z } from "zod";

import { tailorResumeWithAI } from "@/lib/ai-service";
import { analyzeJobInput } from "@/lib/job-analysis";
import { createTailoredVersionForJob, getTailoringBaseResume, saveJobAnalysis } from "@/lib/repository";
import type { JobAnalysis, ResumeContent } from "@/lib/types";

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
  await saveJobAnalysis(input.jobId, analysis);
  const version = await createTailoredVersionForJob({
    jobId: input.jobId,
    applicationId: input.applicationId,
    resumeVersionId: input.resumeVersionId,
    resumeContent: isResumeContentLike(input.resumeContent) ? input.resumeContent : undefined,
    tailoredContent: tailored.data,
    analysis,
  });

  return Response.json({
    analysis,
    version,
    source: "ai",
    message: tailored.message,
  });
}

function isResumeContentLike(value: unknown): value is ResumeContent {
  if (!value || typeof value !== "object") return false;
  const resume = value as Partial<ResumeContent>;
  return Boolean(
    resume.basics &&
      typeof resume.basics.name === "string" &&
      resume.profile &&
      typeof resume.profile.summary === "string" &&
      Array.isArray(resume.projects) &&
      Array.isArray(resume.skills),
  );
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
