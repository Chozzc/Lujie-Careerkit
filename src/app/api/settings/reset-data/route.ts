import { getAppData, moveWorkspaceToTrashAndRestoreSamples } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST() {
  try {
    await moveWorkspaceToTrashAndRestoreSamples();
    return Response.json({ data: await getAppData() });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "本地数据重置失败。" },
      { status: 500 },
    );
  }
}
