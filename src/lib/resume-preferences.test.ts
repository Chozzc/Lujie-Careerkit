import { afterEach, describe, expect, it, vi } from "vitest";

import { readSmartOnePagePreference, writeSmartOnePagePreference } from "./resume-preferences";

afterEach(() => vi.unstubAllGlobals());

describe("resume editor preferences", () => {
  it("does not throw when browser storage is unavailable", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => { throw new Error("blocked"); },
        setItem: () => { throw new Error("blocked"); },
      },
    });

    expect(readSmartOnePagePreference()).toBe(false);
    expect(writeSmartOnePagePreference(true)).toBe(false);
  });
});
