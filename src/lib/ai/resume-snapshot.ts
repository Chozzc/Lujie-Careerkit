export function buildAiResumeSnapshot(resume: unknown) {
  if (!resume || typeof resume !== "object" || Array.isArray(resume)) return resume;
  const safeResume = { ...(resume as Record<string, unknown>) };
  delete safeResume.editor;
  for (const key of ["experiences", "internships", "projects"]) {
    const items = safeResume[key];
    if (Array.isArray(items)) safeResume[key] = items.map(withoutLogo);
  }
  const basics = safeResume.basics;
  if (!basics || typeof basics !== "object" || Array.isArray(basics)) return safeResume;
  const safeBasics = { ...(basics as Record<string, unknown>) };
  delete safeBasics.email;
  delete safeBasics.phone;
  delete safeBasics.links;
  return { ...safeResume, basics: safeBasics };
}

function withoutLogo(item: unknown) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const next = { ...(item as Record<string, unknown>) };
  delete next.logo;
  return next;
}
