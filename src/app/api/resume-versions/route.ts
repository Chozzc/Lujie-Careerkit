import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { createResumeVersion, deleteOptimizedResumeVersions } from "@/lib/repository";

const createResumeVersionSchema = z.object({
  name: z.string().optional(),
  summary: z.string().optional(),
  content: resumeContentInputSchema,
});

function serializeVersion(version: Awaited<ReturnType<typeof createResumeVersion>>) {
  return {
    id: version.id,
    jobId: version.jobId,
    name: version.name,
    summary: version.summary,
    content: version.content,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, createResumeVersionSchema);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const version = await createResumeVersion({
    name: body.name ?? "",
    summary: body.summary,
    content: body.content,
  });

  return Response.json({ version: serializeVersion(version) });
}

export async function DELETE(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope !== "optimized") {
    return new Response("Unsupported resume version delete scope.", { status: 400 });
  }

  const result = await deleteOptimizedResumeVersions();
  return Response.json({ ok: true, deletedCount: result.count });
}
