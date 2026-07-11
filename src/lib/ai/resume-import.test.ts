import { describe, expect, it } from "vitest";

import { parseResumeTextWithAi } from "./resume-import";

const settings = {
  providerId: "deepseek",
  provider: { label: "DeepSeek" },
  model: "deepseek-chat",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "test-key",
  enabled: true,
  temperature: 0.1,
  requiresApiKey: true,
} as never;

describe("resume text import", () => {
  it("uses the configured model to structure extracted text", async () => {
    const result = await parseResumeTextWithAi(
      { fileName: "resume.pdf", text: "张三\n产品经理", settings },
      {
        generateObject: async () => ({
          object: {
            basics: { name: "张三", email: "", phone: "", city: "", links: [] },
            profile: { title: "产品经理", summary: "" },
            education: [], experiences: [], internships: [], projects: [], skills: [], awards: [], selfReview: "",
          } as never,
        }),
      },
    );

    expect(result.source).toBe("ai");
    expect(result.data.basics.name).toBe("张三");
    expect(result.data.profile.title).toBe("产品经理");
  });
});
