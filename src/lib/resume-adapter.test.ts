import { describe, expect, it } from "vitest";

import { contentToJadeResume, jadeResumeToContent } from "./resume-adapter";
import type { ResumeContent } from "./types";
import type { PersonalInfoContent, WorkExperienceContent } from "@/types/resume";

const baseResume: ResumeContent = {
  basics: {
    name: "林泽宇",
    email: "linzeyu@example.com",
    phone: "139 0000 0000",
    city: "杭州",
    links: ["github.com/linzeyu"],
  },
  profile: {
    title: "后端开发实习生",
    summary: "",
  },
  education: [
    {
      school: "浙江某大学",
      degree: "本科",
      major: "软件工程",
      start: "2022",
      end: "2026",
      highlights: ["GPA 3.8/4.0"],
    },
  ],
  experiences: [
    {
      company: "校内云计算实验室",
      role: "研发助理",
      start: "2024-09",
      end: "2025-01",
      highlights: ["维护 Spring Boot 课程平台接口。"],
    },
  ],
  internships: [
    {
      company: "网易",
      role: "后端开发实习生",
      start: "2025-06",
      end: "2025-09",
      highlights: ["参与订单查询接口改造，将慢查询比例降低 23%。"],
    },
  ],
  projects: [
    {
      name: "校园二手交易平台",
      role: "后端负责人",
      highlights: ["设计用户、商品、订单和消息模块。"],
    },
  ],
  skills: [],
  awards: ["CET-6"],
  selfReview: "工程基础扎实，习惯用数据复盘问题。",
};

describe("resume content adapter", () => {
  it("does not expose the target job title in the editor personal info", () => {
    const jadeResume = contentToJadeResume({
      ...baseResume,
      profile: { ...baseResume.profile, title: "Backend Intern" },
    });
    const personalInfo = jadeResume.sections.find((section) => section.type === "personal_info")?.content;

    expect(personalInfo).toMatchObject({ jobTitle: "" });
    expect(jadeResumeToContent(jadeResume).profile.title).toBe("");
  });

  it("builds core editor sections in the expected Chinese resume order", () => {
    const jadeResume = contentToJadeResume(baseResume);

    expect(jadeResume.sections.map((section) => [section.type, section.title])).toEqual([
      ["personal_info", "个人信息"],
      ["education", "教育背景"],
      ["work_experience", "工作经历"],
      ["internship_experience", "实习经历"],
      ["projects", "项目经历"],
      ["certifications", "资格证书"],
      ["self_evaluation", "自我评价"],
    ]);
  });

  it("round-trips internship experience and self evaluation", () => {
    const jadeResume = contentToJadeResume(baseResume);
    const content = jadeResumeToContent(jadeResume);

    expect(content.internships).toHaveLength(1);
    expect(content.internships[0]).toMatchObject({
      company: "网易",
      role: "后端开发实习生",
    });
    expect(content.selfReview).toBe("工程基础扎实，习惯用数据复盘问题。");
  });

  it("keeps editor-only personal fields after saving and reopening", () => {
    const jadeResume = contentToJadeResume(baseResume);
    const personalInfo = jadeResume.sections.find((section) => section.type === "personal_info");
    personalInfo!.content = {
      ...(personalInfo!.content as PersonalInfoContent),
      age: "22",
      gender: "男",
      politicalStatus: "共青团员",
      wechat: "linzeyu",
      avatar: "data:image/jpeg;base64,avatar",
    };

    const reopened = contentToJadeResume(jadeResumeToContent(jadeResume));
    const reopenedPersonalInfo = reopened.sections.find((section) => section.type === "personal_info")?.content;

    expect(reopenedPersonalInfo).toMatchObject({
      age: "22",
      gender: "男",
      politicalStatus: "共青团员",
      wechat: "linzeyu",
      avatar: "data:image/jpeg;base64,avatar",
    });
  });

  it("keeps deleted sections and fields deleted after saving and reopening", () => {
    const jadeResume = contentToJadeResume(baseResume);
    const personalInfo = jadeResume.sections.find((section) => section.type === "personal_info");
    personalInfo!.content = {
      ...(personalInfo!.content as PersonalInfoContent),
      website: "",
      github: "github.com/linzeyu",
    };
    jadeResume.sections = jadeResume.sections.filter((section) => section.type !== "education");

    const reopened = contentToJadeResume(jadeResumeToContent(jadeResume));
    const reopenedPersonalInfo = reopened.sections.find((section) => section.type === "personal_info")?.content;

    expect(reopened.sections.some((section) => section.type === "education")).toBe(false);
    expect(reopenedPersonalInfo).toMatchObject({ website: "", github: "github.com/linzeyu" });

    jadeResume.sections = [];
    expect(contentToJadeResume(jadeResumeToContent(jadeResume)).sections).toEqual([]);
  });

  it("restores editor snapshots while applying newer resume content", () => {
    const savedContent = jadeResumeToContent(contentToJadeResume(baseResume));
    const optimizedContent: ResumeContent = {
      ...savedContent,
      experiences: [
        {
          ...savedContent.experiences[0],
          highlights: ["围绕 JD 强化后的经历表述。"],
        },
      ],
    };

    const reopened = contentToJadeResume(optimizedContent);
    const work = reopened.sections.find((section) => section.type === "work_experience")?.content as WorkExperienceContent;

    expect(work.items[0].highlights).toEqual(["围绕 JD 强化后的经历表述。"]);
  });

  it("keeps work and project logos through the editor round-trip", () => {
    const logo = "data:image/png;base64,logo";
    const content = jadeResumeToContent(contentToJadeResume({
      ...baseResume,
      experiences: [{ ...baseResume.experiences[0], logo }],
      projects: [{ ...baseResume.projects[0], logo }],
    }));

    expect(content.experiences[0].logo).toBe(logo);
    expect(content.projects[0].logo).toBe(logo);
  });

  it("maps imported custom titled sections into editor custom modules", () => {
    const jadeResume = contentToJadeResume({
      ...baseResume,
      customSections: [
        {
          title: "AIGC Strengths",
          content: "AIGC full-stack creator\nTechnical art workflow",
        },
      ],
    });
    const custom = jadeResume.sections.find((section) => section.type === "custom");

    expect(custom).toMatchObject({
      title: "AIGC Strengths",
      content: {
        items: [
          {
            title: "",
            description: "AIGC full-stack creator\nTechnical art workflow",
          },
        ],
      },
    });
    expect(jadeResumeToContent(jadeResume).customSections).toEqual([
      {
        title: "AIGC Strengths",
        content: "AIGC full-stack creator\nTechnical art workflow",
      },
    ]);
  });

  it("keeps template and theme settings attached to the individual resume content", () => {
    const jadeResume = contentToJadeResume({
      ...baseResume,
      editor: {
        template: "classic",
        themeConfig: {
          primaryColor: "#111827",
          accentColor: "#b45309",
          fontFamily: "Inter",
          fontSize: "small",
          logoSize: "large",
          lineSpacing: 1.35,
          margin: { top: 18, right: 20, bottom: 18, left: 20 },
          sectionSpacing: 12,
          avatarStyle: "circle",
        },
      },
    });

    expect(jadeResume.template).toBe("classic");
    expect(jadeResume.themeConfig.accentColor).toBe("#b45309");
    expect(jadeResume.themeConfig.logoSize).toBe("large");

    jadeResume.template = "modern";
    jadeResume.themeConfig = { ...jadeResume.themeConfig, accentColor: "#315f92" };
    const content = jadeResumeToContent(jadeResume);

    expect(content.editor?.template).toBe("modern");
    expect(content.editor?.themeConfig?.accentColor).toBe("#315f92");
    expect(content.editor?.themeConfig?.logoSize).toBe("large");
  });
});
