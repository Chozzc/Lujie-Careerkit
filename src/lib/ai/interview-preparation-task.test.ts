import { describe, expect, it } from "vitest";

import { buildInterviewPreparationPrompt } from "./interview-preparation-task";
import { createInterviewPreparationInputSchema, normalizeInterviewPreparation } from "../interview-preparation";

describe("interview preparation AI task", () => {
  it("accepts any non-empty JD and keeps resume ownership metadata", () => {
    const input = {
      jobId: "",
      resumeKey: "main",
      resumeVersionId: null,
      jd: "1",
      resumeName: "主简历",
      resume: { basics: { name: "陈同学" } },
      focus: "comprehensive" as const,
      locale: "zh-CN" as const,
    };

    expect(createInterviewPreparationInputSchema.parse(input)).toEqual(input);
    expect(() => createInterviewPreparationInputSchema.parse({ ...input, jd: "" })).toThrow();
  });

  it("builds a cross-industry, evidence-first prompt without private contact details", () => {
    const prompt = buildInterviewPreparationPrompt({
      jd: "美团｜后端开发实习生\n负责 Java 服务端开发、接口设计、数据库优化和系统稳定性",
      resumeName: "后端开发简历",
      focus: "comprehensive",
      locale: "zh-CN",
      resume: {
        basics: {
          name: "陈同学",
          email: "private@example.com",
          phone: "13800000000",
          city: "上海",
          links: ["https://example.com/private"],
        },
        profile: { title: "后端开发", summary: "关注服务端工程" },
        projects: [{ name: "校园交易平台", role: "后端负责人", highlights: ["完成接口与数据库设计"] }],
      },
    });

    expect(prompt).toContain("软件工程");
    expect(prompt).toContain("完整岗位名称");
    expect(prompt).toContain("括号内限定词");
    expect(prompt).toContain("not-shown");
    expect(prompt).toContain("capabilityProfile");
    expect(prompt).toContain("简历证据强弱");
    expect(prompt).toContain("校园交易平台");
    expect(prompt).toContain("不能自动判断用户不会");
    expect(prompt).not.toContain("private@example.com");
    expect(prompt).not.toContain("13800000000");
    expect(prompt).not.toContain("example.com/private");
  });

  it("adds a capability profile when opening a legacy saved guide", () => {
    const legacy = {
      meta: { company: "美团", title: "后端开发", roleFamily: "软件工程", roleSummary: "负责服务端系统开发", assumptions: [] },
      evidenceMatrix: Array.from({ length: 5 }, (_, index) => ({
        requirement: `岗位要求 ${index + 1}`,
        resumeEvidence: [],
        state: index === 0 ? "direct" : "not-shown",
        assessment: "根据当前简历整理",
        action: "准备对应案例",
      })),
      knowledgeTopics: Array.from({ length: 3 }, (_, index) => ({
        topic: `核心知识 ${index + 1}`,
        priority: "must",
        whyRelevant: "与岗位相关",
        explanation: "知识讲解",
        currentEvidence: "当前证据",
        targetLevel: "准备目标",
        selfCheckQuestions: ["问题一", "问题二"],
      })),
      deepDives: Array.from({ length: 2 }, (_, index) => ({
        resumeItem: `项目 ${index + 1}`,
        whyRelevant: "与岗位相关",
        personalContributionFocus: "个人贡献",
        likelyFollowUps: ["追问一", "追问二"],
        factsToConfirm: [],
      })),
      targetedQuestions: Array.from({ length: 6 }, (_, index) => ({
        question: `面试问题 ${index + 1}`,
        category: "专业能力",
        preparationDirection: "准备真实案例",
        priority: "must",
      })),
      preparationPlan: { mustPrepare: ["任务一", "任务二"], shouldPrepare: [], optional: [] },
      selfIntroduction: "我会结合真实经历介绍自己的岗位匹配能力与项目贡献。",
      reverseQuestions: ["问题一", "问题二", "问题三"],
    };

    expect(normalizeInterviewPreparation(legacy).capabilityProfile.dimensions).toHaveLength(5);
  });

  it("does not force fabricated experience deep dives for a sparse resume", () => {
    const sparseGuide = {
      meta: { company: "目标公司", title: "目标岗位", roleFamily: "通用岗位", roleSummary: "根据现有材料准备", assumptions: [] },
      capabilityProfile: {
        overview: "根据 JD 整理岗位能力要求",
        dimensions: Array.from({ length: 5 }, (_, index) => ({
          label: `能力${index + 1}`,
          requirementLevel: "important" as const,
          evidenceLevel: "unknown" as const,
          evidenceSummary: "简历暂未体现",
          nextStep: "结合真实经历确认",
        })),
      },
      evidenceMatrix: Array.from({ length: 3 }, (_, index) => ({
        requirement: `岗位要求${index + 1}`,
        resumeEvidence: [],
        state: "not-shown" as const,
        assessment: "当前简历未提供相关证据",
        action: "面试前确认真实经历",
      })),
      knowledgeTopics: Array.from({ length: 3 }, (_, index) => ({
        topic: `核心知识${index + 1}`,
        priority: "must" as const,
        whyRelevant: "与岗位要求相关",
        explanation: "根据岗位要求学习",
        currentEvidence: "当前简历未体现",
        targetLevel: "能够解释基本概念",
        selfCheckQuestions: ["问题一", "问题二"],
      })),
      deepDives: [],
      targetedQuestions: Array.from({ length: 6 }, (_, index) => ({
        question: `面试问题${index + 1}`,
        category: "岗位能力",
        preparationDirection: "只使用真实信息回答",
        priority: "must" as const,
      })),
      preparationPlan: { mustPrepare: ["确认经历", "复习基础"], shouldPrepare: [], optional: [] },
      selfIntroduction: "请根据自己的真实教育与实践经历补充一段面试自我介绍。",
      reverseQuestions: ["团队目标是什么？", "岗位如何协作？", "新人如何成长？"],
    };

    expect(() => normalizeInterviewPreparation(sparseGuide)).not.toThrow();
  });
});
