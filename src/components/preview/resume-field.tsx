import type { CSSProperties, ReactNode } from "react";
import { isResumeFieldBold } from "@/lib/resume-inline-layout";
import type { EducationItem, ResumeSection } from "@/types/resume";

export function resumeField(section: ResumeSection, field: string, value: ReactNode) {
  if (isResumeFieldBold(section, field)) return <b>{value}</b>;
  return (section.type === "education" && ["institution", "degree", "field", "gpa"].includes(field)) || section.type === "certifications"
    ? <span data-education-regular>{value}</span>
    : value;
}

export function resumeDegree(section: ResumeSection, degree: string, field?: string) {
  return <>{resumeField(section, "degree", degree)}{degree && field ? " - " : null}{resumeField(section, "field", field)}</>;
}

export function resumeEducationHeading(
  item: Pick<EducationItem, "degree" | "field" | "institution">,
  compact: boolean,
  heading: ReactNode,
  detail: ReactNode,
  gpa: ReactNode,
  schoolFirst = false,
) {
  if (!compact) return heading;
  const [degree, school] = schoolFirst ? [detail, heading] : [heading, detail];
  return <div data-education-merged>{degree}{(item.degree || item.field) && item.institution ? " - " : null}{school}{gpa}</div>;
}

export function resumeEducationDates(section: ResumeSection, start?: string, end?: string, separator = " - ", present = "") {
  const from = start?.trim();
  const to = end?.trim();
  if (!from && !to) return null;
  return resumeField(section, "date", from ? [from, to || present].filter(Boolean).join(separator) : to);
}

export function resumeEducationGpa(
  section: ResumeSection,
  gpa?: string,
  inline = false,
  templateStyle?: { className?: string; style?: CSSProperties },
) {
  if (!gpa) return null;
  return <span {...templateStyle} data-education-gpa-inline={inline || undefined}>
    {resumeField(section, "gpa", `GPA: ${gpa}`)}
  </span>;
}
