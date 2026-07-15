const SMART_ONE_PAGE_KEY = "lujie_resume_smart_one_page";

export function readSmartOnePagePreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SMART_ONE_PAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSmartOnePagePreference(value: boolean) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(SMART_ONE_PAGE_KEY, String(value));
    return true;
  } catch {
    return false;
  }
}
