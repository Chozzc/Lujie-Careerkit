import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_RESUME_THEME } from "@/lib/resume-theme";
import type { Resume } from "@/types/resume";

import { ResumePreview } from "./resume-preview";

const resume: Resume = {
  id: "resume",
  userId: "user",
  title: "Test resume",
  template: "classic",
  themeConfig: DEFAULT_RESUME_THEME,
  isDefault: true,
  language: "zh-CN",
  sections: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe("ResumePreview", () => {
  it.each(["standalone", "paged", "export"] as const)("keeps %s rendering independent of remote font resources", (mode) => {
    const markup = renderToStaticMarkup(<ResumePreview resume={resume} mode={mode} />);

    expect(markup).not.toContain("<link");
    expect(markup).not.toContain("@font-face");
    expect(markup).toContain(`data-resume-render-mode="${mode}"`);
  });
});
