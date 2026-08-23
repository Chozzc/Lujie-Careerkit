import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  resume: { findFirst: vi.fn() },
  settings: { upsert: vi.fn(), update: vi.fn() },
  job: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  interviewSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("./db", () => ({ prisma: db }));
vi.mock("./ai/settings-migration", () => ({ getAiSettingsMaintenancePatch: () => null }));

import { deleteInterviewSessionSection, interviewSessionRepository } from "./repository";

describe("interview job attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.resume.findFirst.mockResolvedValue({ id: "resume-1" });
    db.settings.upsert.mockResolvedValue({
      aiProvider: "openai",
      aiModel: "gpt-4o-mini",
      aiBaseUrl: "https://api.openai.com/v1",
      aiApiKey: "",
      aiEnabled: true,
    });
  });

  it("reuses the existing Job by identical JD and keeps its canonical company and title", async () => {
    const job = { id: "job-byte", company: "字节跳动", title: "AI产品实习生-AI数据与安全", jd: "相同 JD" };
    db.job.findFirst.mockResolvedValue(job);
    db.interviewSession.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      id: "session-1",
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
      updatedAt: new Date("2026-08-23T00:00:00.000Z"),
      completedAt: null,
      job,
      resumeVersion: null,
    }));

    const session = await interviewSessionRepository.create({
      jobId: null,
      resumeVersionId: null,
      mode: "comprehensive",
      status: "IN_PROGRESS",
      context: { company: "ByteIntern", title: "AI产品实习生", jd: "相同 JD", resumeName: "主简历", resume: {} },
      questions: [],
      answers: {},
      feedback: null,
      currentQuestionIndex: 0,
      completedAt: null,
    });

    expect(db.job.findFirst).toHaveBeenCalledWith({ where: { jd: "相同 JD" }, orderBy: { updatedAt: "desc" } });
    expect(db.job.create).not.toHaveBeenCalled();
    expect(db.interviewSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ jobId: "job-byte", context: expect.objectContaining({ company: "字节跳动", title: "AI产品实习生-AI数据与安全" }) }),
    }));
    expect(session.context.company).toBe("字节跳动");
  });

  it("deletes questions without deleting a saved AI review", async () => {
    const feedback = {
      overallScore: 80,
      dimensions: { jobFit: 80, structure: 80, evidence: 80, star: 80 },
      strengths: ["表达清晰"],
      improvements: ["补充证据"],
      questionReviews: [{ questionId: "q1", diagnosis: "结构清楚", suggestion: "增加数据", improvedAnswer: "补充量化结果" }],
      nextActions: ["复习项目经历"],
    };
    db.interviewSession.findUnique.mockResolvedValue({
      id: "session-1",
      questions: [{ id: "q1", category: "general", prompt: "请介绍项目经历", focus: "项目能力", order: 0 }],
      feedback,
    });
    db.interviewSession.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "session-1",
      jobId: null,
      resumeVersionId: null,
      mode: "comprehensive",
      status: "COMPLETED",
      context: { company: "腾讯", title: "产品经理", jd: "岗位描述", resumeName: "主简历", resume: {} },
      questions: data.questions,
      answers: data.answers,
      feedback,
      currentQuestionIndex: 0,
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
      updatedAt: new Date("2026-08-23T00:00:00.000Z"),
      completedAt: new Date("2026-08-23T00:00:00.000Z"),
      job: null,
      resumeVersion: null,
    }));

    const session = await deleteInterviewSessionSection("session-1", "questions");

    expect(db.interviewSession.delete).not.toHaveBeenCalled();
    expect(db.interviewSession.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { questions: [], answers: {}, currentQuestionIndex: 0 },
    }));
    expect(session?.questions).toEqual([]);
    expect(session?.feedback?.overallScore).toBe(80);
  });
});
