import { describe, expect, it } from "vitest";

import type { ResumeContent } from "./types";
import {
  buildAutomaticResumeTitle,
  resolveResumeContentTitle,
  shouldAutoRenameResumeTitle,
} from "./resume-naming";

function createResume(name: string, displayName?: string): ResumeContent {
  return {
    editor: displayName ? { displayName } : undefined,
    basics: { name, email: "", phone: "", city: "", links: [] },
    profile: { title: "", summary: "" },
    education: [],
    experiences: [],
    internships: [],
    projects: [],
    skills: [],
    awards: [],
    selfReview: "",
  };
}

describe("resume naming", () => {
  it("builds the default resume title from the person's name", () => {
    expect(buildAutomaticResumeTitle(" 林泽宇 ")).toBe("林泽宇的简历");
    expect(buildAutomaticResumeTitle("")).toBe("未命名简历");
  });

  it("replaces an untitled display name with the person's name", () => {
    expect(resolveResumeContentTitle(createResume("林泽宇", "未命名简历"))).toBe("林泽宇的简历");
  });

  it("continues automatic naming when the person's name changes", () => {
    expect(shouldAutoRenameResumeTitle("张三的简历", "张三")).toBe(true);
  });

  it("does not overwrite a title the user renamed manually", () => {
    expect(shouldAutoRenameResumeTitle("校招技术版", "张三")).toBe(false);
  });
});
