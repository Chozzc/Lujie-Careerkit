import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTOSAVE_DELAY } from "@/lib/constants";
import type { PersonalInfoContent, Resume } from "@/types/resume";
import { useResumeStore } from "./resume-store";
import { installSaveCloseGuard } from "@/lib/save-close-guard";

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
    vi.unstubAllGlobals();
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

  it("serializes writes and waits until edits made during a save are persisted", async () => {
    const first = Promise.withResolvers<void>();
    const written: string[] = [];
    const persist = vi.fn(async (resume: Resume) => {
      if (!written.length) await first.promise;
      written.push(resume.title);
    });
    const store = useResumeStore.getState();
    store.setPersistence(persist);
    store.setResume(createResume());
    store.setTitle("first");
    const autosave = store.save("auto");
    await Promise.resolve();
    store.setTitle("latest");
    const closing = store.save("auto");
    await Promise.resolve();
    expect(persist).toHaveBeenCalledTimes(1);
    first.resolve();
    expect(await autosave).toBe(true);
    expect(await closing).toBe(true);
    expect(written).toEqual(["first", "latest"]);
    expect(useResumeStore.getState().isDirty).toBe(false);
    await runAutosaveTimer();
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("does not overwrite a newly opened editor when an old save finishes", async () => {
    const pending = Promise.withResolvers<void>();
    const store = useResumeStore.getState();
    store.setPersistence(() => pending.promise);
    store.setResume(createResume());
    store.setTitle("old edit");
    const saving = store.save();
    await Promise.resolve();
    store.setResume({ ...createResume(), id: "resume-2", title: "other resume" });
    store.setTitle("other edit");
    pending.resolve();
    expect(await saving).toBe(false);
    expect(useResumeStore.getState().currentResume?.title).toBe("other edit");
    expect(useResumeStore.getState().isDirty).toBe(true);
  });

  it("never reports a missing database writer as saved and permits a later retry", async () => {
    const store = useResumeStore.getState();
    store.setResume(createResume());
    store.setTitle("must reach the database");
    expect(await store.save()).toBe(false);
    expect(useResumeStore.getState().isDirty).toBe(true);
    const persist = vi.fn(async () => undefined);
    store.setPersistence(persist);
    expect(await store.save()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  function mockBrowser() {
    const listeners = new Map<string, (event: BeforeUnloadEvent) => void>();
    vi.stubGlobal("window", {
      addEventListener: (name: string, handler: (event: BeforeUnloadEvent) => void) => listeners.set(name, handler),
      removeEventListener: (name: string) => listeners.delete(name),
    });
    const cleanup = installSaveCloseGuard();
    return { listeners, cleanup };
  }

  it("warns about unsaved browser edits and removes listeners on cleanup", async () => {
    const browser = mockBrowser();
    const event = { preventDefault: vi.fn(), returnValue: undefined };
    useResumeStore.getState().setResume(createResume());
    useResumeStore.getState().setTitle("unsaved");
    browser.listeners.get("beforeunload")!(event as unknown as BeforeUnloadEvent);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    browser.cleanup();
    expect(browser.listeners.size).toBe(0);
  });
});
