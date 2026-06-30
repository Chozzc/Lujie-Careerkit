import { saveInterviewProgressInputSchema } from "@/lib/interview";
import { interviewService } from "@/lib/interview-runtime";

import { interviewRouteError } from "../route-utils";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

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
    const input = saveInterviewProgressInputSchema.parse(await request.json());
    return Response.json({ session: await interviewService.saveProgress(id, input) });
  } catch (error) {
    return interviewRouteError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await interviewService.deleteSession(id);
    return Response.json({ ok: true });
  } catch (error) {
    return interviewRouteError(error);
  }
}
