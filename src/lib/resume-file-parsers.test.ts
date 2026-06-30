import { Document, Packer, Paragraph } from "docx";
import { jsPDF } from "jspdf";
import { describe, expect, it } from "vitest";

import { extractPdfText, extractWordText, normalizeExtractedText } from "./resume-file-parsers";

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

  it("normalizes parser whitespace and null characters", () => {
    expect(normalizeExtractedText("第一行\u0000  \r\n\r\n\r\n第二行")).toBe("第一行\n\n第二行");
  });
});
