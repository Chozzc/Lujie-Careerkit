import { describe, expect, it } from "vitest";

import { buildApplicationMessagePrompt } from "./application-message";

const resume = {
  basics: {
    name: "陈同学",
    email: "private@example.com",
    phone: "13800000000",
    city: "北京",
    links: ["https://example.com/private"],
  },
  profile: { title: "AI 产品实习生", summary: "关注 Agent 产品落地。" },
  education: [],
  experiences: [],
  internships: [],
  projects: [
    {
      name: "Agent 求职助手",
      role: "产品与开发",
      period: "2026",
      highlights: ["完成 RAG 知识库与评测流程设计"],
    },
  ],
  skills: ["RAG", "Prompt 工程"],
  awards: [],
  selfReview: "",
};

describe("application message AI task", () => {
  it("puts explicit availability first in greeting prompts without leaking contact details", () => {
    const prompt = buildApplicationMessagePrompt({
      kind: "greeting",
      jd: "招聘 AI 产品实习生，要求每周到岗五天。",
      resume,
      extraContext: "可立即到岗，连续实习 6 个月，每周 5 天。",
      locale: "zh-CN",
    });

    expect(prompt).toContain("第一句话先给招聘方最关心的硬匹配信息");
    expect(prompt).toContain("可立即到岗，连续实习 6 个月，每周 5 天");
    expect(prompt).toContain("Agent 求职助手");
    expect(prompt).toContain("不能改写为“主导、独立、全权负责”");
    expect(prompt).toContain("不能扩写为全职");
    expect(prompt).not.toContain("private@example.com");
    expect(prompt).not.toContain("13800000000");
    expect(prompt).not.toContain("example.com/private");
  });

  it("keeps cover letters formal and evidence-based", () => {
    const prompt = buildApplicationMessagePrompt({
      kind: "cover-letter",
      jd: "招聘 AI 产品实习生，负责 RAG 产品设计。",
      resume,
      locale: "zh-CN",
    });

    expect(prompt).toContain("招聘笔记私信、邮件或正式投递");
    expect(prompt).toContain("2-3 个最有说服力的真实经历或能力证据");
    expect(prompt).toContain("严禁编造");
  });
});
