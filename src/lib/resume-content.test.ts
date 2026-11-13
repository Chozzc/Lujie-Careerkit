import { describe, expect, it } from "vitest";

import {
  coerceResumeContent,
  normalizeResumeContent,
  preserveResumeInternalMetadata,
  resumeContentFromText,
  resumeContentInputSchema,
} from "./resume-content";
import type { ResumeContent } from "./types";

const emptyResume: ResumeContent = {
  basics: { name: "Alex", email: "", phone: "", city: "", links: [] },
  profile: { title: "", summary: "" },
  education: [],
  experiences: [],
  internships: [],
  projects: [],
  skills: [],
  awards: [],
  selfReview: "",
};

describe("resume content normalization", () => {
  it("splits a phone-prefixed QQ email into phone and email fields", () => {
    const phone = "13000000000";
    const email = "00000@qq.com";
    const normalized = normalizeResumeContent({
      ...emptyResume,
      basics: {
        ...emptyResume.basics,
        email: phone + email,
      },
    });

    expect(normalized.basics.phone).toBe(phone);
    expect(normalized.basics.email).toBe(email);
  });

  it("keeps imported summaries separate from self evaluations", () => {
    const normalized = resumeContentFromText("resume.txt", [
      "张三",
      "后端工程师",
      "个人总结",
      "专注后端开发。",
      "自我评价",
      "工程基础扎实。",
    ].join("\n"));

    expect(normalized.profile.summary).toBe("专注后端开发。");
    expect(normalized.selfReview).toBe("工程基础扎实。");
  });

  it("leaves self evaluation empty when the imported resume does not contain one", () => {
    const normalized = resumeContentFromText("resume.txt", [
      "张三",
      "后端工程师",
      "教育经历",
      "示例大学 | 本科 | 计算机科学 | 2022 - 2026",
    ].join("\n"));

    expect(normalized.selfReview).toBe("");
  });

  it("coerces model object awards into strings", () => {
    const normalized = coerceResumeContent({
      ...emptyResume,
      awards: [
        { name: "全国总决赛三等奖", issuer: "中国高校计算机大赛", date: "2025" },
        { title: "华东赛区二等奖" },
      ],
    });

    expect(normalized.awards).toEqual(["全国总决赛三等奖 中国高校计算机大赛 2025", "华东赛区二等奖"]);
  });

  it("removes layout bullets and list numbers without dropping real years", () => {
    const normalized = normalizeResumeContent({
      ...emptyResume,
      projects: [
        {
          name: "医疗 AI 项目",
          role: "",
          highlights: ["9. AIGC全栈创作者", "🟥模型落地与迭代", "华为 HCIA工程师认证 ●软著/实用新型专利"],
        },
      ],
      awards: ["2025中国高校计算机大赛三等奖"],
      customSections: [{ title: "主要优势与技能认证", content: "10. 技术驱动艺术\n■高产出与奖项验证" }],
    });

    expect(normalized.projects[0]?.highlights).toEqual([
      "AIGC全栈创作者",
      "模型落地与迭代",
      "华为 HCIA工程师认证 软著/实用新型专利",
    ]);
    expect(normalized.awards).toEqual(["2025中国高校计算机大赛三等奖"]);
    expect(normalized.customSections?.[0]?.content).toBe("技术驱动艺术\n高产出与奖项验证");
  });

  it("does not mistake decimal values for numbered-list prefixes", () => {
    const normalized = normalizeResumeContent({
      ...emptyResume,
      education: [{
        school: "示例大学",
        degree: "本科",
        major: "计算机科学",
        start: "2022",
        end: "2026",
        highlights: ["GPA 3.8/4.0", "3.8/4.0"],
      }],
    });

    expect(normalized.education[0]?.highlights).toEqual(["GPA 3.8/4.0", "3.8/4.0"]);
  });

  it("keeps safe uploaded logos and built-in icon references", () => {
    const normalized = normalizeResumeContent({
      ...emptyResume,
      experiences: [
        { company: "示例公司", role: "开发", logo: "icon:building", start: "", end: "", highlights: [] },
        { company: "示例团队", role: "算法", logo: "icon:cpu", start: "", end: "", highlights: [] },
      ],
      projects: [
        { name: "示例项目", role: "", logo: "data:image/png;base64,logo", highlights: [] },
        { name: "无效图标", role: "", logo: "icon:not-allowed", highlights: [] },
      ],
    });

    expect(normalized.experiences[0].logo).toBe("icon:building");
    expect(normalized.experiences[1].logo).toBe("icon:cpu");
    expect(normalized.projects[0].logo).toBe("data:image/png;base64,logo");
    expect(normalized.projects[1].logo).toBeUndefined();
  });

  it("normalizes editor settings without dropping optimization metadata", () => {
    const metadata = { ...emptyResume, basics: { ...emptyResume.basics, name: "原始简历" } };
    const stages = {
      analysis: {
        company: "示例公司",
        title: "示例岗位",
        deadline: null,
        requirements: ["沟通能力"],
        keywords: ["沟通"],
        bonusPoints: [],
        risks: [],
        suggestions: ["突出协作经历"],
      },
      draft: metadata,
      acceptedChangeIds: ["profile.summary"],
      editedValues: { "profile.summary": "人工调整后的内容" },
    };
    const normalized = resumeContentInputSchema.parse({
      ...emptyResume,
      editor: {
        displayName: "测试简历",
        themeConfig: { fontFamily: "Inter;}</style><script>alert(1)</script>" },
      },
      _tailoringBaseResume: metadata,
      _optimizationStages: stages,
    }) as ResumeContent & {
      _tailoringBaseResume: ResumeContent;
      _optimizationStages: typeof stages;
    };

    expect(normalized.editor?.themeConfig?.fontFamily).toBe("Inter");
    expect(normalized._tailoringBaseResume.basics.name).toBe("原始简历");
    expect(normalized._optimizationStages).toEqual(stages);
  });

  it("preserves optimization stages when the editor rebuilds visible resume fields", () => {
    const source = {
      ...emptyResume,
      _tailoringBaseResume: { ...emptyResume, basics: { ...emptyResume.basics, name: "原始简历" } },
      _optimizationMeta: { summary: "优化说明" },
      _optimizationStages: { acceptedChangeIds: ["education.0.highlights.0"] },
    } as ResumeContent;
    const rebuilt = { ...emptyResume, basics: { ...emptyResume.basics, name: "编辑后的简历" } };

    const result = preserveResumeInternalMetadata(rebuilt, source) as ResumeContent & Record<string, unknown>;
    const sourceRecord = source as ResumeContent & Record<string, unknown>;

    expect(result.basics.name).toBe("编辑后的简历");
    expect(result._tailoringBaseResume).toEqual(sourceRecord._tailoringBaseResume);
    expect(result._optimizationMeta).toEqual(sourceRecord._optimizationMeta);
    expect(result._optimizationStages).toEqual(sourceRecord._optimizationStages);
  });

  it("drops malformed serialized editor sections before reopening the editor", () => {
    const normalized = normalizeResumeContent({
      ...emptyResume,
      editor: {
        sections: [
          { type: "skills", content: "not-an-object" },
          { type: "summary", content: { text: "保留" }, sortOrder: Number.NaN },
        ] as never,
      },
    });

    expect(normalized.editor?.sections).toEqual([
      expect.objectContaining({ type: "summary", sortOrder: 1, content: { text: "保留" } }),
    ]);
  });
});
