import {
  DEFAULT_AI_PROVIDER_ID,
  getAiProvider,
  getDefaultAiModel,
  LEGACY_DEFAULT_AI_MODELS,
} from "./provider-registry";
import type { AiTestStatus } from "./settings";

type StoredAiSettingsForMaintenance = {
  aiProvider: string;
  aiModel: string;
  baseUrl?: string;
  aiBaseUrl?: string;
  model: string;
  aiApiKey: string;
  aiEnabled: boolean;
};

type AiSettingsMaintenancePatch = {
  provider?: string;
  baseUrl?: string;
  aiProvider?: string;
  aiBaseUrl?: string;
  model: string;
  aiModel: string;
  aiLastTestStatus: AiTestStatus;
};

export function getAiSettingsMaintenancePatch(
  settings: StoredAiSettingsForMaintenance,
): AiSettingsMaintenancePatch | null {
  const legacyDefaultModels = new Set<string>(LEGACY_DEFAULT_AI_MODELS);

  if (
    settings.aiProvider === "openai" &&
    legacyDefaultModels.has(settings.aiModel) &&
    legacyDefaultModels.has(settings.model) &&
    !settings.aiEnabled &&
    !settings.aiApiKey
  ) {
    const openAiDefaultModel = getDefaultAiModel("openai");
    return {
      model: openAiDefaultModel,
      aiModel: openAiDefaultModel,
      aiLastTestStatus: "untested",
    };
  }

  if (
    settings.aiProvider === "deepseek" &&
    settings.aiModel === "deepseek-v4-flash" &&
    settings.model === "deepseek-v4-flash" &&
    !settings.aiEnabled &&
    !settings.aiApiKey
  ) {
    const defaultProvider = getAiProvider(DEFAULT_AI_PROVIDER_ID);
    const defaultModel = getDefaultAiModel(defaultProvider.id);
    return {
      provider: "openai-compatible",
      baseUrl: defaultProvider.baseUrl,
      aiProvider: defaultProvider.id,
      model: defaultModel,
      aiModel: defaultModel,
      aiBaseUrl: defaultProvider.baseUrl,
      aiLastTestStatus: "untested",
    };
  }

  if (
    settings.aiProvider === DEFAULT_AI_PROVIDER_ID &&
    (settings.aiBaseUrl === getAiProvider("deepseek").baseUrl || settings.baseUrl === getAiProvider("deepseek").baseUrl) &&
    !settings.aiEnabled &&
    !settings.aiApiKey
  ) {
    const defaultProvider = getAiProvider(DEFAULT_AI_PROVIDER_ID);
    const defaultModel = getDefaultAiModel(defaultProvider.id);
    return {
      provider: "openai-compatible",
      baseUrl: defaultProvider.baseUrl,
      aiProvider: defaultProvider.id,
      model: settings.model || defaultModel,
      aiModel: settings.aiModel || defaultModel,
      aiBaseUrl: defaultProvider.baseUrl,
      aiLastTestStatus: "untested",
    };
  }

  return null;
}
