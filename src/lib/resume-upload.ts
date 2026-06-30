import { isResumeContentLike, normalizeResumeContent } from "./resume-content";
import type { ResumeContent } from "./types";

export type ResumeUploadKind = "json" | "text" | "pdf" | "word" | "image";

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
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  "application/json",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
].join(",");

export function getResumeUploadKind(fileName: string): ResumeUploadKind | null {
  const extension = fileName.trim().toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (extension === "json") return "json";
  if (extension === "txt" || extension === "md") return "text";
  if (extension === "pdf") return "pdf";
  if (extension === "doc" || extension === "docx") return "word";
  if (extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp") return "image";
  return null;
}

export async function buildUploadedResumeDraft(file: File): Promise<UploadedResumeDraft> {
  const uploadKind = getResumeUploadKind(file.name);
  if (!uploadKind) throw new Error("请上传 PDF、DOC、DOCX、图片、TXT、MD 或 JSON 文件。");

  if (uploadKind === "json") {
    const trimmed = (await file.text()).trim();
    if (!trimmed) throw new Error("文件内容为空。");
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!isResumeContentLike(parsed)) return importResumeWithAI(file);
      return {
        fileName: file.name,
        content: normalizeResumeContent(parsed, file.name.replace(/\.[^.]+$/, "")),
        characterCount: trimmed.length,
      };
    } catch {
      return importResumeWithAI(file);
    }
  }

  return importResumeWithAI(file);
}

async function importResumeWithAI(file: File): Promise<UploadedResumeDraft> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/ai/resume-import", { method: "POST", body: formData });
  const result = (await response.json().catch(() => null)) as (UploadedResumeDraft & { error?: string }) | null;
  if (!response.ok) throw new Error(result?.error || "简历导入失败，请稍后重试。");
  if (!result?.content) throw new Error("简历导入失败，未返回有效结构。");
  return {
    fileName: result.fileName,
    content: result.content,
    characterCount: result.characterCount,
  };
}

export { isResumeContentLike };
