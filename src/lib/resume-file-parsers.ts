import { Buffer } from "node:buffer";

async function openPdf(buffer: Buffer) {
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  return new PDFParse({ data: buffer, CanvasFactory });
}

export async function extractPdfText(buffer: Buffer, { requireTextOnEveryPage = false } = {}) {
  const parser = await openPdf(buffer);
  try {
    const { pages, text } = await parser.getText({ pageJoiner: "" });
    if (requireTextOnEveryPage && pages.some((page) => !page.text.trim())) return "";
    return normalizeExtractedText(text);
  } finally {
    await parser.destroy();
  }
}

export async function renderScannedResumePages(buffer: Buffer) {
  const parser = await openPdf(buffer);
  try {
    // ponytail: Bound in-memory rendering to eight pages; longer scans need a separate batch import.
    const { total, pages } = await parser.getInfo({ parsePageInfo: true, first: 8 });
    if (total > 8) throw new Error("扫描 PDF 导入最多支持 8 页，请拆分文件后重试。");
    const aspect = Math.max(1, ...pages.map(({ width, height }) => height / width));
    const desiredWidth = Math.floor(1600 / aspect);
    if (desiredWidth < 1) throw new Error("扫描 PDF 的页面尺寸不受支持。");
    const rendered = await parser.getScreenshot({ desiredWidth, imageDataUrl: false });
    const images = rendered.pages.map((page) => page.data);
    if (images.reduce((size, image) => size + image.byteLength, 0) > 32 * 1024 * 1024) {
      throw new Error("扫描 PDF 转为图片后过大，请压缩或拆分文件后重试。");
    }
    return images;
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
