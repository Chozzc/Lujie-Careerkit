import { create } from 'zustand';
import type { ResumeSection } from '@/types/resume';
import type { ResumeSnapshot } from '@/types/editor';
import { MAX_UNDO_STACK } from '@/lib/constants';

interface EditorStore {
  selectedSectionId: string | null;
  isDragging: boolean;
  zoom: number;
  undoStack: ResumeSnapshot[];
  redoStack: ResumeSnapshot[];

  selectSection: (id: string | null) => void;
  setDragging: (isDragging: boolean) => void;
  setZoom: (zoom: number) => void;
  pushSnapshot: (sections: ResumeSection[]) => void;
  undo: () => ResumeSnapshot | null;
  redo: () => ResumeSnapshot | null;
  reset: () => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  selectedSectionId: null,
  isDragging: false,
  zoom: 100,
  undoStack: [],
  redoStack: [],

  selectSection: (id) => set({ selectedSectionId: id }),
  setDragging: (isDragging) => set({ isDragging }),
  setZoom: (zoom) => set({ zoom }),

  pushSnapshot: (sections) => {
    set((state) => ({
      undoStack: [
        ...state.undoStack.slice(-MAX_UNDO_STACK + 1),
        { sections, timestamp: Date.now() },
      ],
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const snapshot = undoStack[undoStack.length - 1];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, snapshot],
    }));
    return snapshot;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;
    const snapshot = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, snapshot],
    }));
    return snapshot;
  },

  reset: () =>
    set({
      selectedSectionId: null,
      isDragging: false,
      zoom: 100,
      undoStack: [],
      redoStack: [],
    }),
}));
