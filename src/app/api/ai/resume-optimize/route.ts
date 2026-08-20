import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { optimizeResumeWithAI } from "@/lib/ai-service";
import {
  isAiEditableResumeIssue,
  resumeDiagnosisSchema,
} from "@/lib/ai/resume-diagnosis";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { getTailoringBaseResume } from "@/lib/repository";

const schema = z.object({
  resumeVersionId: z.string().trim().min(1).max(200).optional(),
  resumeContent: resumeContentInputSchema.optional(),
  diagnosis: resumeDiagnosisSchema.optional(),
  selectedIssueIds: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  additionalDirection: z.string().trim().max(1_000).optional(),
  locale: z.enum(["zh-CN", "en"]).optional(),
}).superRefine((input, context) => {
  if (!input.diagnosis) return;
  const issueIds = new Set(input.diagnosis.issues.map((issue) => issue.id));
  if (!input.selectedIssueIds?.length) {
    context.addIssue({ code: "custom", message: "Select at least one diagnosis issue.", path: ["selectedIssueIds"] });
    return;
  }
  if (input.selectedIssueIds.some((issueId) => !issueIds.has(issueId))) {
    context.addIssue({ code: "custom", message: "Selected diagnosis issue was not found.", path: ["selectedIssueIds"] });
  }
  const selectedIds = new Set(input.selectedIssueIds);
  if (input.diagnosis.issues.some((issue) => selectedIds.has(issue.id) && !isAiEditableResumeIssue(issue))) {
    context.addIssue({
      code: "custom",
      message: "Issues requiring user input or confirmation cannot be optimized automatically.",
      path: ["selectedIssueIds"],
    });
  }
});

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;
  let baseResume;
  try {
    baseResume = await getTailoringBaseResume({
      resumeVersionId: input.resumeVersionId,
      resumeContent: input.resumeContent,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "找不到所选简历版本。") {
      return Response.json({ message: error.message }, { status: 404 });
    }
    throw error;
  }
  const optimized = await optimizeResumeWithAI({
    resume: baseResume,
    diagnosis: input.diagnosis,
    selectedIssueIds: input.selectedIssueIds,
    additionalDirection: input.additionalDirection,
    locale: input.locale,
  });
  if (optimized.source !== "ai") {
    return Response.json({ message: optimized.message }, { status: 503 });
  }
  const meta = optimized.meta ?? {
    company: "",
    title: "",
    keywords: [],
    summary: "",
    changes: [],
    versionName: "",
  };

  return Response.json({
    draft: optimized.data,
    optimization: meta,
    source: "ai",
    message: optimized.message,
  });
}
