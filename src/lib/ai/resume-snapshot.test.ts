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
    });

    expect(snapshot).toMatchObject({
      basics: { name: "陈同学", city: "上海" },
      customSections: [{ title: "主要优势与技能认证", content: "AIGC 全栈创作者。" }],
    });
    expect(JSON.stringify(snapshot)).not.toContain("chen@example.com");
    expect(JSON.stringify(snapshot)).not.toContain("13800000000");
    expect(JSON.stringify(snapshot)).not.toContain("template");
  });
});
