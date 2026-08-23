import { z } from "zod";

import {
  interviewAnswerSchema,
  interviewContextSchema,
  interviewQuestionSchema,
  interviewReportSchema,
  saveInterviewProgressInputSchema,
} from "@/lib/interview";
import { interviewService } from "@/lib/interview-runtime";
import { deleteInterviewSessionSection, updateInterviewSessionRecord } from "@/lib/repository";

import { interviewRouteError } from "../route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const editSessionSchema = z.object({
  context: interviewContextSchema,
  questions: z.array(interviewQuestionSchema).min(1),
  answers: z.record(z.string(), interviewAnswerSchema),
  feedback: interviewReportSchema.nullable(),
});

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return Response.json({ session: await interviewService.getSession(id) });
  } catch (error) {
    return interviewRouteError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const edited = editSessionSchema.safeParse(body);
    if (edited.success) {
      return Response.json({ session: await updateInterviewSessionRecord(id, edited.data) });
    }
    const input = saveInterviewProgressInputSchema.parse(body);
    return Response.json({ session: await interviewService.saveProgress(id, input) });
  } catch (error) {
    return interviewRouteError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const section = new URL(request.url).searchParams.get("section");
    if (section === "questions" || section === "feedback") {
      return Response.json({ session: await deleteInterviewSessionSection(id, section) });
    }
    await interviewService.deleteSession(id);
    return Response.json({ ok: true });
  } catch (error) {
    return interviewRouteError(error);
  }
}
