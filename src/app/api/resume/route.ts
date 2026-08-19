import { z } from "zod";

import { parseJsonRequest } from "@/lib/api-request";
import { resumeContentInputSchema } from "@/lib/resume-content";
import { updateResume } from "@/lib/repository";

const resumeSchema = z.object({
  versionId: z.string().trim().min(1),
  name: z.string().max(200).optional(),
  content: resumeContentInputSchema,
});

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, resumeSchema);
  if (!parsed.success) return parsed.response;
  const resume = await updateResume(parsed.data.versionId, parsed.data.content, parsed.data.name);
  return Response.json({
    resume: {
      id: resume.id,
      resumeId: resume.resumeId,
      name: resume.name,
      content: resume.content,
      updatedAt: resume.updatedAt.toISOString(),
    },
  });
}
