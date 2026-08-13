import { describe, expect, it } from "vitest";

import {
  FIRST_USE_TOUR_STORAGE_KEY,
  buildFirstUseTourSteps,
  hasSeenFirstUseTour,
  markFirstUseTourSeen,
} from "./first-use-tour";

describe("first use tour", () => {
  it("follows the LuJie workflow and only includes setup when AI is not ready", () => {
    expect(buildFirstUseTourSteps(false).map((step) => step.id)).toEqual([
      "welcome", "dashboard", "settings", "resume", "match", "interview", "library", "pipeline",
    ]);
    expect(buildFirstUseTourSteps(true).map((step) => step.id)).toEqual([
      "welcome", "dashboard", "resume", "match", "interview", "library", "pipeline",
    ]);
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
