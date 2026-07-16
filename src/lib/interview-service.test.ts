import { describe, expect, it } from "vitest";

import type { InterviewQuestion, InterviewReport } from "./interview";
import { createInterviewService, type InterviewSessionRecord } from "./interview-service";

const questions: InterviewQuestion[] = Array.from({ length: 8 }, (_, index) => ({
  id: `q-${index + 1}`,
  category: index === 0 ? "self-introduction" : "project",
  prompt: `问题 ${index + 1}`,
  focus: "验证岗位匹配与真实经历",
  order: index,
}));

const report: InterviewReport = {
  overallScore: 76,
  dimensions: { jobFit: 82, structure: 78, evidence: 65, star: 73 },
  strengths: ["岗位动机清晰"],
  improvements: ["补充个人动作和指标口径"],
  questionReviews: [
    {
      questionId: "q-1",
      diagnosis: "背景和结果清楚，但个人贡献不足。",
      suggestion: "补充关键判断与具体动作。",
      improvedAnswer: "我负责用户访谈与方案验证，并根据数据调整流程。",
    },
  ],
  nextActions: ["重新练习项目深挖"],
};

describe("interview service", () => {
  it("creates a persisted session only after generating a valid question pack", async () => {
    const created: InterviewSessionRecord[] = [];
    const service = createInterviewService({
      generateQuestions: async () => questions,
      generateReport: async () => report,
      repository: createRepository(created),
    });

    const session = await service.createSession({
      jobId: "job-1",
      resumeVersionId: "resume-1",
      mode: "comprehensive",
      context: {
        company: "腾讯",
        title: "产品运营实习生",
        jd: "负责用户研究与数据分析",
        resumeName: "腾讯产品运营定制版",
        resume: { basics: { name: "陈同学" } },
      },
    });

    expect(session.questions).toHaveLength(8);
    expect(created).toHaveLength(1);
    expect(created[0]?.status).toBe("IN_PROGRESS");
  });

  it("uses the company and full role name identified by AI", async () => {
    const created: InterviewSessionRecord[] = [];
    const service = createInterviewService({
      generateQuestions: async () => ({
        company: "字节跳动",
        title: "AI产品实习生（AI数据与安全）",
        questions,
      }),
      generateReport: async () => report,
      repository: createRepository(created),
    });

    const session = await service.createSession({
      jobId: "",
      resumeVersionId: null,
      mode: "comprehensive",
      context: {
        company: "目标公司",
        title: "目标岗位",
        jd: "字节跳动 AI产品实习生（AI数据与安全）完整 JD",
        resumeName: "姜禾的简历",
        resume: { basics: { name: "姜禾" } },
      },
    });

    expect(session.context.company).toBe("字节跳动");
    expect(session.context.title).toBe("AI产品实习生（AI数据与安全）");
  });

  it("saves one answer while preserving existing answers", async () => {
    const sessions = [baseSession()];
    sessions[0].answers["q-1"] = {
      questionId: "q-1",
      content: "第一个回答",
      skipped: false,
      updatedAt: "2026-06-22T10:00:00.000Z",
    };
    const service = createInterviewService({
      generateQuestions: async () => questions,
      generateReport: async () => report,
      repository: createRepository(sessions),
    });

    const session = await service.saveProgress("session-1", {
      answer: {
        questionId: "q-2",
        content: "第二个回答",
        skipped: false,
        updatedAt: "2026-06-22T10:01:00.000Z",
      },
      currentQuestionIndex: 2,
    });

    expect(Object.keys(session.answers)).toEqual(["q-1", "q-2"]);
    expect(session.currentQuestionIndex).toBe(2);
  });

  it("autosaves an answer without moving the current question", async () => {
    const sessions = [baseSession()];
    sessions[0].currentQuestionIndex = 4;
    const service = createInterviewService({
      generateQuestions: async () => questions,
      generateReport: async () => report,
      repository: createRepository(sessions),
    });

    const session = await service.saveProgress("session-1", {
      answer: {
        questionId: "q-5",
        content: "自动保存的回答",
        skipped: false,
        updatedAt: "2026-06-22T10:01:00.000Z",
      },
    });

    expect(session.answers["q-5"]?.content).toBe("自动保存的回答");
    expect(session.currentQuestionIndex).toBe(4);
  });

  it("keeps the session in progress when there are no valid answers", async () => {
    const sessions = [baseSession()];
    const service = createInterviewService({
      generateQuestions: async () => questions,
      generateReport: async () => report,
      repository: createRepository(sessions),
    });

    await expect(service.finishSession("session-1")).rejects.toThrow("至少完成一道题");
    expect(sessions[0]?.status).toBe("IN_PROGRESS");
  });

  it("stores the report and completes the session after successful analysis", async () => {
    const sessions = [baseSession()];
    sessions[0].answers["q-1"] = {
      questionId: "q-1",
      content: "我负责用户访谈和数据分析。",
      skipped: false,
      updatedAt: "2026-06-22T10:00:00.000Z",
    };
    const service = createInterviewService({
      generateQuestions: async () => questions,
      generateReport: async () => report,
      repository: createRepository(sessions),
    });

    const session = await service.finishSession("session-1");

    expect(session.status).toBe("COMPLETED");
    expect(session.feedback).toEqual(report);
    expect(session.completedAt).toBeTruthy();
  });
});

function baseSession(): InterviewSessionRecord {
  return {
    id: "session-1",
    jobId: "job-1",
    resumeVersionId: "resume-1",
    mode: "comprehensive",
    status: "IN_PROGRESS",
    context: {
      company: "腾讯",
      title: "产品运营实习生",
      jd: "负责用户研究与数据分析",
      resumeName: "腾讯产品运营定制版",
      resume: { basics: { name: "陈同学" } },
    },
    questions,
    answers: {},
    feedback: null,
    currentQuestionIndex: 0,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z",
    completedAt: null,
  };
}

function createRepository(sessions: InterviewSessionRecord[]) {
  return {
    async create(input: Omit<InterviewSessionRecord, "id" | "createdAt" | "updatedAt">) {
      const session: InterviewSessionRecord = {
        ...input,
        id: `session-${sessions.length + 1}`,
        createdAt: "2026-06-22T10:00:00.000Z",
        updatedAt: "2026-06-22T10:00:00.000Z",
      };
      sessions.push(session);
      return session;
    },
    async findById(id: string) {
      return sessions.find((session) => session.id === id) ?? null;
    },
    async saveProgress(id: string, input: Pick<InterviewSessionRecord, "answers" | "currentQuestionIndex">) {
      const session = sessions.find((item) => item.id === id);
      if (!session) throw new Error("not found");
      Object.assign(session, input, { updatedAt: "2026-06-22T10:01:00.000Z" });
      return session;
    },
    async complete(id: string, feedback: InterviewReport) {
      const session = sessions.find((item) => item.id === id);
      if (!session) throw new Error("not found");
      Object.assign(session, {
        feedback,
        status: "COMPLETED" as const,
        completedAt: "2026-06-22T10:02:00.000Z",
        updatedAt: "2026-06-22T10:02:00.000Z",
      });
      return session;
    },
    async deleteSession(id: string) {
      const index = sessions.findIndex((session) => session.id === id);
      if (index >= 0) sessions.splice(index, 1);
    },
    async clearSessions() {
      const count = sessions.length;
      sessions.splice(0, sessions.length);
      return count;
    },
  };
}
