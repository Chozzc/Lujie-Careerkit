import { describe, expect, it } from "vitest";
import { z } from "zod";

import { dateInputSchema, parseJsonRequest } from "./api-request";

describe("JSON request parsing", () => {
  const schema = z.object({ name: z.string().trim().min(1) });

  it("returns parsed data for a valid request", async () => {
    const result = await parseJsonRequest(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "  录阶  " }),
    }), schema);

    expect(result).toEqual({ success: true, data: { name: "录阶" } });
  });

  it("returns 400 for malformed JSON and schema mismatches", async () => {
    for (const body of ["{", JSON.stringify({ name: "" })]) {
      const result = await parseJsonRequest(new Request("http://localhost", { method: "POST", body }), schema);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.response.status).toBe(400);
    }
  });

  it("accepts real calendar dates and rejects normalized overflow dates", () => {
    expect(dateInputSchema.safeParse("2024-02-29").success).toBe(true);
    expect(dateInputSchema.safeParse("2026-02-29").success).toBe(false);
    expect(dateInputSchema.safeParse("2026-13-01").success).toBe(false);
  });
});
