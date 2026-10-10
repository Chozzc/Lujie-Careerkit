import type { UIMessage } from "ai";
import { convertToModelMessages, validateUIMessages, createUIMessageStream, createUIMessageStreamResponse, createIdGenerator, TypeValidationError } from "ai";
import { z } from "zod";

import { createCareerAgent, type CareerAgentUIMessage } from "@/lib/agent/career-agent";
import { AgentContextError, markUnfinishedApprovals, mergeLatestMessage, prepareAgentContext } from "@/lib/agent/message-context";
import { AgentThreadConflictError, getAgentThread, saveAgentThreadMessages } from "@/lib/agent/thread-store";
import { normalizeAiError } from "@/lib/ai/errors";
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
  const uncertainResult = parsed.data.locale === "en"
    ? "This approval was accepted, but the result is not yet confirmed. Reopen the conversation and check saved records before requesting another operation; this approval will not run again."
    : "这次确认已接收，但执行结果尚未确认。请重新打开对话并核对已有成果，再决定是否发起新操作；这次确认不会重复执行。";
  let revision = thread.updatedAt;
  const onError = (error: unknown) => {
    if (error instanceof AgentContextError) return parsed.data.locale === "en"
      ? "The required context is too long. Shorten the JD or resume, or split the task. Existing records are preserved; check completed actions before continuing."
      : error.message;
    if (error instanceof AgentThreadConflictError) return parsed.data.locale === "en"
      ? "This conversation was updated or deleted in another window. Reopen it and check completed actions before continuing."
      : error.message;
    const message = normalizeAiError(error).message;
    return revision === thread.updatedAt ? message : `${message} ${uncertainResult}`;
  };

  try {
    // Keep the SDK validation/conversion, but consume approvals before stream() can execute them.
    const validated = await validateUIMessages<CareerAgentUIMessage>({ messages, tools: agent.tools });
    const prompt = await convertToModelMessages(validated, { tools: agent.tools });
    const recovery = markUnfinishedApprovals(validated, uncertainResult);
    if (recovery) {
      prepareAgentContext(prompt);
      request.signal.throwIfAborted();
      revision = await saveAgentThreadMessages(thread.id, recovery, revision);
    }
    const result = await agent.stream({ prompt, abortSignal: request.signal });
    const stream = result.toUIMessageStream({
      originalMessages: validated,
      generateMessageId: createIdGenerator({ prefix: "agent-message", size: 16 }),
      sendReasoning: false,
      onFinish: async ({ messages: finishedMessages }) => {
        // An aborted stream must never restore a consumed approval without a known result.
        await saveAgentThreadMessages(thread.id, markUnfinishedApprovals(finishedMessages, uncertainResult) ?? finishedMessages, revision);
      },
      onError,
    });
    return createUIMessageStreamResponse({
      // The wrapper also delivers persistence errors raised after generation finishes.
      stream: createUIMessageStream({ execute: ({ writer }) => writer.merge(stream), onError }),
      consumeSseStream: ({ stream }) => stream.pipeTo(new WritableStream()).catch(() => undefined),
    });
  } catch (error) {
    if (TypeValidationError.isInstance(error)) {
      return Response.json({ error: parsed.data.locale === "en"
        ? "The conversation history is incompatible with the current tools."
        : "对话历史与当前工具定义不兼容。" }, { status: 400 });
    }
    return Response.json({ error: onError(error) }, { status: error instanceof AgentContextError ? 422
      : error instanceof AgentThreadConflictError ? 409 : 500 });
  }
}
