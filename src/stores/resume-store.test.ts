import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOSAVE_DELAY } from "@/lib/constants";
import type { PersonalInfoContent, Resume } from "@/types/resume";
import { useResumeStore } from "./resume-store";

const now = new Date("2026-06-09T10:00:00.000Z");

function createResume(): Resume {
  return {
    id: "resume-1",
    userId: "local",
    title: "测试简历",
    template: "modern",
    themeConfig: {
      primaryColor: "#111827",
      accentColor: "#315f92",
      fontFamily: "Inter",
      fontSize: "medium",
      lineSpacing: 1.5,
      margin: { top: 20, right: 24, bottom: 20, left: 24 },
      sectionSpacing: 16,
      avatarStyle: "oneInch",
    },
    isDefault: true,
    language: "zh-CN",
    createdAt: now,
    updatedAt: now,
    sections: [
      {
        id: "personal",
        resumeId: "resume-1",
        type: "personal_info",
        title: "个人信息",
        sortOrder: 0,
        visible: true,
        createdAt: now,
        updatedAt: now,
        content: {
          fullName: "林泽宇",
          jobTitle: "后端开发实习生",
          email: "linzeyu@example.com",
          phone: "13900000000",
          location: "杭州",
        },
      },
    ],
  };
}

async function runAutosaveTimer() {
  await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY);
  await Promise.resolve();
}

describe("resume editor store persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useResumeStore.getState().reset();
  });

  afterEach(() => {
    useResumeStore.getState().reset();
    vi.useRealTimers();
  });

  it("debounces autosave through the registered persistence handler", async () => {
    const persisted: Resume[] = [];
    const store = useResumeStore.getState() as unknown as {
      setPersistence: (handler: (resume: Resume) => Promise<void>) => void;
    };

    store.setPersistence(async (resume) => {
      persisted.push(resume);
    });

    useResumeStore.getState().setResume(createResume());
    useResumeStore.getState().updateSection("personal", { fullName: "林泽宇-已修改" });

    expect(useResumeStore.getState().isDirty).toBe(true);
    expect(persisted).toHaveLength(0);

    await runAutosaveTimer();

    expect(persisted).toHaveLength(1);
    expect((persisted[0].sections[0].content as PersonalInfoContent).fullName).toBe("林泽宇-已修改");
    expect(useResumeStore.getState().isDirty).toBe(false);
  });

  it("keeps the editor dirty when autosave fails", async () => {
    const store = useResumeStore.getState() as unknown as {
      setPersistence: (handler: () => Promise<void>) => void;
    };

    store.setPersistence(async () => {
      throw new Error("SQLite 写入失败");
    });

    useResumeStore.getState().setResume(createResume());
    useResumeStore.getState().updateSection("personal", { fullName: "保存失败的修改" });

    await runAutosaveTimer();

    const state = useResumeStore.getState() as unknown as { isDirty: boolean; saveError: string | null };
    expect(state.isDirty).toBe(true);
    expect(state.saveError).toBe("SQLite 写入失败");
  });
});
