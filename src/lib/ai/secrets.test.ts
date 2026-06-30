import { describe, expect, it } from "vitest";

import { decryptLocalSecret, encryptLocalSecret, previewSecret } from "./secrets";

describe("local AI secret helpers", () => {
  it("round-trips a secret without storing plaintext", () => {
    const encrypted = encryptLocalSecret("sk-test-secret-value");

    expect(encrypted).not.toContain("sk-test-secret-value");
    expect(decryptLocalSecret(encrypted)).toBe("sk-test-secret-value");
  });

  it("returns an empty string for missing or invalid encrypted values", () => {
    expect(decryptLocalSecret("")).toBe("");
    expect(decryptLocalSecret("not-encrypted")).toBe("");
  });

  it("builds a safe preview", () => {
    expect(previewSecret("sk-1234567890abcdef")).toBe("sk-1...cdef");
    expect(previewSecret("short")).toBe("已保存");
    expect(previewSecret("")).toBe("");
  });
});
