import { describe, expect, it, vi } from "vitest";

import { warmAiRoutes } from "./ai-route-prewarm";

describe("AI route prewarm", () => {
  it("calls each route with a no-store GET request", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await warmAiRoutes(["/api/one", "/api/two"], fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/one", { method: "GET", cache: "no-store" });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/two", { method: "GET", cache: "no-store" });
  });

  it("ignores warm-up failures", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("cold route"));

    await expect(warmAiRoutes(["/api/one"], fetcher)).resolves.toBeUndefined();
  });
});
