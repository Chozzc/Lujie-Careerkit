import type { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

import { dateInputSchema, parseJsonRequest } from "@/lib/api-request";
import { deleteJobWithApplications, updateJobWithApplication } from "@/lib/repository";

const updateJobSchema = z.object({
  applicationId: z.string().trim().min(1),
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  city: z.string().optional(),
  source: z.string().optional(),
  link: z.string().optional(),
  jd: z.string().optional(),
  status: z
    .enum(["READY", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"])
    .optional(),
  interviewRound: z.enum(["", "FIRST", "SECOND", "THIRD", "HR"]).optional(),
  appliedAt: dateInputSchema.nullable().optional(),
  stageDate: dateInputSchema.nullable().optional(),
  nextFollowUpAt: dateInputSchema.nullable().optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/jobs/[id]">) {
  const { id } = await context.params;
  const parsed = await parseJsonRequest(request, updateJobSchema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;
  const result = await updateJobWithApplication({
    jobId: id,
    applicationId: input.applicationId,
    company: input.company,
    title: input.title,
    city: input.city,
    source: input.source,
    link: input.link,
    jd: input.jd,
    status: input.status as ApplicationStatus | undefined,
    interviewRound: input.interviewRound,
    appliedAt: input.appliedAt,
    stageDate: input.stageDate,
    nextFollowUpAt: input.nextFollowUpAt,
    notes: input.notes,
  });

  return Response.json(result);
}

export async function DELETE(_request: Request, context: RouteContext<"/api/jobs/[id]">) {
  const { id } = await context.params;
  await deleteJobWithApplications(id);
  return Response.json({ ok: true });
}
