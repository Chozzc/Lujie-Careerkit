export type AiProviderGroupId = "domestic" | "international" | "aggregator" | "local" | "custom";

export type AiProviderDefinition = {
  id: string;
  label: string;
  group: AiProviderGroupId;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  baseUrlEditable?: boolean;
  apiKeyOptional?: boolean;
};

export const DEFAULT_AI_PROVIDER_ID = "qwen";
export const DEFAULT_AI_MODEL = "qwen3.8-flash";
export const LEGACY_DEFAULT_AI_MODELS = ["gpt-4o-mini", "gpt-5.4-mini", "deepseek-v4-flash", "qwen3.6-flash"] as const;

export const AI_PROVIDER_GROUPS: Array<{ id: AiProviderGroupId; label: string }> = [
  { id: "domestic", label: "国内模型" },
  { id: "international", label: "国际模型" },
  { id: "aggregator", label: "聚合网关" },
  { id: "local", label: "本地模型" },
  { id: "custom", label: "自定义" },
];

export const AI_PROVIDERS: AiProviderDefinition[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    group: "domestic",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-flash",
    models: ["deepseek-flash", "deepseek-v4-pro"],
  },
  {
    id: "minimax",
    label: "MiniMax",
    group: "domestic",
    baseUrl: "https://api.minimax.cn/v1",
    defaultModel: "MiniMax-M3",
    models: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.7-highspeed"],
  },
  {
    id: "qwen",
    label: "通义千问 / 阿里云百炼",
    group: "domestic",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen3.8-flash",
    models: [
      "qwen3.8-flash",
      "qwen3.8-max",
      "qwen3.7-plus",
      "qwen3.7-flash",
    ],
  },
  {
    id: "moonshot",
    label: "Moonshot / Kimi",
    group: "domestic",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k3",
    models: ["kimi-k3", "kimi-k2.6"],
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    group: "domestic",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-5.3-flash",
    models: ["glm-5.3-flash", "glm-5.3-flashx", "glm-5.3"],
  },
  {
    id: "volcengine",
    label: "火山方舟 / 豆包",
    group: "domestic",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-2-1-lite-260915",
    models: [
      "doubao-seed-2-1-lite-260915",
      "doubao-seed-2-1-pro-260915",
      "doubao-seed-2-0-mini-260428",
    ],
    baseUrlEditable: true,
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    group: "domestic",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V4-Pro",
    models: [
      "deepseek-ai/DeepSeek-V4-Pro",
      "deepseek-ai/DeepSeek-V4-Flash",
      "Qwen/Qwen3.8-27B",
      "Qwen/Qwen3.6-35B-A3B",
      "Qwen/Qwen3.6-27B",
      "Pro/moonshotai/Kimi-K2.6",
      "zai-org/GLM-5.3",
      "zai-org/GLM-5.2",
      "Pro/zai-org/GLM-5.1",
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    group: "international",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-6-luna",
    models: [
      "gpt-6-luna",
      "gpt-6.1-sol",
      "gpt-6-astra",
      "gpt-5.6",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ],
  },
  {
    id: "anthropic-via-openrouter",
    label: "Anthropic Claude",
    group: "international",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-fable-5.1",
    models: [
      "anthropic/claude-fable-5.1",
      "anthropic/claude-opus-5.5",
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-haiku-4.5",
    ],
  },
  {
    id: "gemini-via-openrouter",
    label: "Google Gemini",
    group: "international",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-3.8-flash",
    models: [
      "google/gemini-3.8-flash",
      "google/gemini-3.5-flash-lite",
      "google/gemini-3.1-pro-preview",
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    group: "international",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-medium-3-5",
    models: [
      "mistral-medium-3-5",
      "mistral-large-latest",
      "mistral-small-latest",
    ],
  },
  {
    id: "xai",
    label: "xAI Grok",
    group: "international",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4.7",
    models: ["grok-4.7"],
  },
  {
    id: "groq",
    label: "Groq",
    group: "international",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-120b",
    models: [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    group: "aggregator",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-6.1-sol",
    models: [
      "openai/gpt-6.1-sol",
      "openai/gpt-6-luna",
      "openai/gpt-6-astra",
      "openai/gpt-5.6-terra",
      "openai/gpt-5.6-luna",
      "anthropic/claude-fable-5.1",
      "anthropic/claude-opus-5.5",
      "anthropic/claude-sonnet-5.5",
      "google/gemini-3.8-flash",
      "google/gemini-3.5-flash-lite",
      "google/gemini-3.1-pro-preview",
      "deepseek/deepseek-v4-pro",
      "deepseek/deepseek-v4.1-flash",
      "qwen/qwen3.8-flash",
      "qwen/qwen3.8-max-0902",
      "qwen/qwen3.8-max-prime",
      "qwen/qwen3.7-plus",
      "moonshotai/kimi-k3",
      "minimax/minimax-m3",
      "minimax/minimax-m2.7",
      "z-ai/glm-5.3-flash",
      "z-ai/glm-5.3-flashx",
      "z-ai/glm-5.3",
      "z-ai/glm-5.3-prime",
      "x-ai/grok-4.7",
      "mistralai/mistral-medium-3-5",
      "openai/gpt-oss-120b",
    ],
  },
  {
    id: "one-api",
    label: "One API / New API",
    group: "aggregator",
    baseUrl: "http://localhost:3001/v1",
    defaultModel: "gpt-5.6",
    models: [
      "gpt-6.1-sol",
      "gpt-5.6",
      "deepseek-v4-pro",
      "deepseek-flash",
      "kimi-k3",
      "qwen3.8-flash",
      "qwen3.7-plus",
      "glm-5.3-flash",
      "grok-4.7",
      "claude-fable-5.1",
      "gemini-3.8-flash",
      "mistral-medium-3-5",
    ],
    baseUrlEditable: true,
  },
  {
    id: "ollama",
    label: "Ollama / LM Studio / vLLM",
    group: "local",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen3:8b",
    models: [
      "qwen3:8b",
      "qwen3.8:27b",
      "qwen3:14b",
      "qwen3:32b",
      "qwen3-coder:30b",
      "deepseek-r1:8b",
      "deepseek-r1:14b",
      "deepseek-v3.1:latest",
      "gpt-oss:20b",
      "gpt-oss:120b",
      "llama3.3:70b",
      "llama3.1:8b",
      "mistral-small:latest",
    ],
    baseUrlEditable: true,
    apiKeyOptional: true,
  },
  {
    id: "custom-openai-compatible",
    label: "自定义 OpenAI-compatible",
    group: "custom",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.6",
    models: [
      "gpt-6.1-sol",
      "gpt-5.6",
      "deepseek-v4-pro",
      "qwen3.8-flash",
      "qwen3.7-plus",
      "kimi-k3",
      "glm-5.3-flash",
      "claude-fable-5.1",
      "gemini-3.8-flash",
      "grok-4.7",
    ],
    baseUrlEditable: true,
  },
];

const CUSTOM_PROVIDER = AI_PROVIDERS.find((provider) => provider.id === "custom-openai-compatible");

const AI_MODEL_RENAMES: Record<string, Record<string, string>> = {
  deepseek: {
    "deepseek-v4-flash": "deepseek-flash",
  },
  qwen: {
    "qwen3.6-flash": "qwen3.8-flash",
  },
  moonshot: {
    "kimi-k2.5": "kimi-k2.6",
  },
  "gemini-via-openrouter": {
    "google/gemini-3.8-flash-lite": "google/gemini-3.5-flash-lite",
  },
  groq: {
    "groq/compound": "openai/gpt-oss-120b",
    "groq/compound-mini": "openai/gpt-oss-20b",
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
  },
  mistral: {
    "mistral-medium-3.5": "mistral-medium-3-5",
    "mistral-small-4": "mistral-small-2603",
  },
  openrouter: {
    "google/gemini-3.8-flash-lite": "google/gemini-3.5-flash-lite",
    "openai/gpt-5.6": "openai/gpt-5.6-sol",
    "deepseek/deepseek-v4-flash": "deepseek/deepseek-v4.1-flash",
    "mistralai/mistral-medium-3.5": "mistralai/mistral-medium-3-5",
    "mistralai/mistral-small-4": "mistralai/mistral-small-2603",
  },
  siliconflow: {
    "moonshotai/Kimi-K2.6": "Pro/moonshotai/Kimi-K2.6",
    "zai-org/GLM-5.1": "Pro/zai-org/GLM-5.1",
    "zai-org/GLM-5": "Pro/zai-org/GLM-5.1",
    "Qwen/Qwen3.7-Max": "Qwen/Qwen3.6-35B-A3B",
    "Qwen/Qwen3.7-Plus": "Qwen/Qwen3.6-35B-A3B",
    "Qwen/Qwen3.6-Max": "Qwen/Qwen3.6-35B-A3B",
  },
};

export function getAiProvider(providerId: string | null | undefined) {
  return AI_PROVIDERS.find((provider) => provider.id === providerId) ?? CUSTOM_PROVIDER ?? AI_PROVIDERS[0];
}

export function getDefaultAiModel(providerId: string | null | undefined) {
  return getAiProvider(providerId).defaultModel;
}

export function getCurrentAiModel(providerId: string | null | undefined, model: string | null | undefined) {
  const provider = getAiProvider(providerId);
  const value = model?.trim() || provider.defaultModel;
  return AI_MODEL_RENAMES[provider.id]?.[value] ?? value;
}

export function requiresBaseUrl(providerId: string | null | undefined) {
  return Boolean(getAiProvider(providerId).baseUrlEditable);
}

export function providerRequiresApiKey(providerId: string | null | undefined) {
  return !getAiProvider(providerId).apiKeyOptional;
}
