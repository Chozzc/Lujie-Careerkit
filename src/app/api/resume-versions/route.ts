import { z } from "zod";

import { createResumeVersion, deleteOptimizedResumeVersions } from "@/lib/repository";

const createResumeVersionSchema = z.object({
  name: z.string().optional(),
  summary: z.string().optional(),
  content: z.unknown(),
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
  const body = createResumeVersionSchema.parse(await request.json());
  const version = await createResumeVersion({
    name: body.name ?? "",
    summary: body.summary,
    content: body.content as never,
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
