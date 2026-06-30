export function buildAiResumeSnapshot(resume: unknown) {
  if (!resume || typeof resume !== "object" || Array.isArray(resume)) return resume;
  const safeResume = { ...(resume as Record<string, unknown>) };
  delete safeResume.editor;
  const basics = safeResume.basics;
  if (!basics || typeof basics !== "object" || Array.isArray(basics)) return safeResume;
  const safeBasics = { ...(basics as Record<string, unknown>) };
  delete safeBasics.email;
  delete safeBasics.phone;
  delete safeBasics.links;
  return { ...safeResume, basics: safeBasics };
}
