import { interviewService } from "@/lib/interview-runtime";

import { interviewRouteError } from "../../route-utils";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json({ session: await interviewService.finishSession(id) });
  } catch (error) {
    return interviewRouteError(error);
  }
}
