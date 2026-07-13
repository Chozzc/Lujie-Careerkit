import { getCodexBridgeHealth, getCodexBridgeModels } from "@/lib/ai/codex-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const health = await getCodexBridgeHealth();
    const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
    try {
      return Response.json({ ...health, models: await getCodexBridgeModels({ forceRefresh }) });
    } catch (error) {
      return Response.json({
        ...health,
        models: [],
        modelsMessage: error instanceof Error ? error.message : "Codex 模型目录不可用。",
      });
    }
  } catch (error) {
    return Response.json(
      {
        status: "unavailable",
        installed: false,
        authenticated: false,
        version: null,
        activeRequests: 0,
        queuedRequests: 0,
        models: [],
        message: error instanceof Error ? error.message : "Codex 不可用。",
      },
      { status: 503 },
    );
  }
}
