import { describe, expect, it } from "vitest";

import { encryptLocalSecret } from "./secrets";
import {
  buildAiSettingsPatch,
  getEffectiveAiSettings,
  redactAiSettings,
  validateAiSettingsInput,
} from "./settings";

describe("AI settings helpers", () => {
  it("redacts API key material", () => {
    const encryptedKey = encryptLocalSecret("sk-1234567890abcdef");
    const redacted = redactAiSettings({
      aiProvider: "openai",
      aiModel: "gpt-5.5",
      aiBaseUrl: "https://api.openai.com/v1",
      aiApiKey: encryptedKey,
      aiEnabled: true,
      aiTemperature: 0.3,
      aiLastTestedAt: null,
      aiLastTestStatus: "untested",
    });

    expect(redacted.hasApiKey).toBe(true);
    expect(redacted.apiKeyPreview).toBe("sk-1...cdef");
    expect(JSON.stringify(redacted)).not.toContain("1234567890abcdef");
    expect(JSON.stringify(redacted)).not.toContain(encryptedKey);
  });

  it("normalizes provider defaults when model and baseUrl are omitted", () => {
    const patch = buildAiSettingsPatch({
      aiProvider: "deepseek",
      aiModel: "",
      aiBaseUrl: "",
      aiApiKey: "",
      aiEnabled: true,
      aiTemperature: 0.3,
    });

    expect(patch.aiProvider).toBe("deepseek");
    expect(patch.aiModel).toBe("deepseek-v4-flash");
    expect(patch.aiBaseUrl).toBe("https://api.deepseek.com/v1");
  });

  it("defaults to enabled while keeping keyless providers unavailable at runtime", () => {
    expect(validateAiSettingsInput({}).aiEnabled).toBe(true);

    const stored = {
      aiProvider: "openai",
      aiModel: "gpt-5.5",
      aiBaseUrl: "https://api.openai.com/v1",
      aiApiKey: "",
      aiEnabled: true,
      aiTemperature: 0.3,
      aiLastTestedAt: null,
      aiLastTestStatus: "untested",
    } as const;

    expect(redactAiSettings(stored).aiEnabled).toBe(true);
    expect(getEffectiveAiSettings(stored).enabled).toBe(false);
  });

  it("preserves an existing key unless clearApiKey is requested", () => {
    const existingKey = encryptLocalSecret("sk-existing-value");

    const preserved = buildAiSettingsPatch(
      {
        aiProvider: "openai",
        aiModel: "gpt-5.5",
        aiBaseUrl: "https://api.openai.com/v1",
        aiApiKey: "",
        aiEnabled: true,
        aiTemperature: 0.2,
      },
      { encryptedApiKey: existingKey },
    );

    const cleared = buildAiSettingsPatch(
      {
        aiProvider: "openai",
        aiModel: "gpt-5.5",
        aiBaseUrl: "https://api.openai.com/v1",
        aiApiKey: "",
        clearApiKey: true,
        aiEnabled: true,
        aiTemperature: 0.2,
      },
      { encryptedApiKey: existingKey },
    );

    expect(preserved.aiApiKey).toBe(existingKey);
    expect(cleared.aiApiKey).toBe("");
  });

  it("rejects invalid base URLs for editable providers", () => {
    expect(() =>
      validateAiSettingsInput({
        aiProvider: "custom-openai-compatible",
        aiModel: "gpt-5.5",
        aiBaseUrl: "not-a-url",
        aiApiKey: "sk-test",
        aiEnabled: true,
        aiTemperature: 0.3,
      }),
    ).toThrow("Base URL 格式不正确。");
  });

  it("resolves runtime settings with decrypted key and provider metadata", () => {
    const runtime = getEffectiveAiSettings({
      aiProvider: "ollama",
      aiModel: "",
      aiBaseUrl: "",
      aiApiKey: "",
      aiEnabled: true,
      aiTemperature: 0.3,
      aiLastTestedAt: null,
      aiLastTestStatus: "untested",
    });

    expect(runtime.provider.id).toBe("ollama");
    expect(runtime.model).toBe("qwen3:8b");
    expect(runtime.baseUrl).toBe("http://localhost:11434/v1");
    expect(runtime.apiKey).toBe("");
    expect(runtime.requiresApiKey).toBe(false);
  });
});
