import { describe, expect, it } from "vitest";

import { normalizeAiError } from "./errors";

describe("AI error normalization", () => {
  it("explains missing API keys", () => {
    expect(normalizeAiError(new Error("Missing API key")).message).toContain("API Key");
  });

  it("explains unauthorized provider responses", () => {
    expect(normalizeAiError(new Error("401 unauthorized")).message).toContain("密钥");
  });

  it("explains rate limits and quota issues", () => {
    expect(normalizeAiError(new Error("429 rate_limit_exceeded")).message).toContain("限流");
  });

  it("does not misclassify generated output errors as rate limits", () => {
    expect(normalizeAiError(new Error("No object generated: could not parse JSON"))).toMatchObject({
      code: "invalid_json",
    });
  });

  it("keeps unknown errors safe and user-facing", () => {
    const result = normalizeAiError(new Error("socket hang up with secret sk-123"));

    expect(result.message).toContain("AI 请求失败");
    expect(result.message).not.toContain("sk-123");
  });
});
