import type { RedactedAiSettings } from "@/lib/ai/settings";

export function isAiReady(settings: RedactedAiSettings | null) {
  if (!settings?.aiEnabled) return false;
  if (settings.requiresApiKey && !settings.hasApiKey) return false;
  return settings.aiLastTestStatus === "success";
}

export function aiReadinessMessage(settings: RedactedAiSettings | null) {
  if (!settings) return "AI 模型尚未配置。请先在设置页选择 Provider、填写模型与密钥，并测试连接。";
  if (!settings.aiEnabled) return "AI 功能当前未启用。请在设置页开启并测试连接。";
  if (settings.aiRuntimeMode === "codex-bridge" && settings.aiLastTestStatus === "failed") {
    return "上次 Codex 连接测试失败。请确认 Codex Bridge 服务正在运行且已完成登录。";
  }
  if (settings.aiRuntimeMode === "codex-bridge" && settings.aiLastTestStatus !== "success") {
    return "Codex Bridge 尚未通过连接测试。请先在设置页检测并测试连接。";
  }
  if (settings.requiresApiKey && !settings.hasApiKey) return "当前 Provider 需要 API Key。请先在设置页保存密钥。";
  if (settings.aiLastTestStatus === "failed") return "上次 AI 连接测试失败。请检查 Base URL、模型名称或密钥后重新测试。";
  if (settings.aiLastTestStatus !== "success") return "AI 设置尚未通过连接测试。请先在设置页点击测试连接。";
  return "AI 功能可用。";
}

export function isResumeImportAiReady(settings: RedactedAiSettings | null) {
  return isAiReady(settings);
}
