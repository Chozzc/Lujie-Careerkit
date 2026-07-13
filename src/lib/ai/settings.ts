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
export type AiRuntimeMode = "api" | "codex-bridge";
export type CodexReasoning = "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

export type StoredAiSettings = {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiEnabled: boolean;
  aiTemperature: number;
  aiLastTestedAt: Date | string | null;
  aiLastTestStatus: string;
  aiRuntimeMode?: string;
  codexModel?: string;
  codexReasoning?: string;
};

export type AiSettingsPatch = {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiEnabled: boolean;
  aiTemperature: number;
  aiLastTestStatus: AiTestStatus;
  aiRuntimeMode: AiRuntimeMode;
  codexModel: string;
  codexReasoning: CodexReasoning;
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
  aiRuntimeMode: AiRuntimeMode;
  codexModel: string;
  codexReasoning: CodexReasoning;
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
  runtimeMode: AiRuntimeMode;
  codexModel: string;
  codexReasoning: CodexReasoning;
};

const aiSettingsInputSchema = z.object({
  aiProvider: z.string().trim().min(1).default(DEFAULT_AI_PROVIDER_ID),
  aiModel: z.string().trim().optional().default(""),
  aiBaseUrl: z.string().trim().optional().default(""),
  aiApiKey: z.string().optional().default(""),
  clearApiKey: z.boolean().optional().default(false),
  aiEnabled: z.boolean().optional().default(true),
  aiTemperature: z.coerce.number().min(0).max(2).optional().default(0.3),
  aiRuntimeMode: z.enum(["api", "codex-bridge"]).optional().default("api"),
  codexModel: z.string().trim().optional().default("default"),
  codexReasoning: z.enum(["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]).optional().default("medium"),
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
  return {
    aiProvider: validated.aiProvider,
    aiModel: validated.aiModel,
    aiBaseUrl: validated.aiBaseUrl,
    aiApiKey: nextKey,
    aiEnabled: Boolean(validated.aiEnabled),
    aiTemperature: validated.aiTemperature,
    aiLastTestStatus: "untested",
    aiRuntimeMode: validated.aiRuntimeMode,
    codexModel: validated.codexModel || "default",
    codexReasoning: validated.codexReasoning,
  };
}

export function redactAiSettings(settings: StoredAiSettings): RedactedAiSettings {
  const effective = getEffectiveAiSettings(settings);

  return {
    aiProvider: effective.providerId,
    aiModel: effective.model,
    aiBaseUrl: effective.baseUrl,
    aiEnabled: Boolean(settings.aiEnabled),
    aiTemperature: effective.temperature,
    aiLastTestedAt: toIsoString(settings.aiLastTestedAt),
    aiLastTestStatus: normalizeTestStatus(settings.aiLastTestStatus),
    hasApiKey: Boolean(effective.apiKey),
    apiKeyPreview: previewSecret(effective.apiKey),
    requiresApiKey: effective.requiresApiKey,
    aiRuntimeMode: effective.runtimeMode,
    codexModel: effective.codexModel,
    codexReasoning: effective.codexReasoning,
  };
}

export function getEffectiveAiSettings(settings: StoredAiSettings): EffectiveAiSettings {
  const provider = getAiProvider(settings.aiProvider);
  const model = settings.aiModel?.trim() || provider.defaultModel;
  const baseUrl = normalizeBaseUrl(settings.aiBaseUrl?.trim() || provider.baseUrl);
  const apiKey = decryptLocalSecret(settings.aiApiKey);
  const runtimeMode = normalizeRuntimeMode(settings.aiRuntimeMode);
  const requiresApiKey = runtimeMode === "api" && providerRequiresApiKey(provider.id);
  const codexModel = settings.codexModel?.trim() || "default";
  const codexReasoning = normalizeCodexReasoning(settings.codexReasoning);

  return {
    provider,
    providerId: provider.id,
    model,
    baseUrl,
    apiKey,
    enabled: Boolean(settings.aiEnabled && (!requiresApiKey || apiKey)),
    temperature: settings.aiTemperature,
    requiresApiKey,
    runtimeMode,
    codexModel,
    codexReasoning,
  };
}

export function normalizeRuntimeMode(value: string | null | undefined): AiRuntimeMode {
  return value === "codex-bridge" ? "codex-bridge" : "api";
}

export function normalizeCodexReasoning(value: string | null | undefined): CodexReasoning {
  return value === "minimal" || value === "low" || value === "high" || value === "xhigh" || value === "max" || value === "ultra"
    ? value
    : "medium";
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
