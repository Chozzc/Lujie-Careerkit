import { describe, expect, it } from "vitest";

import type { ResumeContent } from "./types";
import { buildResumeCopy, buildResumeEditorPath, buildResumeLibraryCards } from "./resume-library";

const baseContent: ResumeContent = {
  basics: { name: "林泽宇", email: "", phone: "", city: "", links: [] },
  profile: { title: "后端开发实习生", summary: "" },
  education: [],
  experiences: [],
  internships: [],
  projects: [],
  skills: [],
  awards: [],
  selfReview: "",
};

describe("resume library cards", () => {
  it("sorts by actual updated time when the UI says recent edits", () => {
    const cards = buildResumeLibraryCards({
      resume: baseContent,
      mainResumeUpdatedAt: "2026-06-08T08:00:00.000Z",
      versions: [
        {
          id: "version-old",
          name: "旧版本",
          summary: "创建早，编辑也早",
          content: baseContent,
          createdAt: "2026-06-01T08:00:00.000Z",
          updatedAt: "2026-06-01T09:00:00.000Z",
        },
        {
          id: "version-new",
          name: "最近编辑版本",
          summary: "应该排在第一",
          content: baseContent,
          createdAt: "2026-06-01T08:00:00.000Z",
          updatedAt: "2026-06-09T09:00:00.000Z",
        },
      ],
      search: "",
      sortMode: "recent",
    });

    expect(cards.map((card) => card.id)).toEqual(["version-new", "main", "version-old"]);
    expect(cards[0].updatedAt).toBe("最近编辑于 2026/6/9");
    expect(cards.find((card) => card.id === "main")?.detail).toBe("后端开发实习生 · 主简历");
    expect(cards.find((card) => card.id === "main")?.detail).not.toContain("健康分");
  });

  it("falls back to creation time only when a legacy version has no updatedAt", () => {
    const cards = buildResumeLibraryCards({
      resume: baseContent,
      mainResumeUpdatedAt: "2026-06-08T08:00:00.000Z",
      versions: [
        {
          id: "legacy-version",
          name: "旧数据版本",
          summary: "没有 updatedAt",
          content: baseContent,
          createdAt: "2026-06-02T08:00:00.000Z",
        },
      ],
      search: "",
      sortMode: "recent",
    });

    expect(cards.map((card) => card.id)).toEqual(["main", "legacy-version"]);
    expect(cards[1].updatedAt).toBe("创建于 2026/6/2");
  });

  it("uses the resume display name and hides an empty main resume", () => {
    const namedContent: ResumeContent = {
      ...baseContent,
      editor: {
        displayName: "王梓涵的简历",
      },
    };
    const emptyContent: ResumeContent = {
      basics: { name: "", email: "", phone: "", city: "", links: [] },
      profile: { title: "", summary: "" },
      education: [],
      experiences: [],
      internships: [],
      projects: [],
      skills: [],
      awards: [],
      selfReview: "",
    };

    expect(
      buildResumeLibraryCards({
        resume: namedContent,
        mainResumeUpdatedAt: "2026-06-08T08:00:00.000Z",
        versions: [],
        search: "",
        sortMode: "recent",
      })[0].title,
    ).toBe("王梓涵的简历");

    expect(
      buildResumeLibraryCards({
        resume: emptyContent,
        mainResumeUpdatedAt: "2026-06-08T08:00:00.000Z",
        versions: [],
        search: "",
        sortMode: "recent",
      }),
    ).toEqual([]);
  });

  it("puts recently optimized versions first when sorting by recent optimization", () => {
    const cards = buildResumeLibraryCards({
      resume: baseContent,
      mainResumeUpdatedAt: "2026-06-10T08:00:00.000Z",
      versions: [
        {
          id: "plain-version",
          name: "普通备份版本",
          summary: "用户手动保存的普通版本",
          content: baseContent,
          createdAt: "2026-06-12T08:00:00.000Z",
          updatedAt: "2026-06-12T08:00:00.000Z",
        },
        {
          id: "optimized-version",
          jobId: "job-baidu",
          name: "百度 AIDU 大模型算法工程师 定制版",
          summary: "JD匹配优化版本",
          content: baseContent,
          createdAt: "2026-06-01T08:00:00.000Z",
          updatedAt: "2026-06-01T08:00:00.000Z",
        },
      ],
      search: "",
      sortMode: "recentOptimized",
    });

    expect(cards.map((card) => card.id)).toEqual(["optimized-version", "plain-version", "main"]);
    expect(cards[0].title).toBe("JD匹配优化-百度 AIDU 大模型算法工程师");
  });

  it("keeps custom resume versions addressable in the editor route", () => {
    expect(buildResumeEditorPath({ kind: "main" })).toBe("/resume/edit");
    expect(buildResumeEditorPath({ kind: "version", id: "rv-alibaba-data" })).toBe(
      "/resume/edit?version=rv-alibaba-data",
    );
    expect(buildResumeEditorPath({ kind: "version", id: "rv with spaces" })).toBe(
      "/resume/edit?version=rv%20with%20spaces",
    );
  });

  it("creates an independent, uniquely named copy without optimization metadata", () => {
    const optimized = {
      ...baseContent,
      editor: { displayName: "林泽宇的简历" },
      _tailoringBaseResume: baseContent,
      _optimizationMeta: { title: "后端开发实习生" },
    } as ResumeContent;

    const result = buildResumeCopy(
      optimized,
      "林泽宇的简历 - 副本",
      ["林泽宇的简历", "林泽宇的简历 - 副本"],
      "副本",
    );

    expect(result.title).toBe("林泽宇的简历 - 副本 2");
    expect(result.content.editor?.displayName).toBe(result.title);
    expect(result.content).not.toHaveProperty("_tailoringBaseResume");
    expect(result.content).not.toHaveProperty("_optimizationMeta");
    expect(result.content).not.toBe(optimized);
    expect(result.content.basics).not.toBe(optimized.basics);
  });
});
