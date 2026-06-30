import { z } from "zod";

import {
  AI_PROVIDER_GROUPS,
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER_ID,
  getAiProvider,
  getDefaultAiModel,
  providerRequiresApiKey,
} from "./provider-registry";
import { decryptLocalSecret, encryptLocalSecret, previewSecret } from "./secrets";

export type AiTestStatus = "untested" | "success" | "failed";

export type StoredAiSettings = {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiEnabled: boolean;
  aiTemperature: number;
  aiLastTestedAt: Date | string | null;
  aiLastTestStatus: string;
};

export type AiSettingsPatch = {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiEnabled: boolean;
  aiTemperature: number;
  aiLastTestStatus: AiTestStatus;
};

export type RedactedAiSettings = {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiEnabled: boolean;
  aiTemperature: number;
  aiLastTestedAt: string | null;
  aiLastTestStatus: AiTestStatus;
  hasApiKey: boolean;
  apiKeyPreview: string;
  requiresApiKey: boolean;
};

export type EffectiveAiSettings = {
  provider: ReturnType<typeof getAiProvider>;
  providerId: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  temperature: number;
  requiresApiKey: boolean;
};

const aiSettingsInputSchema = z.object({
  aiProvider: z.string().trim().min(1).default(DEFAULT_AI_PROVIDER_ID),
  aiModel: z.string().trim().optional().default(""),
  aiBaseUrl: z.string().trim().optional().default(""),
  aiApiKey: z.string().optional().default(""),
  clearApiKey: z.boolean().optional().default(false),
  aiEnabled: z.boolean().optional().default(false),
  aiTemperature: z.coerce.number().min(0).max(2).optional().default(0.3),
});

export type AiSettingsInput = z.input<typeof aiSettingsInputSchema>;

export const AI_SETTINGS_REGISTRY = {
  groups: AI_PROVIDER_GROUPS,
  providers: AI_PROVIDERS,
};

export function validateAiSettingsInput(input: AiSettingsInput) {
  const parsed = aiSettingsInputSchema.parse(input);
  const provider = getAiProvider(parsed.aiProvider);
  const model = parsed.aiModel || getDefaultAiModel(provider.id);
  const baseUrl = parsed.aiBaseUrl || provider.baseUrl;

  if (!isValidUrl(baseUrl)) {
    throw new Error("Base URL 格式不正确。");
  }

  return {
    ...parsed,
    aiProvider: provider.id,
    aiModel: model,
    aiBaseUrl: normalizeBaseUrl(baseUrl),
  };
}

export function buildAiSettingsPatch(
  input: AiSettingsInput,
  existing: { encryptedApiKey?: string | null } = {},
): AiSettingsPatch {
  const validated = validateAiSettingsInput(input);
  const previousKey = existing.encryptedApiKey ?? "";
  const nextKey = validated.clearApiKey
    ? ""
    : validated.aiApiKey.trim()
      ? encryptLocalSecret(validated.aiApiKey)
      : previousKey;
  const requiresApiKey = providerRequiresApiKey(validated.aiProvider);

  return {
    aiProvider: validated.aiProvider,
    aiModel: validated.aiModel,
    aiBaseUrl: validated.aiBaseUrl,
    aiApiKey: nextKey,
    aiEnabled: Boolean(validated.aiEnabled && (!requiresApiKey || nextKey)),
    aiTemperature: validated.aiTemperature,
    aiLastTestStatus: "untested",
  };
}

export function redactAiSettings(settings: StoredAiSettings): RedactedAiSettings {
  const effective = getEffectiveAiSettings(settings);

  return {
    aiProvider: effective.providerId,
    aiModel: effective.model,
    aiBaseUrl: effective.baseUrl,
    aiEnabled: effective.enabled,
    aiTemperature: effective.temperature,
    aiLastTestedAt: toIsoString(settings.aiLastTestedAt),
    aiLastTestStatus: normalizeTestStatus(settings.aiLastTestStatus),
    hasApiKey: Boolean(effective.apiKey),
    apiKeyPreview: previewSecret(effective.apiKey),
    requiresApiKey: effective.requiresApiKey,
  };
}

export function getEffectiveAiSettings(settings: StoredAiSettings): EffectiveAiSettings {
  const provider = getAiProvider(settings.aiProvider);
  const model = settings.aiModel?.trim() || provider.defaultModel;
  const baseUrl = normalizeBaseUrl(settings.aiBaseUrl?.trim() || provider.baseUrl);
  const apiKey = decryptLocalSecret(settings.aiApiKey);
  const requiresApiKey = providerRequiresApiKey(provider.id);

  return {
    provider,
    providerId: provider.id,
    model,
    baseUrl,
    apiKey,
    enabled: Boolean(settings.aiEnabled && (!requiresApiKey || apiKey)),
    temperature: settings.aiTemperature,
    requiresApiKey,
  };
}

export function normalizeTestStatus(value: string | null | undefined): AiTestStatus {
  if (value === "success" || value === "failed") return value;
  return "untested";
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toIsoString(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
