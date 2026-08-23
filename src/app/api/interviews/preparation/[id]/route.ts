import {
  deleteInterviewPreparationRecord,
  getInterviewPreparationRecord,
  updateInterviewPreparationRecord,
} from "@/lib/repository";
import { interviewPreparationSchema } from "@/lib/interview-preparation";

import { interviewRouteError } from "../../route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const record = await getInterviewPreparationRecord(id);
    if (!record) throw new Error("未找到这份面试复习资料。");
    return Response.json({ record });
  } catch (error) {
    return interviewRouteError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const content = interviewPreparationSchema.parse((await request.json()).content);
    return Response.json({ record: await updateInterviewPreparationRecord(id, content) });
  } catch (error) {
    return interviewRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const record = await getInterviewPreparationRecord(id);
    if (!record) throw new Error("未找到这份面试复习资料。");
    await deleteInterviewPreparationRecord(id);
    return Response.json({ ok: true });
  } catch (error) {
    return interviewRouteError(error);
  }
}
