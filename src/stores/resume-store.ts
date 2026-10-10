import { create } from 'zustand';
import type { Resume, ResumeSection, SectionContent, ThemeConfig } from '@/types/resume';
import { AUTOSAVE_DELAY } from '@/lib/constants';
import { generateId } from '@/lib/utils';

type SaveSource = 'auto' | 'manual';
type ResumePersistence = (resume: Resume, context: { source: SaveSource }) => Promise<void>;

interface ResumeStore {
  currentResume: Resume | null;
  sections: ResumeSection[];
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  dirtyVersion: number;
  lastSavedVersion: number;
  _resumeGeneration: number;
  _savePromise: Promise<boolean> | null;
  _saveTimeout: ReturnType<typeof setTimeout> | null;
  _persistResume: ResumePersistence | null;

  setPersistence: (handler: ResumePersistence | null) => void;
  setResume: (resume: Resume) => void;
  updateSection: (sectionId: string, content: Partial<SectionContent>) => void;
  updateSectionTitle: (sectionId: string, title: string) => void;
  addSection: (section: ResumeSection) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (sections: ResumeSection[]) => void;
  toggleSectionVisibility: (sectionId: string) => void;
  setTemplate: (template: string) => void;
  updateThemeConfig: (themeConfig: Partial<ThemeConfig>) => void;
  setTitle: (title: string) => void;
  save: (source?: SaveSource, options?: { force?: boolean }) => Promise<boolean>;
  _scheduleSave: () => void;
  reset: () => void;
}

export const useResumeStore = create<ResumeStore>((set, get) => ({
  currentResume: null,
  sections: [],
  isDirty: false,
  isSaving: false,
  saveError: null,
  dirtyVersion: 0,
  lastSavedVersion: 0,
  _resumeGeneration: 0,
  _savePromise: null,
  _saveTimeout: null,
  _persistResume: null,

  setPersistence: (handler) => {
    set({ _persistResume: handler });
  },

  setResume: (resume) => {
    // Cancel any pending autosave to prevent stale data overwriting server changes (e.g., from AI tool calls)
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);

    // Normalize: ensure all items/categories in section content have id fields
    const sections = (resume.sections || []).map((s) => {
      const content = s.content as unknown as Record<string, unknown>;
      if (Array.isArray(content?.items)) {
        content.items = (content.items as unknown[]).map((item) =>
          typeof item === 'object' && item !== null && !('id' in item && item.id)
            ? { ...item, id: generateId() }
            : item
        );
      }
      if (Array.isArray(content?.categories)) {
        content.categories = (content.categories as unknown[]).map((cat) =>
          typeof cat === 'object' && cat !== null && !('id' in cat && cat.id)
            ? { ...cat, id: generateId() }
            : cat
        );
      }
      return { ...s, content: content as unknown as typeof s.content };
    });

    set({
      currentResume: { ...resume, sections },
      sections,
      isDirty: false,
      saveError: null,
      dirtyVersion: 0,
      lastSavedVersion: 0,
      _resumeGeneration: get()._resumeGeneration + 1,
      _saveTimeout: null,
    });
  },

  updateSection: (sectionId, content) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, content: { ...s.content, ...content } as SectionContent } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
        dirtyVersion: state.dirtyVersion + 1,
      };
    });
    get()._scheduleSave();
  },

  updateSectionTitle: (sectionId, title) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
        dirtyVersion: state.dirtyVersion + 1,
      };
    });
    get()._scheduleSave();
  },

  addSection: (section) => {
    set((state) => {
      const sections = [...state.sections, section];
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
        dirtyVersion: state.dirtyVersion + 1,
      };
    });
    get()._scheduleSave();
  },

  removeSection: (sectionId) => {
    set((state) => {
      const sections = state.sections.filter((s) => s.id !== sectionId);
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
        dirtyVersion: state.dirtyVersion + 1,
      };
    });
    get()._scheduleSave();
  },

  reorderSections: (sections) => {
    set((state) => ({
      sections,
      currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
      isDirty: true,
      dirtyVersion: state.dirtyVersion + 1,
    }));
    get()._scheduleSave();
  },

  toggleSectionVisibility: (sectionId) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s
      );
      return {
        sections,
        currentResume: state.currentResume ? { ...state.currentResume, sections } : null,
        isDirty: true,
        dirtyVersion: state.dirtyVersion + 1,
      };
    });
    get()._scheduleSave();
  },

  setTemplate: (template) => {
    set((state) => ({
      currentResume: state.currentResume
        ? { ...state.currentResume, template }
        : null,
      isDirty: true,
      dirtyVersion: state.dirtyVersion + 1,
    }));
    get()._scheduleSave();
  },

  updateThemeConfig: (themeConfig) => {
    set((state) => ({
      currentResume: state.currentResume
        ? {
            ...state.currentResume,
            themeConfig: {
              ...state.currentResume.themeConfig,
              ...themeConfig,
            },
          }
        : null,
      isDirty: true,
      dirtyVersion: state.dirtyVersion + 1,
    }));
    get()._scheduleSave();
  },

  setTitle: (title) => {
    set((state) => ({
      currentResume: state.currentResume
        ? { ...state.currentResume, title }
        : null,
      isDirty: true,
      dirtyVersion: state.dirtyVersion + 1,
    }));
    get()._scheduleSave();
  },

  save: async (source = 'manual', options) => {
    const generation = get()._resumeGeneration;
    const pending = get()._savePromise;
    if (pending) {
      const saved = await pending;
      if (get()._resumeGeneration !== generation) return false;
      if (!saved) return false;
      return get().isDirty ? get().save(source) : true;
    }
    const { currentResume, sections, isDirty, dirtyVersion, _persistResume } = get();
    if (!currentResume || (!isDirty && !options?.force)) return true;
    const timeout = get()._saveTimeout;
    if (timeout) clearTimeout(timeout);

    const savedAt = new Date();
    const snapshot: Resume = {
      ...currentResume,
      sections: sections.map((s, i) => ({ ...s, sortOrder: i, updatedAt: savedAt })),
      updatedAt: savedAt,
    };

    // Publish the promise before invoking the writer, so every caller joins the same queue.
    const pendingSave = Promise.resolve().then(async () => {
      try {
        if (!_persistResume) throw new Error('简历保存通道不可用，请返回编辑器后重试。');
        await _persistResume(snapshot, { source });
        if (get()._resumeGeneration !== generation) return false;
        set((state) => {
          const hasNewerChanges = state.dirtyVersion !== dirtyVersion;
          return {
            currentResume: hasNewerChanges ? state.currentResume : snapshot,
            sections: hasNewerChanges ? state.sections : snapshot.sections,
            isDirty: hasNewerChanges,
            lastSavedVersion: dirtyVersion,
            saveError: null,
          };
        });
        return true;
      } catch (error) {
        console.error('Failed to save resume:', error);
        if (get()._resumeGeneration === generation) {
          set({ isDirty: true, saveError: error instanceof Error ? error.message : '保存失败' });
        }
        return false;
      } finally {
        set({ isSaving: false, _savePromise: null });
      }
    });
    set({ isSaving: true, saveError: null, _savePromise: pendingSave, _saveTimeout: null });
    const saved = await pendingSave;
    if (!saved || get()._resumeGeneration !== generation) return false;
    return get().isDirty ? get().save(source) : true;
  },

  _scheduleSave: () => {
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);

    const timeout = setTimeout(() => {
      set({ _saveTimeout: null });
      get().save('auto');
    }, AUTOSAVE_DELAY);

    set({ _saveTimeout: timeout });
  },

  reset: () => {
    const { _saveTimeout } = get();
    if (_saveTimeout) clearTimeout(_saveTimeout);
    set({
      currentResume: null,
      sections: [],
      isDirty: false,
      isSaving: get()._savePromise !== null,
      saveError: null,
      dirtyVersion: 0,
      lastSavedVersion: 0,
      _resumeGeneration: get()._resumeGeneration + 1,
      _saveTimeout: null,
      _persistResume: null,
    });
  },
}));
