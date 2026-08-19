import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createResumeVersion: vi.fn(),
  deleteOptimizedResumeVersions: vi.fn(),
}));

vi.mock("@/lib/repository", () => ({
  createResumeVersion: mocks.createResumeVersion,
  deleteOptimizedResumeVersions: mocks.deleteOptimizedResumeVersions,
}));

import { POST } from "./route";

const resume = {
  basics: { name: "陈同学", email: "", phone: "", city: "", links: [] },
  profile: { title: "产品经理", summary: "关注 AI 产品。" },
  education: [],
  experiences: [],
  internships: [],
  projects: [],
  skills: ["AI 产品"],
  awards: [],
  selfReview: "",
};

describe("resume versions route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists reviewed optimization metadata with the source resume", async () => {
    const optimizationMeta = {
      company: "",
      title: "",
      keywords: ["AI 产品"],
      summary: "优化成果表达。",
      changes: ["自我评价"],
      versionName: "AI优化-陈同学",
    };
    mocks.createResumeVersion.mockResolvedValue({
      id: "version-1",
      resumeId: "resume-1",
      jobId: null,
      name: optimizationMeta.versionName,
      summary: optimizationMeta.summary,
      content: resume,
      createdAt: new Date("2026-07-28T00:00:00.000Z"),
      updatedAt: new Date("2026-07-28T00:00:00.000Z"),
    });

    const response = await POST(jsonRequest({
      name: optimizationMeta.versionName,
      summary: optimizationMeta.summary,
      content: resume,
      baseResume: resume,
      optimizationMeta,
      sourceResumeId: "resume-1",
    }));

    expect(response.status).toBe(200);
    expect(mocks.createResumeVersion).toHaveBeenCalledWith({
      name: optimizationMeta.versionName,
      summary: optimizationMeta.summary,
      content: expect.objectContaining(resume),
      baseResume: expect.objectContaining(resume),
      optimizationMeta,
      sourceResumeId: "resume-1",
    });
  });

  it("rejects invalid optimization metadata", async () => {
    const response = await POST(jsonRequest({
      content: resume,
      baseResume: resume,
      optimizationMeta: { summary: "missing fields" },
    }));

    expect(response.status).toBe(400);
    expect(mocks.createResumeVersion).not.toHaveBeenCalled();
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/resume-versions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
