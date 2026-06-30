import { describe, expect, it } from "vitest";

import { getAiSettingsMaintenancePatch } from "./settings-migration";

describe("AI settings maintenance migration", () => {
  it("does not rewrite an explicit DeepSeek flash selection to the provider default", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "deepseek",
        aiModel: "deepseek-v4-flash",
        model: "deepseek-v4-flash",
        aiApiKey: "",
        aiEnabled: false,
      }),
    ).toBeNull();
  });

  it("only migrates old OpenAI placeholder defaults when no key has been configured", () => {
    expect(
      getAiSettingsMaintenancePatch({
        aiProvider: "openai",
        aiModel: "gpt-4o-mini",
        model: "gpt-4o-mini",
        aiApiKey: "",
        aiEnabled: false,
      }),
    ).toMatchObject({
      aiModel: "gpt-5.5",
      model: "gpt-5.5",
      aiLastTestStatus: "untested",
    });
  });
});
