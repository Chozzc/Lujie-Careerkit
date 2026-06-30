export type NormalizedAiError = {
  code:
    | "missing_api_key"
    | "unauthorized"
    | "rate_limited"
    | "unsupported_model"
    | "network"
    | "invalid_json"
    | "unknown";
  message: string;
};

export function normalizeAiError(error: unknown): NormalizedAiError {
  const text = safeErrorText(error);
  const lower = text.toLowerCase();

  if (lower.includes("missing") && lower.includes("api key")) {
    return {
      code: "missing_api_key",
      message: "缺少 API Key，请在设置页保存对应模型服务的密钥。",
    };
  }

  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("invalid api key") ||
    lower.includes("authentication")
  ) {
    return {
      code: "unauthorized",
      message: "AI 密钥校验失败，请检查设置页保存的密钥是否正确。",
    };
  }

  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota")
  ) {
    return {
      code: "rate_limited",
      message: "AI 服务触发限流或额度不足，请稍后重试或更换模型服务。",
    };
  }

  if (lower.includes("model") || lower.includes("404") || lower.includes("not found")) {
    return {
      code: "unsupported_model",
      message: "当前模型不可用，请检查模型名称或切换到该服务支持的模型。",
    };
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted") ||
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("socket")
  ) {
    return {
      code: "network",
      message: "AI 请求失败，请检查网络连接、Base URL 或本地模型服务是否启动。",
    };
  }

  if (lower.includes("json") || lower.includes("schema") || lower.includes("parse")) {
    return {
      code: "invalid_json",
      message: "模型返回格式不符合要求，已保留本地规则结果。",
    };
  }

  return {
    code: "unknown",
    message: "AI 请求失败，请检查设置页的 Provider、模型和网络连接。",
  };
}

function safeErrorText(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return raw.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]");
}
