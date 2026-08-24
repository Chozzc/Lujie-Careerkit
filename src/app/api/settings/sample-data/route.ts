import { clearSampleData } from "@/lib/repository";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    return Response.json({ data: await clearSampleData() });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "示例数据清理失败。" },
      { status: 500 },
    );
  }
}
