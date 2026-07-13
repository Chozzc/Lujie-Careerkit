export type NormalizedAiError = {
  code:
    | "codex_bridge_unavailable"
    | "codex_not_authenticated"
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

  if (
    (lower.includes("codex bridge") || lower.includes("codex service")) &&
    (lower.includes("unavailable") || lower.includes("token"))
  ) {
    return {
      code: "codex_bridge_unavailable",
      message: "Codex 服务不可用，请确认服务正在运行后重试。",
    };
  }

  if (lower.includes("codex") && (lower.includes("invalid_output") || lower.includes("invalid_schema"))) {
    return {
      code: "invalid_json",
      message: "Codex 返回的结构化结果不符合当前任务要求，请重试；若持续出现，请检查 Codex 服务日志。",
    };
  }

  if (lower.includes("codex bridge") || lower.includes("codex service") || lower.includes("codex_failed")) {
    return {
      code: "unknown",
      message: "Codex 执行失败，请重试；若持续出现，请确认 Codex 服务仍在运行并检查其日志。",
    };
  }

  if (lower.includes("codex") && (lower.includes("not authenticated") || lower.includes("codex login"))) {
    return {
      code: "codex_not_authenticated",
      message: "Codex 尚未登录，请在 Codex 服务中完成设备码登录后重试。",
    };
  }

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
      message: "模型返回格式不符合要求，请重试或切换模型。",
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
