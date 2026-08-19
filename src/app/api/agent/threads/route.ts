import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { createAgentThread, listAgentThreads } from "@/lib/agent/thread-store";

const createThreadSchema = z.object({
  title: z.string().trim().max(60).optional(),
});

export async function GET() {
  return Response.json({ threads: await listAgentThreads() });
}

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, createThreadSchema);
  if (!parsed.success) return parsed.response;
  return Response.json({ thread: await createAgentThread(parsed.data.title) });
}
