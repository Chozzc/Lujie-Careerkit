import { Buffer } from "node:buffer";

import { parseResumeTextWithAi, parseResumeWithQwenDoc } from "@/lib/ai/resume-import";
import { getEffectiveAiRuntimeSettings } from "@/lib/repository";
import { extractPdfText, extractWordText } from "@/lib/resume-file-parsers";
import { normalizeResumeContent, resumeContentFromText, isResumeContentLike } from "@/lib/resume-content";
import { getResumeUploadKind } from "@/lib/resume-upload";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const preferLocalFallback = formData.get("preferLocalFallback") === "true";
    if (!(file instanceof File)) {
      return Response.json({ error: "请选择要导入的简历文件。" }, { status: 400 });
    }
    if (file.size === 0) {
      return Response.json({ error: "文件内容为空。" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "文件不能超过 10 MB。" }, { status: 413 });
    }

    const kind = getResumeUploadKind(file.name);
    if (!kind) {
      return Response.json({ error: "请上传 PDF、DOC、DOCX、图片、TXT、MD 或 JSON 文件。" }, { status: 415 });
    }

    let plainText = "";
    if (kind === "json" || kind === "text") {
      plainText = (await file.text()).trim();
      if (!plainText) {
        return Response.json({ error: "文件内容为空。" }, { status: 400 });
      }
    }

    if (kind === "json") {
      try {
        const parsed = JSON.parse(plainText) as unknown;
        if (isResumeContentLike(parsed)) {
          return ok(file.name, normalizeResumeContent(parsed, file.name.replace(/\.[^.]+$/, "")), "local-json");
        }
      } catch {
        // 非标准 JSON 继续交给 AI 尝试整理。
      }
    }

    const settings = await getEffectiveAiRuntimeSettings();

    if (preferLocalFallback) {
      const local = await localFallback(file, kind, plainText, "已使用本地规则解析，字段归类效果可能不佳。");
      if (local) return local;
      return Response.json({ error: "图片简历需要先配置阿里百炼 / Qwen 后才能解析。" }, { status: 422 });
    }

    if (settings.providerId !== "qwen" && kind !== "image") {
      const text = await extractLocalText(file, kind, plainText);
      if (!text) {
        return Response.json({ error: "未能从该 PDF 或 Word 文件提取到文本；扫描件需要配置阿里百炼 / Qwen 后才能解析。" }, { status: 422 });
      }
      const result = await parseResumeTextWithAi({ fileName: file.name, text, settings });
      return ok(
        file.name,
        result.data,
        result.source === "ai" ? "ai-text" : "local-fallback",
        result.message,
      );
    }

    let aiError: unknown = null;
    try {
      return ok(file.name, await parseResumeWithQwenDoc({ file, settings }), "qwen-doc-turbo");
    } catch (error) {
      aiError = error;
    }

    const local = await localFallback(file, kind, plainText, `AI 解析失败，已使用本地文本兜底。${formatError(aiError)}`);
    if (local) return local;

    return Response.json({ error: `AI 简历解析失败。${formatError(aiError) || "请确认已在设置中启用阿里百炼 / Qwen。"}` }, { status: 502 });
  } catch (error) {
    return Response.json({ error: formatError(error) || "简历导入失败，请稍后重试。" }, { status: 500 });
  }
}

function ok(fileName: string, content: ReturnType<typeof normalizeResumeContent>, source: string, message?: string) {
  const characterCount = JSON.stringify(content).length;
  return Response.json({
    fileName,
    content,
    characterCount,
    source,
    message,
  });
}

async function localFallback(file: File, kind: NonNullable<ReturnType<typeof getResumeUploadKind>>, plainText: string, message: string) {
  const text = await extractLocalText(file, kind, plainText);
  if (!text) return null;
  return ok(file.name, resumeContentFromText(file.name, text), "local-fallback", message);
}

async function extractLocalText(
  file: File,
  kind: NonNullable<ReturnType<typeof getResumeUploadKind>>,
  plainText: string,
) {
  if (kind === "text" || kind === "json") return plainText;
  if (kind !== "pdf" && kind !== "word") return "";

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = kind === "pdf" ? await extractPdfText(buffer) : await extractWordText(buffer);
  return text.replace(/\s/g, "").length >= 10 ? text : "";
}

function formatError(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message.trim() : "";
}
