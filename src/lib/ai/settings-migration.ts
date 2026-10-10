import {
  DEFAULT_AI_PROVIDER_ID,
  getAiProvider,
  getCurrentAiModel,
  getDefaultAiModel,
  LEGACY_DEFAULT_AI_MODELS,
} from "./provider-registry";
import type { AiTestStatus } from "./settings";

type StoredAiSettingsForMaintenance = {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiEnabled: boolean;
};

type AiSettingsMaintenancePatch = {
  aiProvider?: string;
  aiBaseUrl?: string;
  aiModel: string;
  aiLastTestStatus: AiTestStatus;
};

export function getAiSettingsMaintenancePatch(
  settings: StoredAiSettingsForMaintenance,
): AiSettingsMaintenancePatch | null {
  if (
    settings.aiProvider === "deepseek" &&
    settings.aiModel === "deepseek-v4-flash" &&
    !settings.aiEnabled &&
    !settings.aiApiKey
  ) {
    const defaultProvider = getAiProvider(DEFAULT_AI_PROVIDER_ID);
    return {
      aiProvider: defaultProvider.id,
      aiModel: getDefaultAiModel(defaultProvider.id),
      aiBaseUrl: defaultProvider.baseUrl,
      aiLastTestStatus: "untested",
    };
  }
  const currentModel = getCurrentAiModel(settings.aiProvider, settings.aiModel);
  if (currentModel !== settings.aiModel) {
    return {
      aiModel: currentModel,
      aiLastTestStatus: "untested",
    };
  }

  const legacyDefaultModels = new Set<string>(LEGACY_DEFAULT_AI_MODELS);
  const oldQwenDefaultModels = new Set(["qwen3.7-max"]);

  if (
    settings.aiProvider === "openai" &&
    legacyDefaultModels.has(settings.aiModel) &&
    !settings.aiEnabled &&
    !settings.aiApiKey
  ) {
    const openAiDefaultModel = getDefaultAiModel("openai");
    return {
      aiModel: openAiDefaultModel,
      aiLastTestStatus: "untested",
    };
  }

  if (
    settings.aiProvider === DEFAULT_AI_PROVIDER_ID &&
    oldQwenDefaultModels.has(settings.aiModel) &&
    !settings.aiEnabled &&
    !settings.aiApiKey
  ) {
    const defaultProvider = getAiProvider(DEFAULT_AI_PROVIDER_ID);
    const defaultModel = getDefaultAiModel(defaultProvider.id);
    return {
      aiProvider: defaultProvider.id,
      aiModel: defaultModel,
      aiBaseUrl: defaultProvider.baseUrl,
      aiLastTestStatus: "untested",
    };
  }

  if (
    settings.aiProvider === DEFAULT_AI_PROVIDER_ID &&
    settings.aiBaseUrl === getAiProvider("deepseek").baseUrl &&
    !settings.aiEnabled &&
    !settings.aiApiKey
  ) {
    const defaultProvider = getAiProvider(DEFAULT_AI_PROVIDER_ID);
    const defaultModel = getDefaultAiModel(defaultProvider.id);
    return {
      aiProvider: defaultProvider.id,
      aiModel: settings.aiModel || defaultModel,
      aiBaseUrl: defaultProvider.baseUrl,
      aiLastTestStatus: "untested",
    };
  }

  return null;
}
