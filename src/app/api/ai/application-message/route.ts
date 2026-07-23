import { z } from "zod";

import {
  applicationMessageKindSchema,
  generateApplicationMessageWithAI,
} from "@/lib/ai/application-message";
import { parseJsonRequest } from "@/lib/api-request";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { getEffectiveAiRuntimeSettings } from "@/lib/repository";

const schema = z.object({
  kind: applicationMessageKindSchema,
  jd: z.string().trim().min(1).max(50_000),
  resume: resumeContentInputSchema,
  extraContext: z.string().trim().max(2_000).optional().default(""),
  locale: z.enum(["zh-CN", "en"]).optional().default("zh-CN"),
});

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.success) return parsed.response;

  try {
    const settings = await getEffectiveAiRuntimeSettings();
    const result = await generateApplicationMessageWithAI(settings, parsed.data);
    if (result.source !== "ai") {
      return Response.json({ message: result.message }, { status: 503 });
    }

    return Response.json({
      content: result.data.content,
      source: result.source,
      message: result.message,
    });
  } catch {
    return Response.json({ message: "求职信生成失败，请稍后重试。" }, { status: 500 });
  }
}
