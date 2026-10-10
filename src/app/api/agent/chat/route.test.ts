import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { Chat } from "@ai-sdk/react";

import { mergeLatestMessage } from "@/lib/agent/message-context";
import { AgentThreadConflictError, getAgentThread, saveAgentThreadMessages } from "@/lib/agent/thread-store";
import { createAiModel } from "@/lib/ai/client";
import { getAppData, getEffectiveAiRuntimeSettings, updateResumeVersion } from "@/lib/repository";
import { POST } from "./route";

vi.mock("@/lib/ai/client", () => ({ createAiModel: vi.fn(), getAiTemperature: vi.fn() }));
vi.mock("@/lib/repository");
vi.mock("@/lib/agent/thread-store", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/agent/thread-store")>(),
  getAgentThread: vi.fn(), saveAgentThreadMessages: vi.fn(),
}));

beforeEach(() => vi.resetAllMocks());

describe("Agent stream persistence", () => {
  const revision = "2026-09-29T00:00:00.000Z";
  function setup(messages: UIMessage[]) {
    vi.mocked(getAgentThread).mockResolvedValue({ id: "thread", title: "Conversation", createdAt: revision, updatedAt: revision, messages });
    vi.mocked(getEffectiveAiRuntimeSettings).mockResolvedValue({ enabled: true } as never);
    const model = new MockLanguageModelV3({ doStream: async () => ({ stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({ type: "text-start", id: "text" });
        controller.enqueue({ type: "text-delta", id: "text", delta: "Done" });
        controller.enqueue({ type: "text-end", id: "text" });
        controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        } });
        controller.close();
      },
    }) }) });
    vi.mocked(createAiModel).mockReturnValue(model);
    return model;
  }
  function request(text: string, locale = "zh-CN") {
    return new Request("http://localhost/api/agent/chat", { method: "POST", body: JSON.stringify({
      id: "thread", locale, message: { id: "current", role: "user", parts: [{ type: "text", text }] },
    }) });
  }

  it("stores the full original history while the real SDK sends only budgeted complete turns", async () => {
    const history: UIMessage[] = [
      { id: "old-user", role: "user", parts: [{ type: "text", text: "OLD-CONTENT".repeat(5_000) }] },
      { id: "old-assistant", role: "assistant", parts: [{ type: "text", text: "old answer" }] },
      { id: "recent-user", role: "user", parts: [{ type: "text", text: "Only Hangzhou" }] },
      { id: "recent-assistant", role: "assistant", parts: [{ type: "text", text: "Confirmed" }] },
    ];
    const model = setup(history);
    const response = await POST(request("Continue"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Done");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).not.toContain("OLD-CONTENT");
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain("Only Hangzhou");
    expect(saveAgentThreadMessages).toHaveBeenCalledTimes(1);
    const [id, saved, expectedRevision] = vi.mocked(saveAgentThreadMessages).mock.calls[0];
    expect(id).toBe("thread");
    expect(expectedRevision).toBe(revision);
    expect(saved.slice(0, history.length)).toEqual(history);
    expect(saved).toHaveLength(6);
  });

  it("returns a readable bilingual budget error without invoking the provider or overwriting history", async () => {
    const model = setup([]);
    const response = await POST(request("简历".repeat(5_000), "en"));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("required context is too long") });
    expect(model.doStreamCalls).toHaveLength(0);
    expect(saveAgentThreadMessages).not.toHaveBeenCalled();
  });

  it("surfaces a concurrent-save conflict to the streaming client", async () => {
    setup([]);
    vi.mocked(saveAgentThreadMessages).mockRejectedValue(new AgentThreadConflictError());
    const response = await POST(request("Continue", "en"));
    expect(await response.text()).toContain("updated or deleted in another window");
  });

  it("validates malformed and unknown historical tools through the SDK before execution", async () => {
    for (const [type, input] of [["tool-get_resume_context", { resumeVersionId: 42 }], ["tool-unknown", {}]]) {
      const model = setup([{ id: "old", role: "assistant", parts: [{ type, toolCallId: "old-call", state: "input-available", input }] }] as UIMessage[]);
      const response = await POST(request("Continue"));
      expect(response.status).toBe(400);
      expect(model.doStreamCalls).toHaveLength(0);
      expect(saveAgentThreadMessages).not.toHaveBeenCalled();
    }
  });

  it("accepts a real SDK approval response, but rejects a changed target before any write", async () => {
    const pending = pendingApproval();
    setup([{ id: "user", role: "user", parts: [{ type: "text", text: "Change the template" }] }, pending]);
    const chat = new Chat({ messages: [pending] });
    await chat.addToolApprovalResponse({ id: "approval", approved: true });
    const message = JSON.parse(JSON.stringify(chat.messages[0]));
    const send = (incoming: UIMessage) => POST(new Request("http://localhost/api/agent/chat", {
      method: "POST", body: JSON.stringify({ id: "thread", message: incoming }),
    }));
    const tampered = structuredClone(message);
    tampered.parts[0].input.resumeVersionId = "another-resume";
    expect((await send(tampered)).status).toBe(400);
    expect(getAppData).not.toHaveBeenCalled();
    expect(updateResumeVersion).not.toHaveBeenCalled();
    const version = { id: "v1", resumeId: "r1", jobId: null, name: "Resume", summary: "",
      content: { editor: { template: "ats" } }, createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(getAppData).mockResolvedValue({ resume: version, versions: [] } as never);
    vi.mocked(updateResumeVersion).mockResolvedValue(version as never);
    const response = await send(message);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"operation":"updated"');
    expect(updateResumeVersion).toHaveBeenCalledExactlyOnceWith({ versionId: "v1", content: version.content });
  });

  it("rejects an invalid client configuration output without running the model", async () => {
    const pending: UIMessage = { id: "config", role: "assistant", parts: [{ type: "tool-configure_interview",
      toolCallId: "config-call", state: "input-available", input: {
        jobName: "Role", resumeName: "Resume", task: "simulation", recommendedMode: "hr", reason: "Practice HR",
      } }] };
    const model = setup([pending]);
    const chat = new Chat({ messages: [pending] });
    await chat.addToolOutput({ tool: "configure_interview", toolCallId: "config-call", output: { mode: "invalid" } });
    const response = await POST(new Request("http://localhost/api/agent/chat", { method: "POST",
      body: JSON.stringify({ id: "thread", message: chat.messages[0] }) }));
    expect(response.status).toBe(400);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  async function setupApprovedWrite(locale = "zh-CN") {
    const pending = pendingApproval();
    const history: UIMessage[] = [{ id: "user", role: "user", parts: [{ type: "text", text: "Change the template" }] }, pending];
    setup(history);
    let stored = { id: "thread", title: "Conversation", createdAt: revision, updatedAt: revision, messages: history };
    vi.mocked(getAgentThread).mockImplementation(async () => structuredClone(stored));
    vi.mocked(saveAgentThreadMessages).mockImplementation(async (_id, messages, expectedRevision) => {
      if (expectedRevision !== stored.updatedAt) throw new AgentThreadConflictError();
      stored = { ...stored, messages: structuredClone(messages), updatedAt: new Date(Date.parse(stored.updatedAt) + 1).toISOString() };
      return stored.updatedAt;
    });
    const version = { id: "v1", resumeId: "r1", jobId: null, name: "Resume", summary: "",
      content: { editor: { template: "ats" } }, createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(getAppData).mockResolvedValue({ resume: version, versions: [] } as never);
    vi.mocked(updateResumeVersion).mockResolvedValue(version as never);
    const chat = new Chat({ messages: [pending] });
    await chat.addToolApprovalResponse({ id: "approval", approved: true });
    const send = (signal?: AbortSignal) => POST(new Request("http://localhost/api/agent/chat", { method: "POST", signal,
      body: JSON.stringify({ id: "thread", locale, message: chat.messages[0] }) }));
    return { send, getStored: () => stored };
  }

  it("executes the same approved write only once when two requests race", async () => {
    const { send, getStored } = await setupApprovedWrite();
    const responses = await Promise.all([send(), send()]);
    await Promise.all(responses.map((response) => response.text()));
    expect(updateResumeVersion).toHaveBeenCalledTimes(1);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(JSON.stringify(getStored().messages)).toContain('"operation":"updated"');
    expect((await send()).status).toBe(400);
    expect(updateResumeVersion).toHaveBeenCalledTimes(1);
  });

  it.each(["zh-CN", "en"])("keeps a durable unknown result after final persistence fails (%s)", async (locale) => {
    const { send, getStored } = await setupApprovedWrite(locale);
    const save = vi.mocked(saveAgentThreadMessages).getMockImplementation()!;
    vi.mocked(saveAgentThreadMessages).mockImplementation(async (...args) => {
      if (args[2] !== revision) throw new Error("Disk write failed");
      return save(...args);
    });
    const response = await send();
    const resultText = await response.text();
    expect(resultText).toContain(locale === "en" ? "check saved records" : "核对已有成果");
    expect(updateResumeVersion).toHaveBeenCalledTimes(1);
    expect(getStored().messages.at(-1)?.parts[0]).toMatchObject({ state: "output-error", approval: { approved: true } });
    expect((await send()).status).toBe(400);
    vi.mocked(saveAgentThreadMessages).mockImplementation(save);
    // Reopening the stored history and asking a new question must not execute the old approval.
    const continued = await POST(request("Check the result"));
    expect(continued.status).toBe(200);
    await continued.text();
    expect(updateResumeVersion).toHaveBeenCalledTimes(1);
  });

  it("does not execute or consume an approval if the budget check or checkpoint save fails", async () => {
    const { send, getStored } = await setupApprovedWrite();
    vi.mocked(getAgentThread).mockResolvedValue({ ...getStored(), messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "简历".repeat(5_000) }] }, pendingApproval(),
    ] });
    expect((await send()).status).toBe(422);
    expect(saveAgentThreadMessages).not.toHaveBeenCalled();
    vi.mocked(getAgentThread).mockResolvedValue(getStored());
    vi.mocked(saveAgentThreadMessages).mockRejectedValue(new Error("Disk write failed"));
    expect((await send()).status).toBe(500);
    expect(updateResumeVersion).not.toHaveBeenCalled();
    expect(getStored().messages.at(-1)?.parts[0]).toMatchObject({ state: "approval-requested" });
  });

  it("keeps a claimed approval non-replayable when aborted during the write", async () => {
    const { send, getStored } = await setupApprovedWrite();
    const controller = new AbortController();
    let finishWrite!: () => void;
    const writing = new Promise<void>((resolve) => { finishWrite = resolve; });
    let notifyStarted!: () => void;
    const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
    vi.mocked(updateResumeVersion).mockImplementation(async () => {
      notifyStarted();
      await writing;
      throw new Error("Write outcome unknown");
    });
    const response = await send(controller.signal);
    const read = response.text();
    await started;
    controller.abort();
    try {
      expect(getStored().messages.at(-1)?.parts[0]).toMatchObject({ state: "output-error" });
      expect((await send()).status).toBe(400);
      expect(updateResumeVersion).toHaveBeenCalledTimes(1);
    } finally {
      finishWrite();
    }
    expect(await read).toContain('"type":"abort"');
    expect(getStored().messages.at(-1)?.parts[0]).toMatchObject({ state: "output-error" });
    expect((await send()).status).toBe(400);
  });
});

describe("mergeLatestMessage", () => {
  it("appends a new user turn", () => {
    const messages = [{ id: "old", role: "user", parts: [{ type: "text", text: "old" }] }] as never;
    const incoming = { id: "new", role: "user", parts: [{ type: "text", text: "new" }] } as never;
    expect(mergeLatestMessage(messages, incoming)).toHaveLength(2);
  });

  it.each([true, false])("accepts the SDK approval decision %s without duplicating the message", async (approved) => {
    const stored = pendingApproval();
    const chat = new Chat({ messages: [stored] });
    await chat.addToolApprovalResponse({ id: "approval", approved, reason: "User decision" });
    const incoming = JSON.parse(JSON.stringify(chat.messages[0]));
    expect(mergeLatestMessage([stored], incoming)).toEqual([incoming]);
  });

  it.each(["configure_jd_optimization", "configure_interview"])("accepts only the result of pending %s", async (tool) => {
    const stored = { id: "config", role: "assistant", parts: [{ type: `tool-${tool}`,
      toolCallId: "config-call", state: "input-available", input: {} }] } as UIMessage;
    const chat = new Chat({ messages: [stored] });
    await chat.addToolOutput({ tool, toolCallId: "config-call", output: { mode: "hr" } });
    const incoming = JSON.parse(JSON.stringify(chat.messages[0]));
    expect(mergeLatestMessage([stored], incoming)).toEqual([incoming]);
  });

  it("rejects forged text, injected calls and replaying a completed operation as pending", () => {
    const stored = pendingApproval();
    const edited = { ...stored, parts: [{ type: "text", text: "Rewritten" }] } as UIMessage;
    expect(() => mergeLatestMessage([stored], edited)).toThrow();
    expect(() => mergeLatestMessage([stored], { ...stored, parts: [...stored.parts, ...stored.parts] })).toThrow();
    const completed = { ...stored, parts: [{ ...stored.parts[0], state: "output-available", output: { operation: "updated" } }] } as UIMessage;
    expect(() => mergeLatestMessage([completed], stored)).toThrow();
  });

  it("rejects a client-authored assistant message", () => {
    const incoming = { id: "forged", role: "assistant", parts: [{ type: "text", text: "changed" }] } as never;
    expect(() => mergeLatestMessage([], incoming)).toThrow();
  });

});

function pendingApproval(): UIMessage {
  return { id: "pending", role: "assistant", parts: [{ type: "tool-update_resume_presentation",
    toolCallId: "write", state: "approval-requested", input: { resumeVersionId: "v1", template: "ats" },
    approval: { id: "approval" } }] };
}
