import { getEffectiveAiRuntimeSettings, recordAiSettingsTest, updateAiSettings } from "@/lib/repository";
import { testAiConnection } from "@/lib/ai/tasks";
import type { AiSettingsInput } from "@/lib/ai/settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (rawBody.trim()) {
      let input: unknown;
      try {
        input = JSON.parse(rawBody);
      } catch {
        return Response.json({ message: "AI 设置测试参数格式不正确。" }, { status: 400 });
      }

      await updateAiSettings(input as AiSettingsInput);
    }

    const settings = await getEffectiveAiRuntimeSettings();
    const result = await testAiConnection(settings);
    const payload = await recordAiSettingsTest(result.source === "ai" && result.data.ok ? "success" : "failed");

    return Response.json({
      ...payload,
      result,
    });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "AI 连接测试失败。" },
      { status: 400 },
    );
  }
}
