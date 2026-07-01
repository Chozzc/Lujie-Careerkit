import { describe, expect, it } from "vitest";

import { sampleJobs, sampleResumeVersions } from "./sample-data";

describe("sample resume versions", () => {
  it("provides complete, distinct public resume examples", () => {
    expect(sampleResumeVersions.length).toBeGreaterThanOrEqual(1);
    expect(new Set(sampleResumeVersions.map((version) => version.id)).size).toBe(sampleResumeVersions.length);
    expect(new Set(sampleResumeVersions.map((version) => version.content.basics.name)).size).toBe(
      sampleResumeVersions.length,
    );
    expect(new Set(sampleResumeVersions.map((version) => JSON.stringify(version.content))).size).toBe(
      sampleResumeVersions.length,
    );

    for (const version of sampleResumeVersions) {
      expect(version.content.basics.name).toBeTruthy();
      expect(version.content.education.length).toBeGreaterThan(0);
      expect(version.content.internships.length).toBeGreaterThan(0);
      expect(version.content.projects.length).toBeGreaterThan(0);
      expect(version.content.skills.length).toBeGreaterThan(0);
      expect(version.content.selfReview).toBeTruthy();
    }
  });

  it("spreads sample job sources across common channels", () => {
    expect(new Set(sampleJobs.map((job) => job.source)).size).toBeGreaterThanOrEqual(5);
  });
});
