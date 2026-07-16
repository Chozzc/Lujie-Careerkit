import { describe, expect, it } from "vitest";

import {
  createInterviewRetryInput,
  createInterviewSessionInputSchema,
  interviewReportSchema,
  interviewQuestionNavTitle,
  mergeInterviewAnswer,
  normalizeInterviewAnswers,
  normalizeInterviewQuestions,
  parseInterviewQuestionPack,
  questionCountForMode,
  saveInterviewProgressInputSchema,
  screenForInterviewSession,
} from "./interview";

describe("interview domain", () => {
  it("uses eight questions for comprehensive practice and six for focused modes", () => {
    expect(questionCountForMode("comprehensive")).toBe(8);
    expect(questionCountForMode("project")).toBe(6);
    expect(questionCountForMode("behavioral")).toBe(6);
    expect(questionCountForMode("hr")).toBe(6);
  });

  it("requires the generated question pack to match the selected mode count", () => {
    const questions = Array.from({ length: 8 }, (_, index) => ({
      id: `q-${index + 1}`,
      category: index === 0 ? "self-introduction" : "project",
      prompt: `问题 ${index + 1}`,
      focus: "验证岗位匹配与真实经历",
      order: index,
    }));

    expect(parseInterviewQuestionPack("comprehensive", { questions })).toHaveLength(8);
    expect(() => parseInterviewQuestionPack("project", { questions })).toThrow("需要生成 6 道题");
  });

  it("rejects duplicate question ids and discontinuous ordering", () => {
    const questions = Array.from({ length: 8 }, (_, index) => ({
      id: index === 7 ? "q-1" : `q-${index + 1}`,
      category: index === 0 ? "self-introduction" : "project",
      prompt: `问题 ${index + 1}`,
      focus: "验证岗位匹配与真实经历",
      order: index === 6 ? 9 : index,
    }));

    expect(() => parseInterviewQuestionPack("comprehensive", { questions })).toThrow("题目编号或顺序无效");
  });

  it("requires focused modes to contain enough questions from their selected category", () => {
    const pack = (categories: Array<"self-introduction" | "motivation" | "project" | "professional" | "behavioral" | "failure" | "hr">) => ({
      questions: categories.map((category, index) => ({
        id: `q-${index + 1}`,
        category,
        prompt: `专项问题 ${index + 1}`,
        focus: "验证专项面试能力与事实证据",
        order: index,
      })),
    });

    expect(() => parseInterviewQuestionPack("project", pack([
      "project", "project", "project", "professional", "self-introduction", "failure",
    ]))).toThrow("项目深挖至少需要 4 道项目题");
    expect(() => parseInterviewQuestionPack("behavioral", pack([
      "behavioral", "behavioral", "motivation", "professional", "self-introduction", "failure",
    ]))).toThrow("行为面试至少需要 3 道行为题");
    expect(() => parseInterviewQuestionPack("hr", pack([
      "hr", "motivation", "behavioral", "professional", "self-introduction", "failure",
    ]))).toThrow("HR 面至少需要 3 道 HR 或动机题");
  });

  it("merges one answer without dropping answers for other questions", () => {
    const next = mergeInterviewAnswer(
      {
        "q-1": {
          questionId: "q-1",
          content: "旧回答",
          skipped: false,
          updatedAt: "2026-06-22T10:00:00.000Z",
        },
      },
      {
        questionId: "q-2",
        content: "新回答",
        skipped: false,
        updatedAt: "2026-06-22T10:01:00.000Z",
      },
    );

    expect(Object.keys(next)).toEqual(["q-1", "q-2"]);
    expect(next["q-2"]?.content).toBe("新回答");
  });

  it("normalizes legacy string questions into stable question objects", () => {
    const questions = normalizeInterviewQuestions(["请介绍一下自己", "为什么选择这个岗位？"]);
    expect(questions).toEqual([
      {
        id: "legacy-1",
        category: "general",
        prompt: "请介绍一下自己",
        focus: "历史面试题",
        order: 0,
      },
      {
        id: "legacy-2",
        category: "general",
        prompt: "为什么选择这个岗位？",
        focus: "历史面试题",
        order: 1,
      },
    ]);
    expect(normalizeInterviewAnswers({ "请介绍一下自己": "我是产品方向的学生。" }, questions)).toMatchObject({
      "legacy-1": {
        questionId: "legacy-1",
        content: "我是产品方向的学生。",
        skipped: false,
      },
    });
  });

  it("accepts a complete report and rejects empty feedback arrays", () => {
    const report = {
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

    expect(interviewReportSchema.parse(report)).toEqual(report);
    expect(() => interviewReportSchema.parse({ ...report, strengths: [] })).toThrow();
  });

  it("validates create and progress API payloads", () => {
    const createInput = {
      jobId: "job-1",
      resumeVersionId: null,
      mode: "comprehensive",
      context: {
        company: "腾讯",
        title: "产品运营实习生",
        jd: "负责用户研究与数据分析",
        resumeName: "主简历",
        resume: { basics: { name: "陈同学" } },
      },
    };
    expect(createInterviewSessionInputSchema.parse(createInput)).toEqual(createInput);
    expect(createInterviewSessionInputSchema.parse({
      ...createInput,
      context: { ...createInput.context, jd: "1" },
    }).context.jd).toBe("1");
    expect(createInterviewSessionInputSchema.parse({ ...createInput, jobId: undefined }).jobId).toBe("");
    expect(() => createInterviewSessionInputSchema.parse({ ...createInput, context: { ...createInput.context, jd: "" } })).toThrow();

    const progress = {
      currentQuestionIndex: 1,
      answer: {
        questionId: "q-1",
        content: "回答",
        skipped: false,
        updatedAt: "2026-06-22T10:00:00.000Z",
      },
    };
    expect(saveInterviewProgressInputSchema.parse(progress)).toEqual(progress);
    expect(saveInterviewProgressInputSchema.parse({ answer: progress.answer })).toEqual({ answer: progress.answer });
  });

  it("builds a new practice request from the completed session snapshot", () => {
    const input = createInterviewRetryInput({
      jobId: "job-1",
      resumeVersionId: "resume-1",
      mode: "project",
      context: {
        company: "美团",
        title: "后端开发实习生",
        jd: "负责 Java 服务开发与 SQL 优化",
        resumeName: "后端岗位定制版",
        resume: { basics: { name: "陈同学" }, projects: [{ name: "校园交易平台" }] },
      },
    });

    expect(input).toEqual({
      jobId: "job-1",
      resumeVersionId: "resume-1",
      mode: "project",
      context: expect.objectContaining({ company: "美团", title: "后端开发实习生" }),
    });
    expect(input.context).not.toBeUndefined();
  });

  it("opens completed sessions on the report screen", () => {
    expect(screenForInterviewSession({ status: "COMPLETED", feedback: { overallScore: 80 } })).toBe("report");
    expect(screenForInterviewSession({ status: "IN_PROGRESS", feedback: null })).toBe("session");
  });

  it("builds concise question navigation titles", () => {
    const prompts = [
      ["请用 1 分钟介绍自己，并说明为什么适合这个岗位。", "自我介绍"],
      ["你在项目里承担了什么角色？", "项目职责"],
      ["这份 JD 里提到的关键词，你最有把握的是哪一个？", "核心能力"],
      ["讲一个你遇到过的困难。", "困难处理"],
      ["如果面试官让你反问，你会问什么？", "面试反问"],
      ["你如何看待端侧 AI 和多模态模型的应用前景？", "技术趋势"],
    ] as const;
    for (const [prompt, expected] of prompts) {
      const title = interviewQuestionNavTitle({ prompt, category: "general" });
      expect(title).toBe(expected);
      expect(title.length).toBeLessThanOrEqual(10);
    }
  });
});
