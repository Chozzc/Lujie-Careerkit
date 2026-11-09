import type { ResumeSection } from "@/types/resume";

const inlineSectionTypes = new Set([
  "education", "certifications",
]);

export function supportsInlineLayout(sectionType: string) {
  return inlineSectionTypes.has(sectionType);
}

export function getInlineLayoutFields(section: ResumeSection) {
  const fields: Record<string, string[]> = {
    education: ["institution", "degree", "field", "gpa", "date", "highlights"],
    certifications: ["name", "issuer", "date"],
  };
  return fields[section.type] ?? [];
}

export function isResumeFieldBold(section: ResumeSection, field: string) {
  return getResumeBoldFields(section).includes(field);
}

export function getResumeBoldFields(section: ResumeSection): string[] {
  if (!supportsInlineLayout(section.type)) return [];
  if (Array.isArray(section.content?.inlineBoldFields)) {
    const fields = getInlineLayoutFields(section);
    return section.content.inlineBoldFields.filter((field) => fields.includes(field));
  }
  return section.type === "education" ? ["degree"] : ["name"];
}
