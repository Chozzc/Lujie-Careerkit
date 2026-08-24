import type { RedactedAiSettings } from "@/lib/ai/settings";

export function isAiReady(settings: RedactedAiSettings | null) {
  if (!settings) return false;
  if (settings.requiresApiKey && !settings.hasApiKey) return false;
  return settings.aiLastTestStatus !== "failed";
}

export function aiReadinessMessage(settings: RedactedAiSettings | null) {
  if (!settings) return "AI 模型尚未配置。请先在设置页选择 Provider、填写模型与密钥，并测试连接。";
  if (settings.requiresApiKey && !settings.hasApiKey) return "当前 Provider 需要 API Key。请先在设置页保存密钥。";
  if (settings.aiLastTestStatus === "failed") return "上次 AI 连接测试失败。请检查 Base URL、模型名称或密钥后重新测试。";
  return "AI 功能可用。";
}

export function isResumeImportAiReady(settings: RedactedAiSettings | null) {
  return isAiReady(settings);
}
