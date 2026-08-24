import { describe, expect, it } from "vitest";

import type { RedactedAiSettings } from "./settings";
import { isAiReady } from "./readiness";

const configuredSettings: RedactedAiSettings = {
  aiProvider: "deepseek",
  aiModel: "deepseek-v4-flash",
  aiBaseUrl: "https://api.deepseek.com/v1",
  aiEnabled: true,
  aiTemperature: 0.3,
  aiLastTestedAt: null,
  aiLastTestStatus: "untested",
  hasApiKey: true,
  apiKeyPreview: "sk-...test",
  requiresApiKey: true,
};

describe("AI readiness", () => {
  it("enables a configured provider without a separate AI toggle or required test", () => {
    expect(isAiReady({ ...configuredSettings, aiEnabled: false })).toBe(true);
  });

  it("keeps missing keys and known failed connections unavailable", () => {
    expect(isAiReady({ ...configuredSettings, hasApiKey: false })).toBe(false);
    expect(isAiReady({ ...configuredSettings, aiLastTestStatus: "failed" })).toBe(false);
  });
});
