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

    expect(cards.map((card) => card.id)).toEqual(["version-new", "version-old"]);
    expect(cards[0].updatedAt).toBe("最近编辑于 2026/6/9");
  });

  it("falls back to creation time only when a legacy version has no updatedAt", () => {
    const cards = buildResumeLibraryCards({


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

    expect(cards.map((card) => card.id)).toEqual(["legacy-version"]);
    expect(cards[0].updatedAt).toBe("创建于 2026/6/2");
  });

  it("keeps empty named resumes addressable by their own ID", () => {
    const cards = buildResumeLibraryCards({ versions: [{ id: "own-id", name: "自定义名称", summary: "", content: baseContent, createdAt: "2026-06-01" }], search: "", sortMode: "recent" });
    expect(cards[0]).toMatchObject({ id: "own-id", title: "自定义名称", target: { kind: "version", id: "own-id" } });
    expect(buildResumeLibraryCards({ versions: [], search: "", sortMode: "recent" })).toEqual([]);
  });

  it("puts recently optimized versions first when sorting by recent optimization", () => {
    const cards = buildResumeLibraryCards({


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
        {
          id: "general-optimized-version",
          name: "AI优化-林泽宇",
          summary: "通用优化版本",
          content: { ...baseContent, _tailoringBaseResume: baseContent } as ResumeContent,
          createdAt: "2026-05-01T08:00:00.000Z",
          updatedAt: "2026-05-01T08:00:00.000Z",
        },
      ],
      search: "",
      sortMode: "recentOptimized",
    });

    expect(cards.map((card) => card.id)).toEqual([
      "optimized-version",
      "general-optimized-version",
      "plain-version",
    ]);
    expect(cards[0].title).toBe("JD匹配优化-百度 AIDU 大模型算法工程师");
    expect(cards[0].optimizationKind).toBe("job");
    expect(cards[1]).toMatchObject({
      kind: "优化后简历",
      optimizationKind: "general",
      title: "AI优化-林泽宇",
    });
  });

  it("keeps custom resume versions addressable in the editor route", () => {
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
      _optimizationStages: { draft: baseContent },
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
    expect(result.content).not.toHaveProperty("_optimizationStages");
    expect(result.content).not.toBe(optimized);
    expect(result.content.basics).not.toBe(optimized.basics);
  });
});
