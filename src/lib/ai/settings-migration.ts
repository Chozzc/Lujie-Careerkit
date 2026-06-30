import { getDefaultAiModel, LEGACY_DEFAULT_AI_MODELS } from "./provider-registry";
import type { AiTestStatus } from "./settings";

type StoredAiSettingsForMaintenance = {
  aiProvider: string;
  aiModel: string;
  model: string;
  aiApiKey: string;
  aiEnabled: boolean;
};

type AiSettingsMaintenancePatch = {
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

  return null;
}
