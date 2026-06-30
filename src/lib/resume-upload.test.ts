import { describe, expect, it } from "vitest";

import { buildUploadedResumeDraft, getResumeUploadKind, RESUME_UPLOAD_ACCEPT } from "./resume-upload";

describe("resume upload formats", () => {
  it("routes supported resume files to the correct parser", () => {
    expect(getResumeUploadKind("resume.json")).toBe("json");
    expect(getResumeUploadKind("resume.txt")).toBe("text");
    expect(getResumeUploadKind("resume.md")).toBe("text");
    expect(getResumeUploadKind("resume.pdf")).toBe("pdf");
    expect(getResumeUploadKind("resume.doc")).toBe("word");
    expect(getResumeUploadKind("resume.docx")).toBe("word");
  });

  it("rejects formats without a reliable text parser", () => {
    expect(getResumeUploadKind("resume.png")).toBe(null);
    expect(getResumeUploadKind("resume.pages")).toBe(null);
  });

  it("keeps the browser accept list aligned with supported formats", () => {
    expect(RESUME_UPLOAD_ACCEPT).toContain(".pdf");
    expect(RESUME_UPLOAD_ACCEPT).toContain(".doc");
    expect(RESUME_UPLOAD_ACCEPT).toContain(".docx");
  });

  it("builds a usable resume snapshot from plain text", async () => {
    const draft = await buildUploadedResumeDraft(
      new File(["负责校园活动运营，使用 SQL 分析报名转化。"], "产品运营简历.txt", { type: "text/plain" }),
    );
    expect(draft.fileName).toBe("产品运营简历.txt");
    expect(draft.content.basics.name).toBe("产品运营简历");
    expect(draft.content.selfReview).toContain("SQL");
  });
});
