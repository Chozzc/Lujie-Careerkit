import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tailorResumeWithAI: vi.fn(),
  createTailoredVersionForJob: vi.fn(),
  getTailoringBaseResume: vi.fn(),
  saveJobAnalysis: vi.fn(),
}));

vi.mock("@/lib/ai-service", () => ({
  tailorResumeWithAI: mocks.tailorResumeWithAI,
}));
vi.mock("@/lib/repository", () => ({
  createTailoredVersionForJob: mocks.createTailoredVersionForJob,
  getTailoringBaseResume: mocks.getTailoringBaseResume,
  saveJobAnalysis: mocks.saveJobAnalysis,
}));

import { GET, POST } from "./route";

const analysis = {
  company: "美团",
  title: "后端开发实习生",
  deadline: null,
  requirements: ["Java"],
  keywords: ["Java"],
  bonusPoints: [],
  risks: [],
  suggestions: ["突出项目"],
};

describe("resume tailoring route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTailoringBaseResume.mockResolvedValue({ basics: { name: "陈同学" } });
  });

  it("does not create an optimized version when the model falls back", async () => {
    mocks.tailorResumeWithAI.mockResolvedValue({
      source: "fallback",
      message: "AI 服务触发限流。",
      data: { basics: { name: "陈同学" } },
    });

    const response = await POST(jsonRequest({ jobId: "job-1", jd: "美团 - 后端开发实习生", analysis }));

    expect(response.status).toBe(503);
    expect(mocks.saveJobAnalysis).not.toHaveBeenCalled();
    expect(mocks.createTailoredVersionForJob).not.toHaveBeenCalled();
  });

  it("warms the route without calling the model", async () => {
    const response = await GET();

    expect(response.status).toBe(204);
    expect(mocks.getTailoringBaseResume).not.toHaveBeenCalled();
    expect(mocks.tailorResumeWithAI).not.toHaveBeenCalled();
    expect(mocks.saveJobAnalysis).not.toHaveBeenCalled();
    expect(mocks.createTailoredVersionForJob).not.toHaveBeenCalled();
  });

  it("rejects incomplete analysis before it can be persisted", async () => {
    const response = await POST(jsonRequest({
      jobId: "job-1",
      jd: "美团 - 后端开发实习生",
      analysis: { company: "美团", title: "后端开发实习生", requirements: [], keywords: [], suggestions: [] },
    }));

    expect(response.status).toBe(400);
    expect(mocks.tailorResumeWithAI).not.toHaveBeenCalled();
    expect(mocks.saveJobAnalysis).not.toHaveBeenCalled();
  });

  it("rejects a blank JD before calling the model", async () => {
    const response = await POST(jsonRequest({ jobId: "job-1", jd: "   " }));

    expect(response.status).toBe(400);
    expect(mocks.tailorResumeWithAI).not.toHaveBeenCalled();
  });

  it("uses local JD context and calls only the tailoring model when analysis is omitted", async () => {
    mocks.tailorResumeWithAI.mockResolvedValue({
      source: "ai",
      message: "简历优化完成",
      data: { basics: { name: "陈同学" } },
    });
    mocks.createTailoredVersionForJob.mockResolvedValue({ id: "version-1" });

    const response = await POST(jsonRequest({
      jobId: "job-1",
      jd: "美团 - 后端开发实习生\n要求 Java、Spring 和 SQL",
    }));

    expect(response.status).toBe(200);
    expect(mocks.tailorResumeWithAI).toHaveBeenCalledOnce();
    expect(mocks.tailorResumeWithAI).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({
          company: "待填写公司",
          title: "待分析岗位",
          keywords: expect.arrayContaining(["Java", "Spring", "SQL"]),
        }),
      }),
    );
    expect(mocks.saveJobAnalysis).toHaveBeenCalledWith(
      "job-1",
      expect.not.objectContaining({ matchScore: expect.anything() }),
    );
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/resume-tailor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
