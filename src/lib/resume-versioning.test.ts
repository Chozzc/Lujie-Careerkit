import { describe, expect, it } from "vitest";

import { buildOptimizedResumeVersionName, buildTailoredResumeVersion } from "./resume-versioning";
import type { ResumeContent } from "./types";

const namedResume: ResumeContent = {
  basics: {
    name: "Alex Chen",
    email: "alex@example.com",
    phone: "138 0000 0000",
    city: "上海",
    links: ["github.com/alexchen"],
  },
  profile: {
    title: "数据分析方向学生",
    summary: "",
  },
  education: [
    {
      school: "上海交通大学",
      degree: "本科",
      major: "信息管理",
      start: "2023",
      end: "2027",
      highlights: ["GPA 3.8/4.0"],
    },
  ],
  experiences: [],
  internships: [
    {
      company: "校园创新中心",
      role: "产品运营助理",
      start: "2025-03",
      end: "2025-06",
      highlights: ["整理用户反馈并输出复盘报告。"],
    },
  ],
  projects: [
    {
      name: "课程项目数据看板",
      role: "数据分析负责人",
      highlights: ["使用 SQL 处理数据并支持 A/B 测试复盘。"],
    },
  ],
  skills: ["用户研究", "活动复盘", "SQL", "A/B 测试"],
  awards: [],
  selfReview: "关注数据分析和用户增长。",
};

describe("buildTailoredResumeVersion", () => {
  it("creates a JD-specific resume version without mutating the master resume", () => {
    const master = structuredClone(namedResume);
    const before = JSON.stringify(master);

    const version = buildTailoredResumeVersion({
      masterResume: master,
      job: { id: "job-1", company: "腾讯", title: "产品运营实习生" },
      analysis: {
        company: "腾讯",
        title: "产品运营实习生",
        deadline: "2026-06-18",
        requirements: ["数据分析", "用户研究", "活动复盘"],
        keywords: ["SQL", "用户研究", "A/B 测试"],
        bonusPoints: ["有校园社群经验"],
        risks: [],
        suggestions: ["把课程项目里的数据分析经历前置。"],
      },
    });

    expect(JSON.stringify(master)).toBe(before);
    expect(version.name).toBe("JD匹配优化-Alex Chen-产品运营实习生");
    expect(version.summary).toContain("SQL");
    expect(version.content.skills[0]).toBe("SQL");
    expect(version.content.projects[0].highlights).toEqual(master.projects[0].highlights);
  });

  it("names optimized resumes from the resume owner and JD title", () => {
    expect(buildOptimizedResumeVersionName(namedResume, "数据分析实习生")).toBe(
      "JD匹配优化-Alex Chen-数据分析实习生",
    );

    expect(
      buildOptimizedResumeVersionName(
        {
          ...namedResume,
          basics: { ...namedResume.basics, name: "" },
          editor: { ...namedResume.editor, displayName: "王梓涵的简历" },
        },
        "大模型算法工程师",
      ),
    ).toBe("JD匹配优化-王梓涵-大模型算法工程师");
  });
});
