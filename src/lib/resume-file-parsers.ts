import { Buffer } from "node:buffer";

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
