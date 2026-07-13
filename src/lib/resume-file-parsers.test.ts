import { Document, Packer, Paragraph } from "docx";
import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";

import {
  extractPdfText,
  extractWordText,
  normalizeExtractedText,
  renderPdfPagesForVision,
} from "./resume-file-parsers";

describe("resume file parsers", () => {
  it("extracts text from a text-based PDF", async () => {
    const pdf = new jsPDF();
    pdf.text("Resume parser test 123", 20, 20);
    const text = await extractPdfText(Buffer.from(pdf.output("arraybuffer")));

    expect(text).toContain("Resume parser test 123");
  });

  it("extracts text from a DOCX file", async () => {
    const document = new Document({
      sections: [{ children: [new Paragraph("Resume parser test 456")] }],
    });
    const text = await extractWordText(await Packer.toBuffer(document));

    expect(text).toContain("Resume parser test 456");
  });

  it("renders PDF pages as PNG images for Codex vision", async () => {
    const pdf = new jsPDF();
    pdf.text("Page one", 20, 20);
    pdf.addPage();
    pdf.text("Page two", 20, 20);

    const pages = await renderPdfPagesForVision(Buffer.from(pdf.output("arraybuffer")));

    expect(pages).toHaveLength(2);
    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(pages.every((page) => page.mimeType === "image/png" && page.data.length > 0)).toBe(true);
  });

  it("rejects scanned PDFs above the configured page limit", async () => {
    const pdf = new jsPDF();
    for (let page = 2; page <= 11; page += 1) pdf.addPage();

    await expect(
      renderPdfPagesForVision(Buffer.from(pdf.output("arraybuffer"))),
    ).rejects.toThrow("最多支持 10 页，当前文件共 11 页");
  });

  it("normalizes parser whitespace and null characters", () => {
    expect(normalizeExtractedText("第一行\u0000  \r\n\r\n\r\n第二行")).toBe("第一行\n\n第二行");
  });
});
