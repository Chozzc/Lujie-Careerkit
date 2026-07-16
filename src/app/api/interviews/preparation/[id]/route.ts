import {
  deleteInterviewPreparationRecord,
  getInterviewPreparationRecord,
} from "@/lib/repository";

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
