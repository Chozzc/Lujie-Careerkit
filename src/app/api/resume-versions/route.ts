import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { createResumeVersion, deleteOptimizedResumeVersions } from "@/lib/repository";

const createResumeVersionSchema = z.object({
  name: z.string().max(200).optional(),
  summary: z.string().max(1_000).optional(),
  content: resumeContentInputSchema,
  baseResume: resumeContentInputSchema.optional(),
  optimizationMeta: z.object({
    company: z.string().max(200),
    title: z.string().max(200),
    keywords: z.array(z.string().max(120)).max(20),
    summary: z.string().max(1_000),
    changes: z.array(z.string().max(200)).max(20),
    versionName: z.string().max(200),
  }).optional(),
  sourceResumeId: z.string().trim().min(1).optional(),
}).refine(
  (input) => Boolean(input.baseResume) === Boolean(input.optimizationMeta),
  { message: "Optimization source and metadata must be provided together.", path: ["optimizationMeta"] },
).refine(
  (input) => !input.optimizationMeta || Boolean(input.sourceResumeId),
  { message: "Optimized versions must identify their source resume.", path: ["sourceResumeId"] },
);

function serializeVersion(version: Awaited<ReturnType<typeof createResumeVersion>>) {
  return {
    id: version.id,
    resumeId: version.resumeId,
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
    baseResume: body.baseResume,
    optimizationMeta: body.optimizationMeta,
    sourceResumeId: body.sourceResumeId,
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
