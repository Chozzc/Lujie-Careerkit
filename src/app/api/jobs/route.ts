import { z } from "zod";

import { dateInputSchema, parseJsonRequest } from "@/lib/api-request";
import { createJob } from "@/lib/repository";

const jobSchema = z.object({
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  city: z.string().optional(),
  source: z.string().optional(),
  jd: z.string().trim().min(1),
  link: z.string().optional(),
  deadline: dateInputSchema.nullable().optional(),
});

export function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, jobSchema);
  if (!parsed.success) return parsed.response;
  try {
    const job = await createJob(parsed.data);
    return Response.json({ job });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("多个岗位符合")) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
