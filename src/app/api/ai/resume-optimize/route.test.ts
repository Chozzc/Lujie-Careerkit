import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  optimizeResumeWithAI: vi.fn(),
  createResumeVersion: vi.fn(),
  getTailoringBaseResume: vi.fn(),
}));

vi.mock("@/lib/ai-service", () => ({
  optimizeResumeWithAI: mocks.optimizeResumeWithAI,
}));
vi.mock("@/lib/repository", () => ({
  createResumeVersion: mocks.createResumeVersion,
  getTailoringBaseResume: mocks.getTailoringBaseResume,
}));

import { GET, POST } from "./route";

const baseResume = {
  basics: { name: "陈同学", email: "", phone: "", city: "", links: [] },
  profile: { title: "产品经理", summary: "关注 AI 产品。" },
  education: [],
  experiences: [],
  internships: [],
  projects: [],
  skills: ["AI 产品", "Prompt"],
  awards: [],
  selfReview: "",
};

describe("resume AI optimization route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTailoringBaseResume.mockResolvedValue(baseResume);
  });

  it("does not create a resume version when AI falls back", async () => {
    mocks.optimizeResumeWithAI.mockResolvedValue({
      source: "fallback",
      message: "缺少 API Key",
      data: baseResume,
    });

    const response = await POST(jsonRequest({ resumeContent: baseResume }));

    expect(response.status).toBe(503);
    expect(mocks.createResumeVersion).not.toHaveBeenCalled();
  });

  it("creates a new AI optimized resume version when AI succeeds", async () => {
    const optimizedResume = {
      ...baseResume,
      profile: { ...baseResume.profile, summary: "具备 AI 产品规划与 Prompt 迭代经验。" },
    };
    mocks.optimizeResumeWithAI.mockResolvedValue({
      source: "ai",
      message: "简历优化完成",
      data: optimizedResume,
    });
    mocks.createResumeVersion.mockResolvedValue({ id: "version-1", content: optimizedResume });

    const response = await POST(jsonRequest({ resumeContent: baseResume }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.optimizeResumeWithAI).toHaveBeenCalledWith({ resume: baseResume });
    expect(mocks.createResumeVersion).toHaveBeenCalledWith({
      name: "AI优化-陈同学的简历",
      summary: "AI 自动优化生成的简历版本，请在编辑器中复核后使用。",
      content: optimizedResume,
      baseResume,
      optimizationMeta: {
        company: "",
        title: "",
        keywords: [],
        summary: "",
        changes: [],
        versionName: "",
      },
    });
    expect(body.version).toEqual({ id: "version-1", content: optimizedResume });
  });

  it("warms the route without calling the model", async () => {
    const response = await GET();

    expect(response.status).toBe(204);
    expect(mocks.getTailoringBaseResume).not.toHaveBeenCalled();
    expect(mocks.optimizeResumeWithAI).not.toHaveBeenCalled();
    expect(mocks.createResumeVersion).not.toHaveBeenCalled();
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/resume-optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
