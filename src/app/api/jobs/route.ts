import { z } from "zod";

import { dateInputSchema, parseJsonRequest } from "@/lib/api-request";
import { createJobWithApplication } from "@/lib/repository";

const jobSchema = z.object({
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  city: z.string().optional(),
  source: z.string().optional(),
  jd: z.string().trim().min(1),
  link: z.string().optional(),
  deadline: dateInputSchema.nullable().optional(),
  applicationStatus: z
    .enum(["READY", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"])
    .optional(),
  interviewRound: z.enum(["", "FIRST", "SECOND", "THIRD", "HR"]).optional(),
  appliedAt: dateInputSchema.nullable().optional(),
  stageDate: dateInputSchema.nullable().optional(),
  nextFollowUpAt: dateInputSchema.nullable().optional(),
  notes: z.string().optional(),
});

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, jobSchema);
  if (!parsed.success) return parsed.response;
  const result = await createJobWithApplication(parsed.data);
  return Response.json(result);
}
