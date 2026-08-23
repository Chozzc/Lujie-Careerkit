import { interviewService } from "@/lib/interview-runtime";

import { interviewRouteError } from "../../route-utils";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as { regenerate?: unknown };
    return Response.json({ session: await interviewService.finishSession(id, body.regenerate === true) });
  } catch (error) {
    return interviewRouteError(error);
  }
}
