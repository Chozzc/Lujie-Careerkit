import type { UIMessage } from "ai";

export const AGENT_CONTEXT_MESSAGE_LIMIT = 12;

export function mergeLatestMessage(messages: UIMessage[], incoming: UIMessage) {
  const index = messages.findIndex((message) => message.id === incoming.id);
  if (incoming.role === "assistant" && index === -1) {
    throw new Error("不能从客户端新增 assistant 消息。");
  }
  if (index !== -1 && (index !== messages.length - 1 || messages[index].role !== incoming.role)) {
    throw new Error("只能续接当前对话的最后一条消息。");
  }
  if (index === -1) return [...messages, incoming];
  return messages.map((message, messageIndex) => messageIndex === index ? incoming : message);
}

export function splitAgentContext<T extends UIMessage>(
  messages: T[],
  limit = AGENT_CONTEXT_MESSAGE_LIMIT,
) {
  const start = Math.max(0, messages.length - limit);
  return { omitted: messages.slice(0, start), messages: messages.slice(start) };
}
