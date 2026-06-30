import { describe, expect, it } from "vitest";

import { coerceResumeContent, normalizeResumeContent } from "./resume-content";
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
    const normalized = normalizeResumeContent({
      ...emptyResume,
      basics: {
        ...emptyResume.basics,
        email: "18379185091858653164@qq.com",
      },
    });

    expect(normalized.basics.phone).toBe("18379185091");
    expect(normalized.basics.email).toBe("858653164@qq.com");
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
          highlights: ["9. AIGC全栈创作者", "■模型落地与迭代", "●取得成果 2025中国高校计算机大赛三等奖"],
        },
      ],
      awards: ["2025中国高校计算机大赛三等奖"],
      customSections: [{ title: "主要优势与技能认证", content: "10. 技术驱动艺术\n■高产出与奖项验证" }],
    });

    expect(normalized.projects[0]?.highlights).toEqual([
      "AIGC全栈创作者",
      "模型落地与迭代",
      "取得成果 2025中国高校计算机大赛三等奖",
    ]);
    expect(normalized.awards).toEqual(["2025中国高校计算机大赛三等奖"]);
    expect(normalized.customSections?.[0]?.content).toBe("技术驱动艺术\n高产出与奖项验证");
  });
});
