import { createInterviewSessionInputSchema } from "@/lib/interview";
import { interviewService } from "@/lib/interview-runtime";

import { interviewRouteError } from "./route-utils";

export const runtime = "nodejs";

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  try {
    const input = createInterviewSessionInputSchema.parse(await request.json());
    const session = await interviewService.createSession(input);
    return Response.json({ session }, { status: 201 });
  } catch (error) {
    return interviewRouteError(error);
  }
}

export async function DELETE() {
  try {
    return Response.json({ deletedCount: await interviewService.clearSessions() });
  } catch (error) {
    return interviewRouteError(error);
  }
}
