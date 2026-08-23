import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  clearJobAnalysis: vi.fn(),
  updateJobDescription: vi.fn(),
}));

vi.mock("@/lib/repository", () => repositoryMocks);

import { PATCH } from "./route";

describe("PATCH /api/jobs/[id]/analysis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the original JD and returns the changed job", async () => {
    repositoryMocks.updateJobDescription.mockResolvedValue({ id: "job-1", jd: "新的完整 JD", analysis: null });
    const response = await PATCH(new Request("http://localhost/api/jobs/job-1/analysis", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd: "新的完整 JD" }),
    }), { params: Promise.resolve({ id: "job-1" }) });

    expect(response.status).toBe(200);
    expect(repositoryMocks.updateJobDescription).toHaveBeenCalledWith("job-1", "新的完整 JD");
  });
});
