import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEffectiveAiRuntimeSettings: vi.fn(),
  runAiObjectTask: vi.fn(),
}));

vi.mock("./repository", () => ({
  getEffectiveAiRuntimeSettings: mocks.getEffectiveAiRuntimeSettings,
}));
vi.mock("./ai/tasks", () => ({
  runAiObjectTask: mocks.runAiObjectTask,
}));

import { optimizeResumeWithAI, tailorResumeWithAI } from "./ai-service";
import type { ResumeContent } from "./types";

const originalResume: ResumeContent = {
  basics: {
    name: "陈同学",
    email: "chen@example.com",
    phone: "13800000000",
    city: "上海",
    links: ["https://example.com"],
  },
  profile: { title: "AI 产品经理", summary: "关注 AI 产品。" },
  education: [],
  experiences: [],
  internships: [],
  projects: [
    {
      name: "AI 简历工具",
      role: "产品负责人",
      highlights: ["完成从 0 到 1 的产品设计。"],
    },
  ],
  skills: ["AI 产品", "Prompt"],
  awards: ["校赛一等奖"],
  customSections: [{ title: "主要优势与技能认证", content: "AIGC 全栈创作者。" }],
  selfReview: "",
};

describe("resume AI optimization", () => {
  it("preserves identity fields while accepting AI wording improvements", async () => {
    const aiResume: ResumeContent = {
      ...originalResume,
      basics: {
        ...originalResume.basics,
        name: "张三",
        email: "wrong@example.com",
      },
      profile: { title: "增长产品经理", summary: "具备 AI 产品规划与 Prompt 迭代经验。" },
      projects: [
        {
          ...originalResume.projects[0],
          name: "不存在的新项目",
          highlights: ["主导 AI 简历工具的信息架构与优化闭环。"],
        },
      ],
    };
    mocks.getEffectiveAiRuntimeSettings.mockResolvedValue({ enabled: true });
    mocks.runAiObjectTask.mockResolvedValue({
      source: "ai",
      message: "简历优化完成",
      data: aiResume,
    });

    const result = await optimizeResumeWithAI({ resume: originalResume });

    expect(result.source).toBe("ai");
    expect(result.data.basics).toEqual(originalResume.basics);
    expect(result.data.profile).toEqual({
      title: originalResume.profile.title,
      summary: "具备 AI 产品规划与 Prompt 迭代经验。",
    });
    expect(result.data.projects[0]).toMatchObject({
      name: originalResume.projects[0].name,
      highlights: ["主导 AI 简历工具的信息架构与优化闭环。"],
    });
    expect(mocks.runAiObjectTask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskLabel: "AI 简历优化",
        prompt: expect.stringContaining("不要新增原简历不存在的事实"),
      }),
    );
    expect(mocks.runAiObjectTask.mock.calls[0]?.[0].schema.safeParse(aiResume).success).toBe(true);
  });

  it("keeps original bullets when the model returns fewer highlights", async () => {
    const resumeWithTwoBullets: ResumeContent = {
      ...originalResume,
      projects: [
        {
          ...originalResume.projects[0],
          highlights: ["完成从 0 到 1 的产品设计。", "推动 3 轮用户访谈并整理需求。"],
        },
      ],
    };
    mocks.getEffectiveAiRuntimeSettings.mockResolvedValue({ enabled: true });
    mocks.runAiObjectTask.mockResolvedValue({
      source: "ai",
      message: "简历优化完成",
      data: {
        ...resumeWithTwoBullets,
        projects: [
          {
            ...resumeWithTwoBullets.projects[0],
            highlights: ["主导 AI 简历工具的信息架构与优化闭环。"],
          },
        ],
      },
    });

    const result = await optimizeResumeWithAI({ resume: resumeWithTwoBullets });

    expect(result.data.projects[0]?.highlights).toEqual([
      "主导 AI 简历工具的信息架构与优化闭环。",
      "推动 3 轮用户访谈并整理需求。",
    ]);
  });

  it("lets AI rewrite custom section content while preserving custom titles", async () => {
    const aiResume: ResumeContent = {
      ...originalResume,
      customSections: [{ title: "主要优势与技能认证", content: "具备 AIGC 全链路创作与落地经验。" }],
    };
    mocks.getEffectiveAiRuntimeSettings.mockResolvedValue({ enabled: true });
    mocks.runAiObjectTask.mockResolvedValue({
      source: "ai",
      message: "简历优化完成",
      data: aiResume,
    });

    const result = await tailorResumeWithAI({
      resume: originalResume,
      jd: "需要 AIGC 产品经验",
      job: { id: "job-1", company: "字节跳动", title: "AI 产品实习生" },
      analysis: {
        company: "字节跳动",
        title: "AI 产品实习生",
        deadline: null,
        requirements: ["AIGC"],
        keywords: ["AIGC"],
        bonusPoints: [],
        risks: [],
        suggestions: [],
      },
    });

    expect(result.data.customSections).toEqual([
      { title: "主要优势与技能认证", content: "具备 AIGC 全链路创作与落地经验。" },
    ]);
    expect(mocks.runAiObjectTask).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("主要优势与技能认证"),
      }),
    );
  });

  it("returns AI-provided optimization metadata", async () => {
    const aiResume: ResumeContent = {
      ...originalResume,
      profile: { ...originalResume.profile, summary: "突出 AI 产品规划与项目落地能力。" },
    };
    mocks.getEffectiveAiRuntimeSettings.mockResolvedValue({ enabled: true });
    mocks.runAiObjectTask.mockResolvedValue({
      source: "ai",
      message: "简历匹配优化完成",
      data: {
        resume: aiResume,
        meta: {
          company: "腾讯",
          title: "产品经理实习生",
          keywords: ["AI 产品", "用户研究"],
          summary: "已围绕腾讯产品经理实习生岗位强化 AI 产品规划和用户研究证据。",
          changes: ["自我评价", "项目经历"],
          versionName: "JD匹配优化-陈同学-腾讯产品经理实习生",
        },
      },
    });

    const result = await tailorResumeWithAI({
      resume: originalResume,
      jd: "腾讯 - 产品经理实习生\n需要 AI 产品和用户研究经验",
      job: { id: "job-1", company: "目标公司", title: "目标岗位" },
      analysis: {
        company: "待填写公司",
        title: "待分析岗位",
        deadline: null,
        requirements: ["AI 产品"],
        keywords: [],
        bonusPoints: [],
        risks: [],
        suggestions: [],
      },
    });

    expect(result.meta).toMatchObject({
      company: "腾讯",
      title: "产品经理实习生",
      keywords: ["AI 产品", "用户研究"],
      versionName: "JD匹配优化-陈同学-腾讯产品经理实习生",
    });
  });
});
