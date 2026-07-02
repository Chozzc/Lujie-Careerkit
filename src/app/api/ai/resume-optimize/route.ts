import { z } from "zod";

import { optimizeResumeWithAI } from "@/lib/ai-service";
import { isResumeContentLike } from "@/lib/resume-content";
import { buildResumeDisplayName } from "@/lib/resume-naming";
import { createResumeVersion, getTailoringBaseResume } from "@/lib/repository";

const schema = z.object({
  resumeVersionId: z.string().optional(),
  resumeContent: z.unknown().optional(),
});

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const input = schema.parse(await request.json());
  const baseResume = await getTailoringBaseResume({
    resumeVersionId: input.resumeVersionId,
    resumeContent: isResumeContentLike(input.resumeContent) ? input.resumeContent : undefined,
  });
  const optimized = await optimizeResumeWithAI({ resume: baseResume });
  if (optimized.source !== "ai") {
    return Response.json({ message: optimized.message }, { status: 503 });
  }
  const meta = optimized.meta ?? {
    company: "",
    title: "",
    keywords: [],
    summary: "",
    changes: [],
    versionName: "",
  };

  const version = await createResumeVersion({
    name: meta.versionName || `AI优化-${buildResumeDisplayName(baseResume, "未命名简历")}`,
    summary: meta.summary || "AI 自动优化生成的简历版本，请在编辑器中复核后使用。",
    content: optimized.data,
    baseResume,
    optimizationMeta: meta,
  });

  return Response.json({
    version,
    optimization: meta,
    source: "ai",
    message: optimized.message,
  });
}
