import { Buffer } from "node:buffer";

import { parseResumeImagesWithAi, parseResumeTextWithAi, parseResumeWithQwenDoc } from "@/lib/ai/resume-import";
import { getEffectiveAiRuntimeSettings } from "@/lib/repository";
import { extractPdfText, extractWordText, renderScannedResumePages } from "@/lib/resume-file-parsers";
import { normalizeResumeContent, resumeContentFromText, isResumeContentLike } from "@/lib/resume-content";
import { getResumeUploadKind } from "@/lib/resume-upload";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VISION_SETUP_MESSAGE = "图片或扫描 PDF 需要能识别图片的模型。请在设置中选择视觉模型，或上传带文本层的文件。";

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
      return Response.json({ error: VISION_SETUP_MESSAGE }, { status: 422 });
    }

    const text = await extractLocalText(file, kind, plainText, settings.enabled).catch((error) => {
      if (settings.providerId !== "qwen") throw error;
      return "";
    });
    if (text) {
      const result = await parseResumeTextWithAi({ fileName: file.name, text, settings });
      return ok(
        file.name,
        result.data,
        result.source === "ai" ? "ai-text" : "local-fallback",
        result.message,
      );
    }

    if (!settings.enabled) return Response.json({ error: VISION_SETUP_MESSAGE }, { status: 422 });
    const mayUseQwenDocument = settings.providerId === "qwen";
    if (kind === "image" || kind === "pdf") {
      const model = settings.model.split("/").at(-1) ?? settings.model;
      if (/^(?:deepseek-v4-pro|gpt-oss[-:](?:20b|120b))$/i.test(model)) {
        return Response.json({
          error: `当前模型（${settings.model}）不支持图片输入。请切换到支持图片的模型，例如 DeepSeek Flash，或上传 Word、带文本层的 PDF。`,
        }, { status: 422 });
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const images = kind === "pdf" ? await renderScannedResumePages(buffer) : [buffer];
        try {
          const content = await parseResumeImagesWithAi({ fileName: file.name, images, settings });
          return ok(file.name, content, "ai-vision");
        } catch {
          if (!mayUseQwenDocument) {
            return Response.json({
              error: "当前模型未能可靠读取图片。请检查模型是否支持图片输入，或换用清晰的文件重试。",
            }, { status: 502 });
          }
        }
      } catch (error) {
        if (!mayUseQwenDocument) {
          return Response.json({ error: formatError(error) || "无法读取扫描 PDF。" }, { status: 422 });
        }
      }
    }
    if (!mayUseQwenDocument) {
      return Response.json({ error: "未能从文件提取到简历文本。" }, { status: 422 });
    }
    try {
      return ok(file.name, await parseResumeWithQwenDoc({ file, settings }), "qwen-doc-turbo");
    } catch {
      return Response.json({ error: "百炼文档解析失败，请检查模型连接或文件内容。" }, { status: 502 });
    }
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
  requireTextOnEveryPage = false,
) {
  if (kind === "text" || kind === "json") return plainText;
  if (kind !== "pdf" && kind !== "word") return "";

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = kind === "pdf" ? await extractPdfText(buffer, { requireTextOnEveryPage }) : await extractWordText(buffer);
  return text.replace(/\s/g, "").length >= 10 ? text : "";
}

function formatError(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message.trim() : "";
}
