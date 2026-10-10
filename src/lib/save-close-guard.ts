import { useResumeStore } from '@/stores/resume-store';

export function installSaveCloseGuard() {
  const beforeUnload = (event: BeforeUnloadEvent) => {
    const state = useResumeStore.getState();
    if (state.isDirty || state.isSaving) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnload);
  return () => window.removeEventListener('beforeunload', beforeUnload);
}
