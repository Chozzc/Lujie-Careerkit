import { describe, expect, it } from "vitest";

import { getAiSettingsMaintenancePatch } from "./settings-migration";

describe("AI settings maintenance migration", () => {
  it("moves an untouched DeepSeek default to the Qwen default", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "deepseek",
        aiModel: "deepseek-v4-flash",
        aiBaseUrl: "https://api.deepseek.com/v1",
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
        aiBaseUrl: "https://api.deepseek.com/v1",
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
        aiBaseUrl: "https://api.deepseek.com/v1",
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

  it("only migrates old OpenAI placeholder defaults when no key has been configured", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        aiBaseUrl: "https://api.openai.com/v1",
        aiApiKey: "",
        aiEnabled: false,
      }),
    ).toMatchObject({
      aiModel: "gpt-5.6",
      aiLastTestStatus: "untested",
    });
  });

  it("repairs a configured provider model id without dropping its key", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "openrouter",
        aiModel: "openai/gpt-5.6",
        aiBaseUrl: "https://openrouter.ai/api/v1",
        aiApiKey: "encrypted-key",
        aiEnabled: true,
      }),
    ).toMatchObject({
      aiModel: "openai/gpt-5.6-sol",
      aiLastTestStatus: "untested",
    });
  });
});
