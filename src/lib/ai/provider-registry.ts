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
export const DEFAULT_AI_MODEL = "qwen3.6-flash";
export const LEGACY_DEFAULT_AI_MODELS = ["gpt-4o-mini", "gpt-5.4-mini", "deepseek-v4-flash"] as const;

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
    defaultModel: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "qwen",
    label: "通义千问 / 阿里云百炼",
    group: "domestic",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen3.6-flash",
    models: [
      "qwen3.6-flash",
      "qwen3.7-max",
      "qwen3.7-max-2026-06-08",
      "qwen3.7-max-2026-05-20",
      "qwen3.7-max-preview",
      "qwen3.7-plus",
      "qwen3.7-plus-2026-05-26",
      "qwen3.6-max-preview",
      "qwen3.6-plus",
      "qwen3-max",
      "qwen3-plus",
      "qwen3-coder-plus",
      "qwen3-coder-next",
      "qwen3-vl-max",
      "qwen3-vl-plus",
      "qwen3-omni-flash",
    ],
  },
  {
    id: "moonshot",
    label: "Moonshot / Kimi",
    group: "domestic",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.6",
    models: ["kimi-k2.6", "kimi-k2.5", "kimi-k2-thinking"],
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    group: "domestic",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-5.1",
    models: ["glm-5.1", "glm-5-turbo", "glm-5"],
  },
  {
    id: "volcengine",
    label: "火山方舟 / 豆包",
    group: "domestic",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-2-0-lite-260428",
    models: [
      "doubao-seed-2-0-lite-260428",
      "doubao-seed-2-0-mini-260428",
      "doubao-seed-2-0-pro-260215",
      "doubao-seed-2-0-lite-260215",
      "doubao-seed-2-0-mini-260215",
      "doubao-seed-1-8",
      "doubao-seed-1-6-251015",
      "doubao-seed-1-6-thinking",
      "doubao-seed-1-6",
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
      "deepseek-ai/DeepSeek-V3.1-Terminus",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen3.7-Max",
      "Qwen/Qwen3.7-Plus",
      "Qwen/Qwen3.6-Max",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "moonshotai/Kimi-K2.6",
      "zai-org/GLM-5.1",
      "zai-org/GLM-5",
      "MiniMaxAI/MiniMax-M2.5",
      "MiniMaxAI/MiniMax-M2",
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    group: "international",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.5",
    models: [
      "gpt-5.5",
      "gpt-5.3-codex",
      "chat-latest",
      "o4-mini",
    ],
  },
  {
    id: "anthropic-via-openrouter",
    label: "Anthropic Claude",
    group: "international",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-fable-5",
    models: [
      "anthropic/claude-fable-5",
      "anthropic/claude-opus-4.8",
      "anthropic/claude-sonnet-4.6",
      "anthropic/claude-haiku-4.5",
    ],
  },
  {
    id: "gemini-via-openrouter",
    label: "Google Gemini",
    group: "international",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-3.5-flash",
    models: [
      "google/gemini-3.5-flash",
      "google/gemini-3.1-pro-preview",
      "google/gemini-3.1-flash",
      "google/gemini-3.1-flash-lite",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    group: "international",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-medium-3.5",
    models: [
      "mistral-medium-3.5",
      "mistral-small-4",
      "mistral-3",
      "mistral-large-latest",
      "mistral-medium-latest",
      "mistral-small-latest",
      "magistral-medium-latest",
      "magistral-small-latest",
      "devstral-medium-latest",
      "codestral-latest",
    ],
  },
  {
    id: "xai",
    label: "xAI Grok",
    group: "international",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4.3",
    models: ["grok-4.3", "grok-build-0.1", "grok-4", "grok-code-fast-1", "grok-3", "grok-3-mini"],
  },
  {
    id: "groq",
    label: "Groq",
    group: "international",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "groq/compound",
    models: [
      "groq/compound",
      "groq/compound-mini",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "moonshotai/kimi-k2-instruct-0905",
      "llama-3.3-70b-versatile",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "deepseek-r1-distill-llama-70b",
      "qwen/qwen3-32b",
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    group: "aggregator",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-5.5",
    models: [
      "openai/gpt-5.5",
      "anthropic/claude-fable-5",
      "anthropic/claude-opus-4.8",
      "anthropic/claude-sonnet-4.6",
      "google/gemini-3.5-flash",
      "google/gemini-3.1-pro-preview",
      "deepseek/deepseek-v4-pro",
      "deepseek/deepseek-v4-flash",
      "qwen/qwen3.7-max",
      "qwen/qwen3.7-plus",
      "moonshotai/kimi-k2.6",
      "z-ai/glm-5.1",
      "z-ai/glm-5",
      "x-ai/grok-4.3",
      "mistralai/mistral-medium-3.5",
      "mistralai/mistral-small-4",
      "openai/gpt-oss-120b",
      "meta-llama/llama-4-maverick",
    ],
  },
  {
    id: "one-api",
    label: "One API / New API",
    group: "aggregator",
    baseUrl: "http://localhost:3001/v1",
    defaultModel: "gpt-5.5",
    models: [
      "gpt-5.5",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "kimi-k2.6",
      "qwen3.7-max",
      "qwen3.7-plus",
      "glm-5.1",
      "glm-5",
      "grok-4.3",
      "claude-fable-5",
      "claude-opus-4.8",
      "claude-sonnet-4.6",
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "mistral-medium-3.5",
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
    defaultModel: "gpt-5.5",
    models: [
      "gpt-5.5",
      "deepseek-v4-pro",
      "qwen3.7-max",
      "qwen3.7-plus",
      "kimi-k2.6",
      "glm-5.1",
      "claude-fable-5",
      "claude-opus-4.8",
      "claude-sonnet-4.6",
      "gemini-3.5-flash",
      "grok-4.3",
    ],
    baseUrlEditable: true,
  },
];

const CUSTOM_PROVIDER = AI_PROVIDERS.find((provider) => provider.id === "custom-openai-compatible");

export function getAiProvider(providerId: string | null | undefined) {
  return AI_PROVIDERS.find((provider) => provider.id === providerId) ?? CUSTOM_PROVIDER ?? AI_PROVIDERS[0];
}

export function getDefaultAiModel(providerId: string | null | undefined) {
  return getAiProvider(providerId).defaultModel;
}

export function requiresBaseUrl(providerId: string | null | undefined) {
  return Boolean(getAiProvider(providerId).baseUrlEditable);
}

export function providerRequiresApiKey(providerId: string | null | undefined) {
  return !getAiProvider(providerId).apiKeyOptional;
}
