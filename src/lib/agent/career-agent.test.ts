import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";
import { MockLanguageModelV3 } from "ai/test";

import { createAiModel } from "@/lib/ai/client";
import { getAppData, updateResumeVersion } from "@/lib/repository";
import { createCareerAgent } from "./career-agent";
import { AgentContextError } from "./message-context";

vi.mock("@/lib/ai/client", () => ({ createAiModel: vi.fn(), getAiTemperature: vi.fn() }));
vi.mock("@/lib/repository");

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};
const content = { basics: { email: "private@example.com", phone: "private-phone" }, editor: { template: "ats" }, profile: { summary: "private-resume" } };
const version = { id: "v1", resumeId: "r1", jobId: "j1", name: "Resume", summary: "Summary", content,
  createdAt: new Date("2026-09-29"), updatedAt: new Date("2026-09-29") };

beforeEach(() => vi.resetAllMocks());

describe("Agent context integration", () => {
  it.each([
    ["configure_jd_optimization", { preferences: {} }, "create_jd_tailored_resume", { resumeVersionId: "v1", jobId: "j1" }],
    ["configure_interview", { task: "preparation", mode: "project" }, "create_interview_preparation", { resumeVersionId: "v1", jobId: "j1", focus: "project" }],
    ["configure_interview", { task: "simulation", mode: "project" }, "create_mock_interview", { resumeVersionId: "v1", jobId: "j1", mode: "project" }],
  ] as const)("offers the configured write after %s while still requiring approval", async (config, selection, write, input) => {
    const model = new MockLanguageModelV3({ doGenerate: {
      content: [{ type: "tool-call", toolCallId: "write", toolName: write, input: JSON.stringify(input) }],
      finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [],
    } });
    vi.mocked(createAiModel).mockReturnValue(model);
    const result = await createCareerAgent({ enabled: true } as never, "zh-CN").generate({ messages: [
      { role: "user", content: "Prepare this job application" },
      { role: "assistant", content: [{ type: "tool-call", toolCallId: "config", toolName: config, input: {} }] },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "config", toolName: config, output: { type: "json", value: selection } }] },
    ] });
    expect(model.doGenerateCalls[0].tools?.map(tool => tool.name)).toEqual([write]);
    expect(JSON.stringify(result.response.messages)).toContain('"type":"tool-approval-request"');
    expect(getAppData).not.toHaveBeenCalled();
    expect(updateResumeVersion).not.toHaveBeenCalled();
  });

  it("projects all six write results for the model while preserving UI artifacts and receipts", async () => {
    const agent = createCareerAgent({ enabled: true } as never, "zh-CN");
    const output = {
      operation: "created", version, href: "/resume/edit?version=v1",
      job: { id: "j1", company: "Company", title: "Role", jd: "private-jd" },
      application: { id: "a1", status: "APPLIED", notes: "private-notes" },
      record: { id: "p1", jobId: "j1", resumeVersionId: "v1", mode: "hr", context: content, content: "private-prep" },
      session: { id: "s1", jobId: "j1", resumeVersionId: "v1", mode: "hr", status: "IN_PROGRESS", context: content, questions: ["private-question"] },
    };
    const writeNames = ["update_application_card", "create_resume_from_experience", "create_jd_tailored_resume",
      "create_interview_preparation", "create_mock_interview", "update_resume_presentation"] as const;
    for (const name of writeNames) {
      const messages = [{ id: "a", role: "assistant", parts: [{ type: `tool-${name}`,
        toolCallId: name, state: "output-available", input: { template: "ats" }, output }] }] as UIMessage[];
      const original = structuredClone(messages);
      const modelMessages = await convertToModelMessages(messages, { tools: agent.tools });
      expect(JSON.stringify(modelMessages)).not.toContain("private-");
      expect(JSON.stringify(modelMessages)).not.toContain("private@example.com");
      expect(JSON.stringify(modelMessages)).toContain('"operation":"created"');
      expect(JSON.stringify(modelMessages)).toContain(name === "update_application_card" ? "a1" : output.href);
      expect(messages).toEqual(original);
    }
  });

  it("resumes an approved write once and only sends a compact result to the next model step", async () => {
    const model = new MockLanguageModelV3({ doGenerate: {
      content: [{ type: "text", text: "Template updated" }],
      finishReason: { unified: "stop", raw: undefined }, usage, warnings: [],
    } });
    vi.mocked(createAiModel).mockReturnValue(model);
    vi.mocked(getAppData).mockResolvedValue({ resume: version, versions: [] } as never);
    vi.mocked(updateResumeVersion).mockResolvedValue(version as never);
    const agent = createCareerAgent({ enabled: true } as never, "zh-CN");
    const result = await agent.generate({ messages: approvedTemplateChange() });
    expect(updateResumeVersion).toHaveBeenCalledTimes(1);
    expect(result.text).toBe("Template updated");
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('"operation":"updated"');
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).not.toContain("private@example.com");
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).not.toContain("private-resume");
  });

  it("checks the budget before an approved write can execute", async () => {
    const model = new MockLanguageModelV3();
    vi.mocked(createAiModel).mockReturnValue(model);
    const messages = approvedTemplateChange();
    messages[0] = { role: "user", content: "简历".repeat(5_000) };
    await expect(createCareerAgent({ enabled: true } as never, "zh-CN").generate({ messages })).rejects.toBeInstanceOf(AgentContextError);
    expect(getAppData).not.toHaveBeenCalled();
    expect(updateResumeVersion).not.toHaveBeenCalled();
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("rechecks growing read results before the next model invocation", async () => {
    const model = new MockLanguageModelV3({ doGenerate: {
      content: [{ type: "tool-call", toolCallId: "read", toolName: "get_resume_context", input: '{"resumeVersionId":"v1"}' }],
      finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [],
    } });
    vi.mocked(createAiModel).mockReturnValue(model);
    vi.mocked(getAppData).mockResolvedValue({ resume: { ...version,
      content: { ...content, profile: { summary: "项目经历".repeat(5_000) } } }, versions: [] } as never);
    await expect(createCareerAgent({ enabled: true } as never, "zh-CN").generate({ prompt: "Read my resume" })).rejects.toBeInstanceOf(AgentContextError);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(updateResumeVersion).not.toHaveBeenCalled();
  });
});

function approvedTemplateChange(): ModelMessage[] {
  return [
    { role: "user", content: "Change the template" },
    { role: "assistant", content: [
      { type: "tool-call", toolCallId: "write", toolName: "update_resume_presentation", input: { resumeVersionId: "v1", template: "ats" } },
      { type: "tool-approval-request", toolCallId: "write", approvalId: "approval" },
    ] },
    { role: "tool", content: [{ type: "tool-approval-response", approvalId: "approval", approved: true }] },
  ];
}
