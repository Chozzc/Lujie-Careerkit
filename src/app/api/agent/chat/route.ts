import type { UIMessage } from "ai";
import { createAgentUIStreamResponse, safeValidateUIMessages } from "ai";
import { z } from "zod";

import { createCareerAgent, type CareerAgentUIMessage } from "@/lib/agent/career-agent";
import { mergeLatestMessage, splitAgentContext } from "@/lib/agent/message-context";
import { getAgentThread, saveAgentThreadMessages } from "@/lib/agent/thread-store";
import { getEffectiveAiRuntimeSettings } from "@/lib/repository";

export const maxDuration = 60;

const requestSchema = z.object({
  id: z.string().trim().min(1),
  locale: z.enum(["zh-CN", "en"]).default("zh-CN"),
  message: z.object({
    id: z.string().min(1),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.unknown()).min(1).max(100),
    metadata: z.unknown().optional(),
  }).passthrough(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "对话请求无效。" }, { status: 400 });

  const thread = await getAgentThread(parsed.data.id);
  if (!thread) return Response.json({ error: "对话不存在。" }, { status: 404 });

  const settings = await getEffectiveAiRuntimeSettings();
  if (!settings.enabled) {
    return Response.json({ error: "请先在设置中完成 AI Provider 与 API Key 配置。" }, { status: 503 });
  }

  const agent = createCareerAgent(settings, parsed.data.locale);
  let messages: UIMessage[];
  try {
    messages = mergeLatestMessage(thread.messages, parsed.data.message as UIMessage);
  } catch {
    return Response.json({ error: "对话消息顺序无效。" }, { status: 400 });
  }
  const validation = await safeValidateUIMessages<CareerAgentUIMessage>({
    messages,
    tools: agent.tools,
  });
  if (!validation.success) {
    return Response.json({ error: "对话历史与当前工具定义不兼容。" }, { status: 400 });
  }
  const context = splitAgentContext(validation.data);

  return createAgentUIStreamResponse({
    agent,
    uiMessages: context.messages,
    originalMessages: context.messages,
    abortSignal: request.signal,
    consumeSseStream: ({ stream }) => stream.pipeTo(new WritableStream()).catch(() => undefined),
    onFinish: async ({ messages: finishedMessages }) => {
      await saveAgentThreadMessages(parsed.data.id, [...context.omitted, ...finishedMessages]);
    },
    onError: () => "Agent 暂时无法完成这次请求，请检查 AI 设置后重试。",
  });
}
