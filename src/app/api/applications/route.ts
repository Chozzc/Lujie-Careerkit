import { z } from "zod";

import { dateInputSchema, parseJsonRequest } from "@/lib/api-request";
import { createApplication } from "@/lib/repository";

const applicationSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.enum(["APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"]).default("APPLIED"),
  resumeVersionId: z.string().trim().min(1).nullable().optional(),
  interviewRound: z.enum(["", "FIRST", "SECOND", "THIRD", "HR"]).optional(),
  appliedAt: dateInputSchema.nullable().optional(),
  stageDate: dateInputSchema.nullable().optional(),
  nextFollowUpAt: dateInputSchema.nullable().optional(),
  notes: z.string().max(5_000).optional(),
});

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, applicationSchema);
  if (!parsed.success) return parsed.response;
  const application = await createApplication(parsed.data);
  return Response.json({ application });
}
