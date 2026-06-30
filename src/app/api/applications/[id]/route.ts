import type { ApplicationStatus } from "@prisma/client";
import { z } from "zod";

import { updateApplication } from "@/lib/repository";

const applicationSchema = z.object({
  status: z
    .enum(["READY", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"])
    .optional(),
  interviewRound: z.enum(["", "FIRST", "SECOND", "THIRD", "HR"]).optional(),
  stageDate: z.string().nullable().optional(),
  priority: z.enum(["HIGH", "NORMAL", "LOW"]).optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  notes: z.string().optional(),
  resumeVersionId: z.string().nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/applications/[id]">) {
  const { id } = await context.params;
  const input = applicationSchema.parse(await request.json());
  const application = await updateApplication({
    id,
    status: input.status as ApplicationStatus | undefined,
    interviewRound: input.interviewRound,
    stageDate: input.stageDate,
    priority: input.priority,
    nextFollowUpAt: input.nextFollowUpAt,
    notes: input.notes,
    resumeVersionId: input.resumeVersionId,
  });

  return Response.json({ application });
}
