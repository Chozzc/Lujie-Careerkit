import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import type { EffectiveAiSettings } from "./settings";

export function createAiModel(config: EffectiveAiSettings) {
  if (config.providerId === "openai") {
    return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })(config.model);
  }
  // The official adapter preserves signed/encrypted reasoning across tool calls.
  if (["openrouter", "anthropic-via-openrouter", "gemini-via-openrouter"].includes(config.providerId)) {
    return createOpenRouter({ apiKey: config.apiKey, baseURL: config.baseUrl })(config.model);
  }
  const provider = createOpenAICompatible({
    name: config.providerId,
    apiKey: config.apiKey || undefined,
    baseURL: config.baseUrl,
    // Keep reasoning separate from the JSON/text consumed by application tasks.
    transformRequestBody: config.providerId === "minimax"
      ? (body) => ({ ...body, reasoning_split: true })
      : undefined,
  });

  return provider(config.model);
}

export function getAiTemperature(config: EffectiveAiSettings) {
  // Fixed-sampling models also appear behind gateways; use the model ID there.
  const model = config.model.split("/").at(-1) ?? config.model;
  return /^(?:gpt-[56](?:\.|-|$)|kimi-k3\.1(?:-|$)|minimax-m3(?:\.|-|$)|claude-(?:fable-5|(?:opus|sonnet|haiku)-5[.-]5)(?:\.|-|$))/i.test(model)
    ? undefined : config.temperature;
}
