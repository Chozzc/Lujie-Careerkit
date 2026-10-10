import { isDeepStrictEqual } from "node:util";
import { isToolUIPart, pruneMessages, type ModelMessage, type UIMessage } from "ai";

// History budget; system instructions, tool schemas and model output are separate.
export const AGENT_CONTEXT_TOKEN_BUDGET = 12_000;

export class AgentContextError extends Error {
  constructor() {
    super("当前任务的必要上下文过长，请缩短 JD、简历或分批处理；已有记录仍保留，请先核对执行结果再继续。");
  }
}

export function mergeLatestMessage(messages: UIMessage[], incoming: UIMessage) {
  const index = messages.findIndex((message) => message.id === incoming.id);
  if (incoming.role === "assistant" && index === -1) {
    throw new Error("不能从客户端新增 assistant 消息。");
  }
  if (index !== -1 && (index !== messages.length - 1 || messages[index].role !== incoming.role)) {
    throw new Error("只能续接当前对话的最后一条消息。");
  }
  if (index === -1) return [...messages, incoming];
  if (incoming.role === "assistant") {
    const stored = messages[index];
    const expected = { ...stored, parts: stored.parts.map((part, partIndex) => {
      const next = incoming.parts[partIndex];
      if (!next || !isToolUIPart(part) || !isToolUIPart(next)) return part;
      if (part.state === "approval-requested" && next.state === "approval-responded") {
        return { ...part, state: next.state, approval: { id: part.approval.id,
          approved: next.approval.approved,
          ...(next.approval.reason === undefined ? {} : { reason: next.approval.reason }) } };
      }
      if (part.state === "input-available" && next.state === "output-available"
        && (part.type === "tool-configure_jd_optimization" || part.type === "tool-configure_interview")) {
        return { ...part, state: next.state, output: next.output };
      }
      return part;
    }) };
    // Accept only a decision or a configuration result, never client-rewritten calls/history.
    if (!isDeepStrictEqual(expected, incoming)) throw new Error("只能确认原操作或提交待选择的参数。");
  }
  return messages.map((message, messageIndex) => messageIndex === index ? incoming : message);
}

export function estimateContextTokens(value: unknown) {
  const text = JSON.stringify(value) ?? "";
  // ponytail: conservative multilingual estimate, not provider-exact tokenization.
  // Replace with the configured model's tokenizer if measured usage needs tighter packing.
  const nonAscii = text.replace(/[^\u0080-\uFFFF]/g, "");
  return Math.ceil((text.length - nonAscii.length) / 3) + new TextEncoder().encode(nonAscii).length;
}

export function markUnfinishedApprovals(messages: UIMessage[], errorText: string): UIMessage[] | null {
  let changed = false;
  const recovery = messages.map((message) => ({ ...message, parts: message.parts.map((part) => {
    if (!isToolUIPart(part) || part.state !== "approval-responded" || !part.approval.approved) return part;
    changed = true;
    return { ...part, state: "output-error" as const, approval: { ...part.approval, approved: true as const }, errorText };
  }) }));
  // ponytail: reuse SDK error states in the existing history. Unknown outcomes require
  // manual reconciliation; transactional execution receipts would be needed for automatic recovery.
  return changed ? recovery : null;
}

export function prepareAgentContext(messages: ModelMessage[], budget = AGENT_CONTEXT_TOKEN_BUDGET) {
  const pendingCalls = new Map<string, number>();
  const approvals = new Map<string, string>();
  let currentTurn = -1;
  for (const [index, message] of messages.entries()) {
    if (message.role === "user") currentTurn = index;
    if (message.role !== "assistant" && message.role !== "tool") continue;
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === "tool-call") pendingCalls.set(part.toolCallId, currentTurn);
      if (part.type === "tool-result") pendingCalls.delete(part.toolCallId);
      if (part.type === "tool-approval-request") approvals.set(part.approvalId, part.toolCallId);
      if (part.type === "tool-approval-response" && !part.approved) {
        const callId = approvals.get(part.approvalId);
        if (callId) pendingCalls.delete(callId);
      }
    }
  }
  const protectedStart = Math.min(currentTurn, ...pendingCalls.values());
  if (protectedStart < 0) throw new AgentContextError();
  const cleaned = [
    ...pruneMessages({ messages: messages.slice(0, protectedStart), reasoning: "all" }),
    ...messages.slice(protectedStart),
  ];
  const requiredStart = cleaned.length - (messages.length - protectedStart);
  let start = requiredStart;
  let tokens = 0;
  // Never cut a current turn or a still-pending call/approval just to fit the budget.
  for (let index = cleaned.length - 1; index >= 0; index -= 1) {
    tokens += estimateContextTokens(cleaned[index]) + 8;
    if (tokens > budget) {
      if (index >= requiredStart) throw new AgentContextError();
      break;
    }
    if (index < requiredStart && cleaned[index].role === "user") start = index;
  }
  return cleaned.slice(start);
}
