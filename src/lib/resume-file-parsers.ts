import { Buffer } from "node:buffer";

export const MAX_SCANNED_PDF_PAGES = 10;
const PDF_VISION_PAGE_WIDTH = 1_400;

export class PdfPageLimitError extends Error {
  constructor(public readonly total: number, public readonly maxPages: number) {
    super(`扫描 PDF 最多支持 ${maxPages} 页，当前文件共 ${total} 页。`);
    this.name = "PdfPageLimitError";
  }
}

export async function extractPdfText(buffer: Buffer) {
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    return normalizeExtractedText((await parser.getText()).text);
  } finally {
    await parser.destroy();
  }
}

export async function renderPdfPagesForVision(
  buffer: Buffer,
  maxPages = MAX_SCANNED_PDF_PAGES,
) {
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  try {
    const info = await parser.getInfo();
    if (info.total > maxPages) {
      throw new PdfPageLimitError(info.total, maxPages);
    }
    const screenshots = await parser.getScreenshot({
      desiredWidth: PDF_VISION_PAGE_WIDTH,
      imageBuffer: true,
      imageDataUrl: false,
    });
    return screenshots.pages.map((page) => ({
      data: Buffer.from(page.data),
      mimeType: "image/png" as const,
      pageNumber: page.pageNumber,
    }));
  } finally {
    await parser.destroy();
  }
}

export async function extractWordText(buffer: Buffer) {
  const WordExtractor = (await import("word-extractor")).default;
  const document = await new WordExtractor().extract(buffer);
  const chunks = [
    document.getBody(),
    document.getHeaders({ includeFooters: false }),
    document.getFooters(),
    document.getFootnotes(),
    document.getEndnotes(),
    document.getTextboxes({ includeHeadersAndFooters: true, includeBody: true }),
  ];
  return normalizeExtractedText(
    [...new Set(chunks.map((chunk) => chunk.trim()).filter(Boolean))].join("\n\n"),
  );
}

export function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
