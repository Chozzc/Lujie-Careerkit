import { describe, expect, it } from "vitest";

import { buildMatchResultTitle, type MatchOptimizationResult } from "./match-view";

const result: MatchOptimizationResult = {
  job: {
    id: "version-resume-1",
    company: "本地优化版本",
    title: "AI应用开发工程师",
    city: "待填写",
    source: "AI简历优化",
    jd: "",
    link: "",
    deadline: null,
    analysis: null,
    createdAt: "2026-07-02T00:00:00.000Z",
  },
  version: {
    id: "resume-1",
    jobId: null,
    name: "AI优化-林舟-AI应用开发工程师",
    summary: "",
    content: {
      basics: { name: "林舟", email: "", phone: "", city: "", links: [] },
      profile: { title: "AI应用开发工程师", summary: "" },
      education: [],
      experiences: [],
      internships: [],
      projects: [],
      skills: [],
      awards: [],
      customSections: [],
      selfReview: "",
    },
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  },
  optimization: {
    company: "",
    title: "",
    keywords: ["AI Agent开发"],
    summary: "已优化简历表达。",
    changes: ["自我评价"],
    versionName: "AI优化-林舟-AI应用开发工程师",
  },
};

describe("match result title", () => {
  it("uses general AI optimization title for non-JD optimized versions", () => {
    expect(buildMatchResultTitle(result)).toBe("AI优化简历完成");
  });
});
