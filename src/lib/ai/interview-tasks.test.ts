import { describe, expect, it } from "vitest";

import {
  buildInterviewQuestionFallback,
  buildInterviewQuestionPrompt,
  buildInterviewReportPrompt,
} from "./interview-tasks";

describe("interview AI tasks", () => {
  it("builds a balanced eight-question comprehensive fallback", () => {
    const questions = buildInterviewQuestionFallback({
      mode: "comprehensive",
      company: "腾讯",
      title: "产品运营实习生",
      jd: "负责用户研究、活动复盘和 SQL 分析",
      resume: { projects: [{ name: "校园自习室预约体验优化" }] },
    });

    expect(questions).toHaveLength(8);
    expect(new Set(questions.map((question) => question.category))).toEqual(
      new Set([
        "self-introduction",
        "motivation",
        "project",
        "professional",
        "behavioral",
        "failure",
        "reverse-question",
      ]),
    );
  });

  it("includes the selected resume and JD in the question prompt", () => {
    const prompt = buildInterviewQuestionPrompt({
      mode: "project",
      company: "美团",
      title: "后端开发实习生",
      jd: "美团｜后端开发实习生\n要求 Java、SQL 和接口设计",
      resume: { projects: [{ name: "校园二手交易平台" }] },
    });

    expect(prompt).toContain("美团");
    expect(prompt).toContain("Java、SQL 和接口设计");
    expect(prompt).toContain("校园二手交易平台");
    expect(prompt).toContain("6 道");
    expect(prompt).toContain("完整岗位名称");
    expect(prompt).toContain("括号内限定词");
  });

  it("removes contact details and editor settings from interview prompts", () => {
    const prompt = buildInterviewQuestionPrompt({
      mode: "project",
      company: "美团",
      title: "后端开发实习生",
      jd: "要求 Java、SQL 和接口设计",
      resume: {
        editor: { template: "campus" },
        basics: {
          name: "陈同学",
          email: "private@example.com",
          phone: "13800000000",
          city: "上海",
          links: ["https://example.com/private"],
        },
        profile: { title: "后端开发", summary: "关注服务端开发" },
        projects: [{ name: "校园二手交易平台", role: "负责人", highlights: ["完成接口设计"] }],
      },
    });

    expect(prompt).toContain("校园二手交易平台");
    expect(prompt).toContain("上海");
    expect(prompt).not.toContain("private@example.com");
    expect(prompt).not.toContain("13800000000");
    expect(prompt).not.toContain("example.com/private");
    expect(prompt).not.toContain("template");
  });

  it("builds the final report prompt from answered questions and marks skipped ones", () => {
    const prompt = buildInterviewReportPrompt({
      context: {
        company: "腾讯",
        title: "产品运营实习生",
        jd: "负责用户研究与数据分析",
        resumeName: "腾讯产品运营定制版",
        resume: { basics: { name: "陈同学" } },
      },
      questions: [
        { id: "q-1", category: "project", prompt: "介绍项目贡献", focus: "个人贡献", order: 0 },
        { id: "q-2", category: "behavioral", prompt: "介绍一次冲突", focus: "STAR", order: 1 },
      ],
      answers: {
        "q-1": {
          questionId: "q-1",
          content: "我负责用户访谈和数据分析。",
          skipped: false,
          updatedAt: "2026-06-22T10:00:00.000Z",
        },
        "q-2": {
          questionId: "q-2",
          content: "",
          skipped: true,
          updatedAt: "2026-06-22T10:01:00.000Z",
        },
      },
    });

    expect(prompt).toContain("我负责用户访谈和数据分析");
    expect(prompt).toContain("未回答 / 跳过");
    expect(prompt).toContain("事实证据");
  });
});
