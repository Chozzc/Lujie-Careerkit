import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { updateResume } from "@/lib/repository";

const resumeSchema = z.object({
  content: resumeContentInputSchema,
});

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, resumeSchema);
  if (!parsed.success) return parsed.response;
  const resume = await updateResume(parsed.data.content);
  return Response.json({
    resume: {
      id: resume.id,
      name: resume.name,
      content: resume.content,
      updatedAt: resume.updatedAt.toISOString(),
    },
  });
}
