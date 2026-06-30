import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import type { EffectiveAiSettings } from "./settings";

export function createAiModel(config: EffectiveAiSettings) {
  const provider = createOpenAICompatible({
    name: config.providerId,
    apiKey: config.apiKey || undefined,
    baseURL: config.baseUrl,
  });

  return provider(config.model);
}
