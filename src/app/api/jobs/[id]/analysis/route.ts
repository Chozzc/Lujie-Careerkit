import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { clearJobAnalysis, updateJobDescription } from "@/lib/repository";

const updateSchema = z.object({ jd: z.string().trim().min(1).max(50_000) });

export async function PATCH(request: Request, context: RouteContext<"/api/jobs/[id]/analysis">) {
  const { id } = await context.params;
  const parsed = await parseJsonRequest(request, updateSchema);
  if (!parsed.success) return parsed.response;
  const job = await updateJobDescription(id, parsed.data.jd);
  return Response.json({ job });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/jobs/[id]/analysis">) {
  const { id } = await context.params;
  await clearJobAnalysis(id);
  return Response.json({ ok: true });
}
