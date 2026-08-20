import { describe, expect, it } from "vitest";

import { normalizeApplicationInterviewRound, resolveApplicationAppliedAt } from "./application";

describe("application interview round", () => {
  it("keeps the round only while an application is interviewing", () => {
    expect(normalizeApplicationInterviewRound("INTERVIEW", "SECOND")).toBe("SECOND");
    expect(normalizeApplicationInterviewRound("INTERVIEW", "")).toBe("FIRST");
    expect(normalizeApplicationInterviewRound("OFFER", "SECOND")).toBe("");
  });
});

describe("application applied date", () => {
  it("uses the stage date consistently when an application becomes applied", () => {
    expect(resolveApplicationAppliedAt({
      status: "APPLIED",
      stageDate: "2026-08-13",
      existingAppliedAt: null,
    })).toEqual(new Date("2026-08-13"));
  });

  it("uses the transition time when no date was supplied and preserves an existing date", () => {
    const now = new Date("2026-08-13T10:00:00.000Z");
    expect(resolveApplicationAppliedAt({ status: "APPLIED", existingAppliedAt: null, now })).toEqual(now);
    expect(resolveApplicationAppliedAt({
      status: "APPLIED",
      existingAppliedAt: new Date("2026-08-01"),
      now,
    })).toBeUndefined();
  });
});
