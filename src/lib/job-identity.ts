import type { JobAnalysis } from "./types";

export function inferJobIdentity(
  jd: string,
  analysis?: Pick<JobAnalysis, "company" | "title"> | null,
) {
  const firstMeaningfulLine = jd
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
  const identityParts = firstMeaningfulLine.split(/\s*[-—｜|·]\s*/).map((part) => part.trim());
  const [lineCompany = "", lineTitle = ""] = identityParts.length > 1 ? identityParts : [];

  return {
    company: cleanJobIdentityLabel(analysis?.company) || cleanJobIdentityLabel(lineCompany) || "目标公司",
    title: cleanJobIdentityLabel(analysis?.title) || cleanJobIdentityLabel(lineTitle) || "目标岗位",
  };
}

function cleanJobIdentityLabel(value?: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (/待|未知|未识别|目标公司|目标岗位|�/.test(text)) return "";
  if (text.length > 32) return "";
  return text;
}
