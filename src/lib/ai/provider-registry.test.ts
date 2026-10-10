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
    expect(getDefaultAiModel("deepseek")).toBe("deepseek-flash");
    expect(getDefaultAiModel("openai")).toBe("gpt-6-luna");
    expect(getDefaultAiModel("qwen")).toBe("qwen3.8-flash");
    expect(getDefaultAiModel("gemini-via-openrouter")).toBe("google/gemini-3.8-flash");
    expect(getDefaultAiModel("zhipu")).toBe("glm-5.3-flash");
    expect(getDefaultAiModel("anthropic-via-openrouter")).toBe("anthropic/claude-fable-5.1");
    expect(getAiProvider("siliconflow").baseUrl).toBe("https://api.siliconflow.cn/v1");
    expect(getAiProvider("siliconflow").models).toContain("Pro/moonshotai/Kimi-K2.6");
    expect(getAiProvider("siliconflow").models).toContain("Pro/zai-org/GLM-5.1");
    expect(getAiProvider("siliconflow").models).not.toContain("zai-org/GLM-5");
    expect(getAiProvider("siliconflow").models).not.toContain("Qwen/Qwen3.7-Max");
    expect(getAiProvider("deepseek").models).toContain("deepseek-flash");
    expect(getAiProvider("deepseek").models).toContain("deepseek-v4-pro");
    expect(getAiProvider("qwen").models[0]).toBe("qwen3.8-flash");
    expect(getAiProvider("qwen").models).toContain("qwen3.8-max");
    expect(getAiProvider("qwen").models).not.toContain("qwen3.8-max-prime");
    expect(getAiProvider("gemini-via-openrouter").models).toContain("google/gemini-3.1-pro-preview");
    expect(getAiProvider("gemini-via-openrouter").models).not.toContain("google/gemini-3.5-pro");
    expect(getAiProvider("openrouter").models).toContain("anthropic/claude-fable-5.1");
    expect(getAiProvider("moonshot").models).toContain("kimi-k3");
    expect(getAiProvider("zhipu").models).toContain("glm-5.3");
    expect(getAiProvider("deepseek").models).not.toContain("deepseek-chat");
    expect(getAiProvider("openai").models).toContain("gpt-6-astra");
    expect(getAiProvider("gemini-via-openrouter").models).not.toContain("google/gemini-3.1-flash");
    expect(getAiProvider("xai").models).toContain("grok-4.7");
    expect(getAiProvider("volcengine").models).toContain("doubao-seed-2-1-lite-260915");
    expect(getAiProvider("anthropic-via-openrouter").models).toContain("anthropic/claude-opus-5.5");
    expect(getAiProvider("groq").models).toContain("openai/gpt-oss-120b");
    expect(getAiProvider("groq").models).not.toContain("groq/compound");
    expect(getAiProvider("ollama").models).toContain("gpt-oss:120b");
    expect(getDefaultAiModel("mistral")).toBe("mistral-medium-3-5");
    expect(getAiProvider("mistral").models).toContain("mistral-small-latest");
    expect(getDefaultAiModel("openrouter")).toBe("openai/gpt-6.1-sol");
    expect(getAiProvider("openrouter").models).toContain("mistralai/mistral-medium-3-5");
  });

  it("includes every provider default in its model list", () => {
    for (const provider of AI_PROVIDERS) {
      expect(provider.models, provider.id).toContain(provider.defaultModel);
    }
  });

  it("offers MiniMax pay-as-you-go models without advertising the plan-only preview", () => {
    const minimax = getAiProvider("minimax");
    expect(minimax).toMatchObject({ group: "domestic", baseUrl: "https://api.minimax.cn/v1", defaultModel: "MiniMax-M3" });
    expect(minimax.models).toEqual(["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.7-highspeed"]);
    expect(getAiProvider("openrouter").models).toContain("minimax/minimax-m3");
    expect(getAiProvider("openrouter").models).toContain("minimax/minimax-m2.7");
    expect(getAiProvider("siliconflow").models).toContain("Qwen/Qwen3.8-27B");
    expect(getAiProvider("siliconflow").models).toContain("zai-org/GLM-5.3");
  });

  it("renames only known stale model ids for their provider", () => {
    expect(getCurrentAiModel("openrouter", "openai/gpt-5.6")).toBe("openai/gpt-5.6-sol");
    expect(getCurrentAiModel("deepseek", "deepseek-v4-flash")).toBe("deepseek-flash");
    expect(getCurrentAiModel("groq", "groq/compound")).toBe("openai/gpt-oss-120b");
    expect(getCurrentAiModel("mistral", "mistral-medium-3.5")).toBe("mistral-medium-3-5");
    expect(getCurrentAiModel("siliconflow", "zai-org/GLM-5")).toBe("Pro/zai-org/GLM-5.1");
    expect(getCurrentAiModel("custom-openai-compatible", "openai/gpt-5.6")).toBe("openai/gpt-5.6");
    for (const providerId of ["gemini-via-openrouter", "openrouter"]) {
      expect(getCurrentAiModel(providerId, "google/gemini-3.8-flash-lite")).toBe("google/gemini-3.5-flash-lite");
    }
    expect(getCurrentAiModel("openai", "gpt-6-sol")).toBe("gpt-6-sol");
    expect(getCurrentAiModel("openrouter", "openai/gpt-5.6-sol")).toBe("openai/gpt-5.6-sol");
    expect(getCurrentAiModel("custom-openai-compatible", "google/gemini-3.8-flash-lite")).toBe("google/gemini-3.8-flash-lite");
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
