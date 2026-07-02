import { describe, expect, it } from "vitest";

import {
  buildOptimizationDescription,
  buildOptimizationSummary,
  buildResumeDiffSections,
} from "./resume-optimization-result";
import type { ResumeContent } from "@/lib/types";

const baseResume: ResumeContent = {
  basics: { name: "陈同学", email: "", phone: "", city: "", links: [] },
  profile: { title: "AI 产品经理", summary: "关注 AI 产品。" },
  education: [],
  experiences: [],
  internships: [],
  projects: [],
  skills: ["AI 产品"],
  awards: [],
  customSections: [{ title: "主要优势与技能认证", content: "AIGC 全栈创作者。" }],
  selfReview: "",
};

describe("resume optimization result helpers", () => {
  it("reports custom section changes in diff and summary", () => {
    const optimized: ResumeContent = {
      ...baseResume,
      customSections: [{ title: "主要优势与技能认证", content: "具备 AIGC 全链路创作经验。" }],
    };

    expect(buildResumeDiffSections(baseResume, optimized)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "customSections",
          title: "自定义模块",
          previewTitles: ["主要优势与技能认证"],
        }),
      ]),
    );
    expect(buildOptimizationSummary(baseResume, optimized, { mode: "general" })).toContainEqual({
      label: "调整范围",
      value: "自定义模块",
    });
    expect(buildOptimizationDescription(baseResume, optimized, { mode: "general" })).toContain(
      "本次主要调整了自定义模块",
    );
  });

  it("ignores whitespace-only custom section differences", () => {
    const optimized: ResumeContent = {
      ...baseResume,
      customSections: [{ title: "主要优势与技能认证", content: "  AIGC   全栈创作者。\n" }],
    };

    expect(buildResumeDiffSections(baseResume, optimized)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "customSections" })]),
    );
    expect(buildOptimizationSummary(baseResume, optimized, { mode: "general" })).toContainEqual({
      label: "调整范围",
      value: "保留原结构，仅调整表达重点。",
    });
  });

  it("does not repeat AI summary claims when there is no visible resume diff", () => {
    const meta = {
      company: "",
      title: "",
      keywords: ["AI 产品"],
      summary: "已精简自定义模块与自我评价。",
      changes: ["自我评价", "自定义模块"],
      versionName: "AI优化-陈同学",
    };

    expect(buildOptimizationDescription(baseResume, baseResume, { mode: "general", meta })).toBe(
      "已完成 AI 优化检查，本次未发现明显结构变化。右侧简历没有明显高亮模块，可以进入编辑器继续复核。",
    );
  });

  it("prefers AI-provided summary metadata for result copy", () => {
    const optimized: ResumeContent = {
      ...baseResume,
      profile: { ...baseResume.profile, summary: "突出 AI 产品规划与落地经验。" },
    };
    const meta = {
      company: "腾讯",
      title: "产品经理实习生",
      keywords: ["AI 产品", "用户研究"],
      summary: "已围绕腾讯产品经理实习生岗位强化 AI 产品规划、用户研究和项目落地证据。",
      changes: ["自我评价", "项目经历"],
      versionName: "JD匹配优化-陈同学-腾讯产品经理实习生",
    };

    expect(buildOptimizationDescription(baseResume, optimized, { mode: "jd", meta })).toContain(meta.summary);
    expect(buildOptimizationSummary(baseResume, optimized, { mode: "jd", meta })).toEqual(
      expect.arrayContaining([
        { label: "岗位关键词", value: "AI 产品、用户研究" },
        { label: "调整范围", value: "自我评价、项目经历" },
      ]),
    );
  });

  it("keeps general AI optimization copy away from JD wording and internal field names", () => {
    const optimized: ResumeContent = {
      ...baseResume,
      profile: { ...baseResume.profile, summary: "聚焦 AI 产品规划与核心能力。" },
      customSections: [{ title: "主要优势与技能认证", content: "具备 AIGC 全链路创作与落地经验。" }],
    };
    const meta = {
      company: "",
      title: "",
      keywords: ["AI Agent开发", "知识图谱", "大模型应用"],
      summary: "profile.summary增加技术栈与核心能力定位、projects.highlights采用动作方法结果结构、customSections拆分为技术栈模块。",
      changes: [
        "profile.summary增加技术栈与核心能力定位",
        "projects.highlights采用动作+方法+结果的三段式结构",
        "customSections拆分为技术栈与知识产权双模块",
      ],
      versionName: "AI优化-陈同学-核心能力",
    };

    const summaryItems = buildOptimizationSummary(baseResume, optimized, { mode: "general", meta });
    const description = buildOptimizationDescription(baseResume, optimized, { mode: "general", meta });

    expect(summaryItems).toEqual(
      expect.arrayContaining([
        { label: "能力关键词", value: "AI Agent开发、知识图谱、大模型应用" },
        { label: "调整范围", value: "自我评价与核心能力、自定义模块" },
      ]),
    );
    expect(JSON.stringify(summaryItems)).not.toContain("岗位关键词");
    expect(JSON.stringify(summaryItems)).not.toContain("profile.summary");
    expect(JSON.stringify(summaryItems)).not.toContain("projects.highlights");
    expect(JSON.stringify(summaryItems)).not.toContain("customSections");
    expect(description).not.toContain("profile.summary");
    expect(description).not.toContain("projects.highlights");
    expect(description).not.toContain("customSections");
  });
});
