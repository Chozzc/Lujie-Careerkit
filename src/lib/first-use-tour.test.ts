import { describe, expect, it } from "vitest";

import {
  FIRST_USE_TOUR_STORAGE_KEY,
  buildFirstUseTourSteps,
  hasSeenFirstUseTour,
  markFirstUseTourSeen,
} from "./first-use-tour";

describe("first use tour", () => {
  it("introduces the Agent immediately after AI setup", () => {
    expect(buildFirstUseTourSteps().map((step) => step.id)).toEqual([
      "welcome", "dashboard", "settings", "agent", "resume", "match", "interview", "library", "pipeline",
    ]);
    expect(buildFirstUseTourSteps()[3]).toEqual({ id: "agent", target: "agent" });
  });

  it("records completion or skipping as seen", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(hasSeenFirstUseTour(storage)).toBe(false);
    markFirstUseTourSeen(storage, "skipped");
    expect(values.get(FIRST_USE_TOUR_STORAGE_KEY)).toBe("skipped");
    expect(hasSeenFirstUseTour(storage)).toBe(true);
  });
});
