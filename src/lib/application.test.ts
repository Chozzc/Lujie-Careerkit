import { describe, expect, it } from "vitest";

import { normalizeApplicationInterviewRound } from "./application";

describe("application interview round", () => {
  it("keeps the round only while an application is interviewing", () => {
    expect(normalizeApplicationInterviewRound("INTERVIEW", "SECOND")).toBe("SECOND");
    expect(normalizeApplicationInterviewRound("INTERVIEW", "")).toBe("FIRST");
    expect(normalizeApplicationInterviewRound("OFFER", "SECOND")).toBe("");
  });
});
