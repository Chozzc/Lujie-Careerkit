import { describe, expect, it } from "vitest";

import { shouldSeedSampleResumeVersion } from "./resume-version-seeding";

describe("sample resume version seeding", () => {
  it("does not recreate a built-in resume version after the user deleted it", () => {
    expect(
      shouldSeedSampleResumeVersion({
        versionId: "rv-alibaba-data",
        existingVersionIds: new Set(),
        deletedSeedVersionIds: new Set(["rv-alibaba-data"]),
      }),
    ).toBe(false);
  });

  it("creates missing built-in resume versions that have not been deleted", () => {
    expect(
      shouldSeedSampleResumeVersion({
        versionId: "rv-huawei-qa-original",
        existingVersionIds: new Set(),
        deletedSeedVersionIds: new Set(),
      }),
    ).toBe(true);
  });

  it("does not touch existing built-in resume versions", () => {
    expect(
      shouldSeedSampleResumeVersion({
        versionId: "rv-huawei-qa-original",
        existingVersionIds: new Set(["rv-huawei-qa-original"]),
        deletedSeedVersionIds: new Set(),
      }),
    ).toBe(false);
  });
});
