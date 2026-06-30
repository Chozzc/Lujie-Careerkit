import type { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

import { deleteJobWithApplications, updateJobWithApplication } from "@/lib/repository";

const updateJobSchema = z.object({
  applicationId: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  city: z.string().optional(),
  source: z.string().optional(),
  link: z.string().optional(),
  jd: z.string().optional(),
  status: z
    .enum(["READY", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"])
    .optional(),
  interviewRound: z.enum(["", "FIRST", "SECOND", "THIRD", "HR"]).optional(),
  appliedAt: z.string().nullable().optional(),
  stageDate: z.string().nullable().optional(),
  priority: z.enum(["HIGH", "NORMAL", "LOW"]).optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/jobs/[id]">) {
  const { id } = await context.params;
  const input = updateJobSchema.parse(await request.json());
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
    priority: input.priority,
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
