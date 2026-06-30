import { z } from "zod";

import { updateResume } from "@/lib/repository";

const resumeSchema = z.object({
  content: z.unknown(),
});

export async function POST(request: Request) {
  const body = resumeSchema.parse(await request.json());
  const resume = await updateResume(body.content as never);
  return Response.json({
    resume: {
      id: resume.id,
      name: resume.name,
      content: resume.content,
      updatedAt: resume.updatedAt.toISOString(),
    },
  });
}
