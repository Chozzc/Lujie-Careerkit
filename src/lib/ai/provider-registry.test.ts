import { describe, expect, it } from "vitest";

import {
  AI_PROVIDER_GROUPS,
  AI_PROVIDERS,
  getAiProvider,
  getCurrentAiModel,
  getDefaultAiModel,
  providerRequiresApiKey,
  requiresBaseUrl,
} from "./provider-registry";

describe("AI provider registry", () => {
  it("contains domestic, international, aggregator, local, and custom groups", () => {
    expect(AI_PROVIDER_GROUPS.map((group) => group.id)).toEqual([
      "domestic",
      "international",
      "aggregator",
      "local",
      "custom",
    ]);
  });

  it("returns stable defaults for known providers", () => {
    expect(getDefaultAiModel("deepseek")).toBe("deepseek-v4-flash");
    expect(getDefaultAiModel("openai")).toBe("gpt-5.6");
    expect(getDefaultAiModel("qwen")).toBe("qwen3.6-flash");
    expect(getDefaultAiModel("gemini-via-openrouter")).toBe("google/gemini-3.5-flash");
    expect(getDefaultAiModel("zhipu")).toBe("glm-5.1");
    expect(getDefaultAiModel("anthropic-via-openrouter")).toBe("anthropic/claude-fable-5");
    expect(getAiProvider("siliconflow").baseUrl).toBe("https://api.siliconflow.cn/v1");
    expect(getAiProvider("siliconflow").models).toContain("Pro/moonshotai/Kimi-K2.6");
    expect(getAiProvider("siliconflow").models).toContain("Pro/zai-org/GLM-5.1");
    expect(getAiProvider("siliconflow").models).not.toContain("zai-org/GLM-5");
    expect(getAiProvider("siliconflow").models).not.toContain("Qwen/Qwen3.7-Max");
    expect(getAiProvider("deepseek").models).toContain("deepseek-v4-flash");
    expect(getAiProvider("deepseek").models).toContain("deepseek-v4-pro");
    expect(getAiProvider("qwen").models[0]).toBe("qwen3.6-flash");
    expect(getAiProvider("qwen").models).toContain("qwen3.7-max");
    expect(getAiProvider("gemini-via-openrouter").models).toContain("google/gemini-3.1-pro-preview");
    expect(getAiProvider("gemini-via-openrouter").models).not.toContain("google/gemini-3.5-pro");
    expect(getAiProvider("openrouter").models).toContain("anthropic/claude-sonnet-4.6");
    expect(getAiProvider("moonshot").models).toContain("kimi-k2.6");
    expect(getAiProvider("zhipu").models).toContain("glm-5.1");
    expect(getAiProvider("zhipu").models).toContain("glm-5.2");
    expect(getAiProvider("deepseek").models).not.toContain("deepseek-chat");
    expect(getAiProvider("openai").models).toContain("gpt-5.4-mini");
    expect(getAiProvider("gemini-via-openrouter").models).not.toContain("google/gemini-3.1-flash");
    expect(getAiProvider("xai").models).toContain("grok-4.5");
    expect(getAiProvider("volcengine").models).toContain("doubao-seed-2-0-lite-260428");
    expect(getAiProvider("anthropic-via-openrouter").models).toContain("anthropic/claude-opus-4.8");
    expect(getAiProvider("xai").models).toContain("grok-4.3");
    expect(getAiProvider("groq").models).toContain("openai/gpt-oss-120b");
    expect(getAiProvider("ollama").models).toContain("gpt-oss:120b");
    expect(getDefaultAiModel("mistral")).toBe("mistral-medium-3-5");
    expect(getAiProvider("mistral").models).toContain("mistral-small-2603");
    expect(getDefaultAiModel("openrouter")).toBe("openai/gpt-5.6-sol");
    expect(getAiProvider("openrouter").models).toContain("mistralai/mistral-medium-3-5");
  });

  it("includes every provider default in its model list", () => {
    for (const provider of AI_PROVIDERS) {
      expect(provider.models, provider.id).toContain(provider.defaultModel);
    }
  });

  it("renames only known stale model ids for their provider", () => {
    expect(getCurrentAiModel("openrouter", "openai/gpt-5.6")).toBe("openai/gpt-5.6-sol");
    expect(getCurrentAiModel("mistral", "mistral-medium-3.5")).toBe("mistral-medium-3-5");
    expect(getCurrentAiModel("siliconflow", "zai-org/GLM-5")).toBe("Pro/zai-org/GLM-5.1");
    expect(getCurrentAiModel("custom-openai-compatible", "openai/gpt-5.6")).toBe("openai/gpt-5.6");
  });

  it("marks local and custom providers as requiring an editable base URL", () => {
    expect(requiresBaseUrl("ollama")).toBe(true);
    expect(requiresBaseUrl("custom-openai-compatible")).toBe(true);
    expect(requiresBaseUrl("openai")).toBe(false);
  });

  it("knows when an API key is optional", () => {
    expect(providerRequiresApiKey("ollama")).toBe(false);
    expect(providerRequiresApiKey("openai")).toBe(true);
  });

  it("falls back to custom OpenAI-compatible defaults for unknown provider ids", () => {
    expect(getAiProvider("not-real").id).toBe("custom-openai-compatible");
    expect(getDefaultAiModel("not-real")).toBe("gpt-5.6");
  });
});
