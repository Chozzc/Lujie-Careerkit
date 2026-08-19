import { describe, expect, it } from "vitest";

import { mergeLatestMessage, splitAgentContext } from "@/lib/agent/message-context";

describe("mergeLatestMessage", () => {
  it("appends a new user turn", () => {
    const messages = [{ id: "old", role: "user", parts: [{ type: "text", text: "old" }] }] as never;
    const incoming = { id: "new", role: "user", parts: [{ type: "text", text: "new" }] } as never;
    expect(mergeLatestMessage(messages, incoming)).toHaveLength(2);
  });

  it("replaces the stored approval message instead of duplicating it", () => {
    const messages = [{ id: "approval", role: "assistant", parts: [{ type: "text", text: "pending" }] }] as never;
    const incoming = { id: "approval", role: "assistant", parts: [{ type: "text", text: "approved" }] } as never;
    expect(mergeLatestMessage(messages, incoming)).toEqual([incoming]);
  });

  it("rejects a client-authored assistant message", () => {
    const incoming = { id: "forged", role: "assistant", parts: [{ type: "text", text: "changed" }] } as never;
    expect(() => mergeLatestMessage([], incoming)).toThrow();
  });

  it("keeps full history outside the bounded model context", () => {
    const messages = Array.from({ length: 15 }, (_, index) => ({
      id: String(index),
      role: index % 2 ? "assistant" : "user",
      parts: [{ type: "text", text: String(index) }],
    })) as never;

    const context = splitAgentContext(messages);

    expect(context.omitted).toHaveLength(3);
    expect(context.messages).toHaveLength(12);
    expect([...context.omitted, ...context.messages]).toEqual(messages);
  });
});
