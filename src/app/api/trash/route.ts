import { z } from "zod";
import { parseJsonRequest } from "@/lib/api-request";
import { listTrash, permanentlyDeleteTrash, restoreAllTrash, restoreTrash, trashKinds } from "@/lib/trash";
import { getAppData } from "@/lib/repository";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restore"), kind: z.enum(trashKinds), id: z.string().min(1) }),
  z.object({ action: z.literal("restoreAll") }),
  z.object({ action: z.literal("delete"), kind: z.enum(trashKinds), id: z.string().min(1), confirmed: z.literal(true) }),
  z.object({ action: z.literal("empty"), confirmed: z.literal(true) }),
]);

export async function GET() {
  return Response.json({ items: await listTrash() });
}

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, actionSchema);
  if (!parsed.success) return parsed.response;
  try {
    const input = parsed.data;
    if (input.action === "restore") await restoreTrash(input.kind, input.id);
    else if (input.action === "restoreAll") await restoreAllTrash();
    else if (input.action === "delete") await permanentlyDeleteTrash(input.kind, input.id);
    else await permanentlyDeleteTrash();
    return Response.json({ items: await listTrash(), data: await getAppData() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "操作失败，资料仍保留在回收站。" }, { status: 409 });
  }
}
