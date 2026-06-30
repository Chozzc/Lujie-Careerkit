import type { ResumeContent } from "./types";

export const UNTITLED_RESUME_NAME = "未命名简历";

export function buildAutomaticResumeTitle(personName: string) {
  const name = personName.trim();
  return name ? `${name}的简历` : UNTITLED_RESUME_NAME;
}

export function shouldAutoRenameResumeTitle(currentTitle: string, previousPersonName: string) {
  const title = currentTitle.trim();
  return (
    !title ||
    title === UNTITLED_RESUME_NAME ||
    title === buildAutomaticResumeTitle(previousPersonName)
  );
}

export function resolveResumeContentTitle(content: ResumeContent, currentTitle?: string) {
  const explicitTitle = currentTitle?.trim() || content.editor?.displayName?.trim() || "";
  if (explicitTitle && explicitTitle !== UNTITLED_RESUME_NAME) return explicitTitle;
  return buildAutomaticResumeTitle(content.basics.name);
}
