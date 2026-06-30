import { Buffer } from "node:buffer";

import { extractPdfText, extractWordText } from "@/lib/resume-file-parsers";
import { getResumeUploadKind } from "@/lib/resume-upload";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "请选择要解析的简历文件。" }, { status: 400 });
    }
    if (file.size === 0) {
      return Response.json({ error: "文件内容为空。" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "文件不能超过 10 MB。" }, { status: 413 });
    }

    const kind = getResumeUploadKind(file.name);
    if (kind !== "pdf" && kind !== "word") {
      return Response.json({ error: "该接口仅解析 PDF、DOC 和 DOCX 文件。" }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = kind === "pdf" ? await extractPdfText(buffer) : await extractWordText(buffer);

    if (text.replace(/\s/g, "").length < 10) {
      return Response.json(
        {
          error:
            kind === "pdf"
              ? "没有读取到可复制文字。这可能是扫描版 PDF，请先进行 OCR 或导出为文本型 PDF。"
              : "没有读取到有效文字，请确认文件未损坏且不是图片形式的 Word 文档。",
        },
        { status: 422 },
      );
    }

    return Response.json({ text });
  } catch (error) {
    console.error("Failed to extract resume text:", error);
    return Response.json(
      { error: "文件解析失败，请确认文件未加密、未损坏后重试。" },
      { status: 500 },
    );
  }
}
