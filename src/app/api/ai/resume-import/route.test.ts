import { Buffer } from "node:buffer";
import { jsPDF } from "jspdf";
import { afterEach, expect, it, vi } from "vitest";

import { POST } from "./route";

const { settings } = vi.hoisted(() => ({
  settings: { providerId: "deepseek", model: "deepseek-flash", baseUrl: "https://model.example/v1", enabled: true, apiKey: "test-key" },
}));

vi.mock("@/lib/repository", () => ({
  getEffectiveAiRuntimeSettings: async () => settings,
}));
vi.mock("node:crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:crypto")>(),
  randomBytes: () => Buffer.from("ab2359", "hex"),
}));

afterEach(() => vi.unstubAllGlobals());

it.each([
  { providerId: "deepseek", model: "deepseek-flash", code: "AB2359", status: 200 },
  { providerId: "qwen", model: "qwen3.8-flash", code: "AB2359", status: 200 },
  { providerId: "custom-openai-compatible", model: "custom-model", code: "", status: 502 },
  { providerId: "deepseek", model: "deepseek-v4-pro", code: "", status: 422 },
  { providerId: "groq", model: "openai/gpt-oss-120b", code: "", status: 422 },
])("verifies image access before accepting an import from $model", async ({ providerId, model, code, status }) => {
  Object.assign(settings, { providerId, model });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAAAAWSURBVAiZY/z///9/BiTAxIAGCAsAAAZdBAS4SSTsAAAAAElFTkSuQmCC",
    "base64",
  );
  const pdf = new jsPDF();
  pdf.text("This page has a selectable text layer", 20, 20);
  pdf.addPage();
  pdf.addImage(png, "PNG", 10, 10, 20, 20);
  const form = new FormData();
  form.set("file", new File([pdf.output("arraybuffer")], "scan.pdf"));

  const content = {
    basics: { name: "林舟", email: "", phone: "", city: "", links: [] },
    profile: { title: "", summary: "" },
    education: [], experiences: [], internships: [], projects: [], skills: [], awards: [], selfReview: "",
    customSections: [{ title: "作品说明", content: "原文 R7" }],
  };
  const fetchMock = vi.fn(async () => Response.json({
    choices: [{
      index: 0,
      finish_reason: "stop",
      message: { role: "assistant", content: JSON.stringify({ imageCode: code, resume: content }) },
    }],
  }));
  vi.stubGlobal("fetch", fetchMock);

  const response = await POST(new Request("http://localhost/api/ai/resume-import", { method: "POST", body: form }));
  expect(response.status).toBe(status);
  if (status === 422) {
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining(`当前模型（${model}）不支持图片输入`),
    });
    return;
  }
  if (status === 200) expect(await response.json()).toMatchObject({ source: "ai-vision", content });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://model.example/v1/chat/completions", expect.anything());
  const [, request] = vi.mocked(globalThis.fetch).mock.calls[0];
  const payload = JSON.parse(String(request?.body));
  expect(payload.response_format).toEqual(providerId === "deepseek" ? { type: "json_object" } : undefined);
  expect(payload.messages[0].content.map((part: { type: string }) => part.type))
    .toEqual(["text", "image_url", "image_url", "image_url"]);
  expect(JSON.stringify(payload.messages[0].content[0])).not.toContain("AB2359");
});
