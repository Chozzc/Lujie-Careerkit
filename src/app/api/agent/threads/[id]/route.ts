import { deleteAgentThread, getAgentThread } from "@/lib/agent/thread-store";

export async function GET(_request: Request, context: RouteContext<"/api/agent/threads/[id]">) {
  const { id } = await context.params;
  const thread = await getAgentThread(id);
  if (!thread) return Response.json({ error: "对话不存在。" }, { status: 404 });
  return Response.json({ thread });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/agent/threads/[id]">) {
  const { id } = await context.params;
  const thread = await getAgentThread(id);
  if (!thread) return Response.json({ error: "对话不存在。" }, { status: 404 });
  await deleteAgentThread(id);
  return Response.json({ ok: true });
}
