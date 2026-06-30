import { getAiSettingsPayload, updateAiSettings } from "@/lib/repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await getAiSettingsPayload());
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json();
    return Response.json(await updateAiSettings(input));
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "AI 设置保存失败。" },
      { status: 400 },
    );
  }
}
