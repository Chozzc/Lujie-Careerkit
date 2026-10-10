import type { UIMessage } from "ai";
import { z } from "zod";

import { prisma } from "@/lib/db";

const storedMessageSchema = z.object({
  id: z.string().max(200),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(z.unknown()),
  metadata: z.unknown().optional(),
}).passthrough();

export type AgentThreadSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export async function listAgentThreads(): Promise<AgentThreadSummary[]> {
  const threads = await prisma.agentThread.findMany({
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return threads.map(toThreadSummary);
}

export async function createAgentThread(title = "新对话") {
  const thread = await prisma.agentThread.create({
    data: { title: normalizeThreadTitle(title) },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return toThreadSummary(thread);
}

export async function getAgentThread(threadId: string) {
  const thread = await prisma.agentThread.findUnique({ where: { id: threadId } });
  if (!thread) return null;
  return {
    ...toThreadSummary(thread),
    messages: parseStoredMessages(thread.messages),
  };
}

export class AgentThreadConflictError extends Error {
  constructor() {
    super("对话已在另一窗口更新或删除，请重新打开对话，并核对已执行的操作后再继续。");
  }
}

export async function saveAgentThreadMessages(threadId: string, messages: UIMessage[], expectedUpdatedAt: string) {
  const thread = await prisma.agentThread.findUnique({
    where: { id: threadId },
    select: { title: true },
  });
  if (!thread) throw new AgentThreadConflictError();

  const title = thread.title === "新对话" ? deriveThreadTitle(messages) : thread.title;
  const expectedDate = new Date(expectedUpdatedAt);
  if (!Number.isFinite(expectedDate.getTime())) throw new AgentThreadConflictError();
  const updatedAt = new Date(Math.max(Date.now(), expectedDate.getTime() + 1));
  const result = await prisma.agentThread.updateMany({
    where: { id: threadId, updatedAt: expectedDate },
    data: { messages: JSON.stringify(messages), title, updatedAt },
  });
  if (result.count !== 1) throw new AgentThreadConflictError();
  return updatedAt.toISOString();
}

export async function deleteAgentThread(threadId: string) {
  await prisma.agentThread.delete({ where: { id: threadId } });
}

export function deriveThreadTitle(messages: UIMessage[]) {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = message.parts
      .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return [...text].slice(0, 28).join("");
  }
  return "新对话";
}

export function parseStoredMessages(value: string): UIMessage[] {
  let valueAsJson: unknown;
  try {
    valueAsJson = JSON.parse(value);
  } catch {
    throw new Error("对话历史已损坏，无法读取。");
  }
  const parsed = storedMessageSchema.array().safeParse(valueAsJson);
  if (!parsed.success) throw new Error("对话历史已损坏，无法读取。");
  const usedIds = new Set<string>();
  return parsed.data.map((message, index) => {
    let id = message.id.trim();
    if (!id || usedIds.has(id)) {
      let suffix = 0;
      do {
        id = `legacy-message-${index + 1}${suffix ? `-${suffix}` : ""}`;
        suffix += 1;
      } while (usedIds.has(id));
    }
    usedIds.add(id);
    return { ...message, id } as UIMessage;
  });
}

function normalizeThreadTitle(value: string) {
  return [...(value.trim() || "新对话")].slice(0, 60).join("");
}

function toThreadSummary(thread: { id: string; title: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  };
}
