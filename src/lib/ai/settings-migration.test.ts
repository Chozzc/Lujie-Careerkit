import { describe, expect, it } from "vitest";

import { getAiSettingsMaintenancePatch } from "./settings-migration";

describe("AI settings maintenance migration", () => {
  it("moves an untouched DeepSeek default to the Qwen default", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "deepseek",
        aiModel: "deepseek-v4-flash",
        model: "deepseek-v4-flash",
        aiApiKey: "",
        aiEnabled: false,
      }),
    ).toMatchObject({
      aiProvider: "qwen",
      aiModel: "qwen3.6-flash",
      aiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      aiLastTestStatus: "untested",
    });
  });

  it("does not rewrite a configured DeepSeek account", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "deepseek",
        aiModel: "deepseek-v4-flash",
        model: "deepseek-v4-flash",
        aiApiKey: "encrypted-key",
        aiEnabled: true,
      }),
    ).toBeNull();
  });

  it("repairs a Qwen default accidentally paired with the DeepSeek URL", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "qwen",
        aiModel: "qwen3.7-max",
        model: "qwen3.7-max",
        baseUrl: "https://api.deepseek.com/v1",
        aiBaseUrl: "https://api.deepseek.com/v1",
        aiApiKey: "",
        aiEnabled: false,
      }),
    ).toMatchObject({
      aiProvider: "qwen",
      aiModel: "qwen3.6-flash",
      model: "qwen3.6-flash",
      aiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      aiLastTestStatus: "untested",
    });
  });

  it("only migrates old OpenAI placeholder defaults when no key has been configured", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        model: "gpt-4o-mini",
        aiApiKey: "",
        aiEnabled: false,
      }),
    ).toMatchObject({
      aiModel: "gpt-5.5",
      model: "gpt-5.5",
      aiLastTestStatus: "untested",
    });
  });
});
