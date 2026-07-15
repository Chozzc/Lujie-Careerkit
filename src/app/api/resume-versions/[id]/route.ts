import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { deleteResumeVersion, updateResumeVersion } from "@/lib/repository";

const resumeVersionSchema = z.object({
  name: z.string().optional(),
  summary: z.string().optional(),
  content: resumeContentInputSchema,
});

export async function PATCH(request: Request, context: RouteContext<"/api/resume-versions/[id]">) {
  const { id } = await context.params;
  const parsed = await parseJsonRequest(request, resumeVersionSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const version = await updateResumeVersion({
    versionId: id,
    name: body.name,
    summary: body.summary,
    content: body.content,
  });

  return Response.json({
    version: {
      id: version.id,
      jobId: version.jobId,
      name: version.name,
      summary: version.summary,
      content: version.content,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/resume-versions/[id]">) {
  const { id } = await context.params;
  await deleteResumeVersion(id);
  return Response.json({ ok: true });
}
