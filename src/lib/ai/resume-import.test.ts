import { afterEach, describe, expect, it, vi } from "vitest";

import { getAiProvider } from "./provider-registry";
import { parseResumeTextWithAi, parseResumeWithQwenDoc } from "./resume-import";
import type { EffectiveAiSettings } from "./settings";

const settings: EffectiveAiSettings = {
  providerId: "deepseek",
  provider: getAiProvider("deepseek"),
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "test-key",
  enabled: true,
  temperature: 0.1,
  requiresApiKey: true,
};

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

  it("tells the model not to duplicate summaries into self evaluation", async () => {
    let prompt = "";
    await parseResumeTextWithAi(
      { fileName: "resume.pdf", text: "张三\n个人总结\n专注后端开发", settings },
      {
        generateObject: async (input) => {
          prompt = input.prompt;
          return {
            object: {
              basics: { name: "张三", email: "", phone: "", city: "", links: [] },
              profile: { title: "", summary: "专注后端开发" },
              education: [], experiences: [], internships: [], projects: [], skills: [], awards: [], selfReview: "",
            } as never,
          };
        },
      },
    );

    expect(prompt).toContain("profile.summary：只放原简历明确标为个人总结");
    expect(prompt).toContain("不要放自我评价");
    expect(prompt).toContain("selfReview：只放原简历明确标为自我评价");
    expect(prompt).toContain("不要与 profile.summary 重复");
  });
});

describe("Qwen document import", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("waits for remote temporary-file cleanup before resolving", async () => {
    let finishDelete!: (response: Response) => void;
    const deleteResponse = new Promise<Response>((resolve) => {
      finishDelete = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ id: "file-1" }))
      .mockResolvedValueOnce(Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              basics: { name: "张三", email: "", phone: "", city: "", links: [] },
              profile: { title: "", summary: "" },
              education: [], experiences: [], internships: [], projects: [], skills: [], awards: [], selfReview: "",
            }),
          },
        }],
      }))
      .mockImplementationOnce(() => deleteResponse);
    vi.stubGlobal("fetch", fetchMock);

    let settled = false;
    const parsing = parseResumeWithQwenDoc({
      file: new File(["resume"], "resume.pdf", { type: "application/pdf" }),
      settings: { ...settings, providerId: "qwen" },
    }).then((resume) => {
      settled = true;
      return resume;
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(settled).toBe(false);
    finishDelete(new Response(null, { status: 204 }));

    await expect(parsing).resolves.toMatchObject({ basics: { name: "张三" } });
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://api.deepseek.com/v1/files/file-1");
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: "DELETE" });
  });
});
