import { describe, expect, it } from "vitest";

import { buildAiResumeSnapshot } from "./resume-snapshot";

describe("AI resume snapshot", () => {
  it("keeps custom sections while removing private contact and editor fields", () => {
    const snapshot = buildAiResumeSnapshot({
      editor: { template: "modern", displayName: "陈同学简历" },
      basics: {
        name: "陈同学",
        email: "chen@example.com",
        phone: "13800000000",
        city: "上海",
        links: ["https://example.com"],
      },
      customSections: [{ title: "主要优势与技能认证", content: "AIGC 全栈创作者。" }],
      _tailoringBaseResume: {
        basics: { email: "base@example.com", phone: "13900000000" },
      },
      _optimizationMeta: { summary: "内部优化记录" },
    });

    expect(snapshot).toMatchObject({
      basics: { name: "陈同学", city: "上海" },
      customSections: [{ title: "主要优势与技能认证", content: "AIGC 全栈创作者。" }],
    });
    expect(JSON.stringify(snapshot)).not.toContain("chen@example.com");
    expect(JSON.stringify(snapshot)).not.toContain("13800000000");
    expect(JSON.stringify(snapshot)).not.toContain("base@example.com");
    expect(JSON.stringify(snapshot)).not.toContain("13900000000");
    expect(JSON.stringify(snapshot)).not.toContain("内部优化记录");
    expect(JSON.stringify(snapshot)).not.toContain("template");
  });

  it("removes embedded logos before sending resume content to AI", () => {
    const snapshot = buildAiResumeSnapshot({
      basics: { name: "陈同学" },
      experiences: [{ company: "示例公司", logo: "data:image/png;base64,logo" }],
      internships: [{ company: "实习公司", logo: "data:image/png;base64,logo" }],
      projects: [{ name: "示例项目", logo: "data:image/png;base64,logo" }],
    });

    expect(JSON.stringify(snapshot)).not.toContain("data:image");
    expect(snapshot).toMatchObject({
      experiences: [{ company: "示例公司" }],
      internships: [{ company: "实习公司" }],
      projects: [{ name: "示例项目" }],
    });
  });
});
