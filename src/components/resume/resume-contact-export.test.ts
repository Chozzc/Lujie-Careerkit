import { afterEach, expect, it, vi } from "vitest";
import { contentToJadeResume } from "@/lib/resume-adapter";
import { extractWordText } from "@/lib/resume-file-parsers";
import { sampleResumeVersions } from "@/lib/sample-data";
import { exportResumeAsEditableDocx } from "./resume-workbench";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps hidden contact details out of DOCX content and filename", async () => {
  const draft = contentToJadeResume(sampleResumeVersions[0].content);
  const personal = draft.sections.find((section) => section.type === "personal_info")!;
  const email = "private-contact@example.invalid";
  const phone = "555-010-2424";
  Object.assign(personal.content, { fullName: "", email, phone });
  draft.title = `Résumé: ${email}`;
  const link = { click: vi.fn(), remove: vi.fn(), href: "", download: "" };
  vi.stubGlobal("document", { createElement: () => link, body: { appendChild: vi.fn() } });
  vi.stubGlobal("window", { setTimeout: vi.fn() });
  const download = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  for (const visible of [false, true]) {
    personal.visible = visible;
    await exportResumeAsEditableDocx(draft);
    const blob = download.mock.lastCall![0] as Blob;
    const text = await extractWordText(Buffer.from(await blob.arrayBuffer()));
    expect(text.includes(email)).toBe(visible);
    expect(text.includes(phone)).toBe(visible);
    expect(link.download.includes(email)).toBe(visible);
    expect(text.includes(draft.title)).toBe(visible);
    expect(link.download).not.toContain(":");
  }
});
