import { useResumeStore } from '@/stores/resume-store';

type CloseEvent = { preventDefault: () => void };
type DesktopWindow = {
  onCloseRequested: (handler: (event: CloseEvent) => Promise<void>) => Promise<() => void>;
  destroy: () => Promise<void>;
};

declare global {
  interface Window {
    __TAURI__?: { window: { getCurrentWindow: () => DesktopWindow } };
  }
}

export function installSaveCloseGuard() {
  const beforeUnload = (event: BeforeUnloadEvent) => {
    const state = useResumeStore.getState();
    if (state.isDirty || state.isSaving) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnload);
  const desktop = window.__TAURI__?.window.getCurrentWindow();
  let closing = false;
  let disposed = false;
  let unlisten: (() => void) | undefined;
  const notifyFailure = () => window.alert(document.documentElement.lang.startsWith('en')
    ? 'Your resume could not be saved. The window has been kept open. Please retry saving before closing.'
    : '简历尚未保存成功，窗口已保留。请确认保存成功后再关闭。');
  if (desktop) {
    void desktop.onCloseRequested(async (event) => {
      event.preventDefault();
      if (closing || disposed) return;
      closing = true;
      try {
        if (await useResumeStore.getState().save('auto')) await desktop.destroy();
        else notifyFailure();
      } catch (error) {
        console.error('Cannot finish desktop close:', error);
        notifyFailure();
      } finally {
        closing = false;
      }
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    }).catch((error) => {
      console.error('Cannot register desktop save protection:', error);
      if (!disposed) notifyFailure();
    });
  }
  return () => {
    disposed = true;
    unlisten?.();
    window.removeEventListener('beforeunload', beforeUnload);
  };
}
