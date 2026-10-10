import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentThreadConflictError, deriveThreadTitle, parseStoredMessages, saveAgentThreadMessages } from "./thread-store";

const db = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { agentThread: db } }));

describe("thread save protection", () => {
  const timestamp = "2026-09-29T00:00:00.000Z";
  const messages = [{ id: "u", role: "user", parts: [{ type: "text", text: "new request" }] }] as never;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(new Date(timestamp).getTime());
    db.findUnique.mockResolvedValue({ id: "thread", title: "新对话", createdAt: new Date(timestamp), updatedAt: new Date(timestamp) });
    db.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => vi.restoreAllMocks());

  it("compares the loaded revision atomically and advances it even in the same millisecond", async () => {
    expect(await saveAgentThreadMessages("thread", messages, timestamp)).toBe("2026-09-29T00:00:00.001Z");
    expect(db.findUnique).toHaveBeenCalledTimes(1);
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { id: "thread", updatedAt: new Date(timestamp) },
      data: { title: "new request", messages: JSON.stringify(messages), updatedAt: new Date("2026-09-29T00:00:00.001Z") },
    });
  });

  it("refuses a stale save without replacing newer history", async () => {
    db.updateMany.mockResolvedValue({ count: 0 });
    await expect(saveAgentThreadMessages("thread", messages, timestamp)).rejects.toBeInstanceOf(AgentThreadConflictError);
    expect(db.updateMany).toHaveBeenCalledTimes(1);
    expect(db.findUnique).toHaveBeenCalledTimes(1);
  });

  it("does not resurrect a deleted thread or write with an invalid revision", async () => {
    await expect(saveAgentThreadMessages("thread", messages, "invalid")).rejects.toBeInstanceOf(AgentThreadConflictError);
    db.findUnique.mockResolvedValue(null);
    await expect(saveAgentThreadMessages("thread", messages, timestamp)).rejects.toBeInstanceOf(AgentThreadConflictError);
    expect(db.updateMany).not.toHaveBeenCalled();
  });
});

describe("deriveThreadTitle", () => {
  it("uses the first user message without leaking later conversation text", () => {
    expect(deriveThreadTitle([
      { id: "a", role: "assistant", parts: [{ type: "text", text: "你好" }] },
      { id: "u", role: "user", parts: [{ type: "text", text: "  帮我记录   字节跳动前端实习生  " }] },
      { id: "u2", role: "user", parts: [{ type: "text", text: "不应该用这句" }] },
    ] as never)).toBe("帮我记录 字节跳动前端实习生");
  });

  it("caps long titles and keeps an empty thread usable", () => {
    expect(deriveThreadTitle([])).toBe("新对话");
    expect([...deriveThreadTitle([
      { id: "u", role: "user", parts: [{ type: "text", text: "a".repeat(50) }] },
    ] as never)]).toHaveLength(28);
  });

  it("repairs legacy empty or duplicate message ids while reading history", () => {
    const messages = parseStoredMessages(JSON.stringify([
      { id: "", role: "assistant", parts: [{ type: "text", text: "旧消息" }] },
      { id: "same", role: "user", parts: [{ type: "text", text: "第一条" }] },
      { id: "same", role: "assistant", parts: [{ type: "text", text: "第二条" }] },
    ]));

    expect(messages.map((message) => message.id)).toEqual([
      "legacy-message-1",
      "same",
      "legacy-message-3",
    ]);
  });
});
