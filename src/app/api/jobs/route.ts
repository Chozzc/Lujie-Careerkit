import { z } from "zod";

import { createJobWithApplication } from "@/lib/repository";

const jobSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  city: z.string().optional(),
  source: z.string().optional(),
  jd: z.string().min(1),
  link: z.string().optional(),
  deadline: z.string().nullable().optional(),
  applicationStatus: z
    .enum(["READY", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"])
    .optional(),
  interviewRound: z.enum(["", "FIRST", "SECOND", "THIRD", "HR"]).optional(),
  appliedAt: z.string().nullable().optional(),
  stageDate: z.string().nullable().optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  notes: z.string().optional(),
});

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const input = jobSchema.parse(await request.json());
  const result = await createJobWithApplication(input);
  return Response.json(result);
}
