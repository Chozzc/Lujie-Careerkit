import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";

import { AgentContextError, estimateContextTokens, prepareAgentContext } from "./message-context";

describe("Agent model context", () => {
  it("keeps many short turns instead of dropping everything before message twelve", () => {
    const messages: ModelMessage[] = Array.from({ length: 40 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user", content: `第 ${index} 条`,
    }));
    expect(prepareAgentContext(messages)).toEqual(messages);
  });

  it("removes only whole oldest turns within budget and never mutates the history", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "old JD ".repeat(300) },
      { role: "assistant", content: "Old answer" },
      { role: "user", content: "Only Hangzhou, do not submit applications" },
      { role: "assistant", content: "Confirmed" },
      { role: "user", content: "Continue" },
    ];
    const original = structuredClone(messages);
    const context = prepareAgentContext(messages, 150);
    expect(context).toEqual(messages.slice(2));
    expect(messages).toEqual(original);
    expect(context.reduce((sum, message) => sum + estimateContextTokens(message) + 8, 0)).toBeLessThanOrEqual(150);
  });

  it("counts Chinese and emoji conservatively instead of treating four characters as one token", () => {
    expect(estimateContextTokens("校招岗位")).toBeGreaterThanOrEqual(12);
    expect(estimateContextTokens("😀")).toBeGreaterThanOrEqual(4);
  });

  it("keeps the complete approval chain even when it precedes the latest user turn", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "old ".repeat(500) },
      { role: "assistant", content: "old answer" },
      { role: "user", content: "Create a resume" },
      { role: "assistant", content: [
        { type: "tool-call", toolCallId: "call", toolName: "create_resume", input: {} },
        { type: "tool-approval-request", toolCallId: "call", approvalId: "approval" },
      ] },
      { role: "tool", content: [{ type: "tool-approval-response", approvalId: "approval", approved: true }] },
      { role: "user", content: "Keep it concise" },
    ];
    expect(prepareAgentContext(messages, 350)).toEqual(messages.slice(2));
    expect(() => prepareAgentContext(messages, 50)).toThrow(AgentContextError);
  });

  it("can evict an old completed or denied call together with its initiating user turn", () => {
    for (const denied of [false, true]) {
      const messages: ModelMessage[] = [
        { role: "user", content: "old ".repeat(500) },
        { role: "assistant", content: [
          { type: "tool-call", toolCallId: "call", toolName: "write", input: {} },
          { type: "tool-approval-request", approvalId: "approval", toolCallId: "call" },
        ] },
        { role: "tool", content: denied
          ? [{ type: "tool-approval-response", approvalId: "approval", approved: false }]
          : [{ type: "tool-result", toolCallId: "call", toolName: "write", output: { type: "json", value: { id: "saved" } } }],
        },
        { role: "user", content: "New task" },
      ];
      expect(prepareAgentContext(messages, 100)).toEqual(messages.slice(-1));
    }
  });

  it("rejects an oversized current turn without silently truncating it", () => {
    const messages: ModelMessage[] = [{ role: "user", content: "简历".repeat(5_000) }];
    expect(() => prepareAgentContext(messages)).toThrow(AgentContextError);
    expect(messages[0].content).toHaveLength(10_000);
  });

  it("preserves current tool calls and their results when older turns are removed", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "old ".repeat(500) },
      { role: "assistant", content: [{ type: "reasoning", text: "old thoughts" }, { type: "text", text: "old answer" }] },
      { role: "user", content: "Read this resume" },
      { role: "assistant", content: [{ type: "tool-call", toolCallId: "read", toolName: "get_resume_context", input: { resumeVersionId: "v1" } }] },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "read", toolName: "get_resume_context", output: { type: "json", value: { resume: { id: "v1" } } } }] },
    ];
    expect(prepareAgentContext(messages, 250)).toEqual(messages.slice(2));
    expect(JSON.stringify(prepareAgentContext(messages))).not.toContain("old thoughts");
  });
});
