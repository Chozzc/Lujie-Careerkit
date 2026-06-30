import type { ResumeContent } from "./types";

export type ResumeUploadKind = "json" | "text" | "pdf" | "word";

export type UploadedResumeDraft = {
  fileName: string;
  content: ResumeContent;
  characterCount: number;
};

export const RESUME_UPLOAD_ACCEPT = [
  ".json",
  ".txt",
  ".md",
  ".pdf",
  ".doc",
  ".docx",
  "application/json",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

export function getResumeUploadKind(fileName: string): ResumeUploadKind | null {
  const extension = fileName.trim().toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (extension === "json") return "json";
  if (extension === "txt" || extension === "md") return "text";
  if (extension === "pdf") return "pdf";
  if (extension === "doc" || extension === "docx") return "word";
  return null;
}

export async function buildUploadedResumeDraft(file: File): Promise<UploadedResumeDraft> {
  const uploadKind = getResumeUploadKind(file.name);
  if (!uploadKind) throw new Error("请上传 PDF、DOC、DOCX、TXT、MD 或 JSON 文件。");

  const text = uploadKind === "pdf" || uploadKind === "word" ? await extractResumeText(file) : await file.text();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("文件内容为空。");

  if (uploadKind === "json") {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isResumeContentLike(parsed)) throw new Error("JSON 不是有效的录阶简历结构。");
    return { fileName: file.name, content: parsed, characterCount: trimmed.length };
  }

  return {
    fileName: file.name,
    content: resumeContentFromPlainText(file.name, trimmed),
    characterCount: trimmed.length,
  };
}

export function isResumeContentLike(value: unknown): value is ResumeContent {
  if (!value || typeof value !== "object") return false;
  const resume = value as Partial<ResumeContent>;
  return Boolean(
    resume.basics &&
      typeof resume.basics.name === "string" &&
      resume.profile &&
      typeof resume.profile.summary === "string" &&
      Array.isArray(resume.projects) &&
      Array.isArray(resume.skills),
  );
}

function resumeContentFromPlainText(fileName: string, text: string): ResumeContent {
  return {
    basics: {
      name: fileName.replace(/\.[^.]+$/, ""),
      email: "",
      phone: "",
      city: "",
      links: [],
    },
    profile: { title: "上传简历", summary: text.slice(0, 1200) },
    education: [],
    experiences: [],
    internships: [],
    projects: [],
    skills: [],
    awards: [],
    selfReview: text.slice(0, 12000),
  };
}

async function extractResumeText(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/files/resume-text", { method: "POST", body: formData });
  const result = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!response.ok) throw new Error(result?.error || "文件解析失败，请稍后重试。");
  return result?.text ?? "";
}
