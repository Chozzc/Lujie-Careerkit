import type { NavKey } from "@/lib/navigation";

export const FIRST_USE_TOUR_STORAGE_KEY = "lujie:first-use-tour:v1";

export type FirstUseTourStepId =
  | "welcome"
  | "dashboard"
  | "settings"
  | "agent"
  | "resume"
  | "match"
  | "interview"
  | "pipeline"
  | "library";

export type FirstUseTourStep = {
  id: FirstUseTourStepId;
  nav?: NavKey;
  target?: "agent";
};

export function buildFirstUseTourSteps(): FirstUseTourStep[] {
  return [
    { id: "welcome" },
    { id: "dashboard", nav: "dashboard" },
    { id: "settings", nav: "settings" },
    { id: "agent", target: "agent" },
    { id: "resume", nav: "resume" },
    { id: "match", nav: "match" },
    { id: "interview", nav: "interview" },
    { id: "library", nav: "library" },
    { id: "pipeline", nav: "pipeline" },
  ];
}

export function hasSeenFirstUseTour(storage: Pick<Storage, "getItem">) {
  return storage.getItem(FIRST_USE_TOUR_STORAGE_KEY) !== null;
}

export function markFirstUseTourSeen(storage: Pick<Storage, "setItem">, outcome: "completed" | "skipped") {
  storage.setItem(FIRST_USE_TOUR_STORAGE_KEY, outcome);
}
