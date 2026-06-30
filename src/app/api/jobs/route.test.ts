import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJobWithApplication } from "@/lib/repository";

import { GET, POST } from "./route";

vi.mock("@/lib/repository", () => ({
  createJobWithApplication: vi.fn(),
}));

const createJob = vi.mocked(createJobWithApplication);

describe("/api/jobs", () => {
  beforeEach(() => {
    createJob.mockReset();
  });

  it("prewarms the route without creating a job", async () => {
    const response = await GET();

    expect(response.status).toBe(204);
    expect(createJob).not.toHaveBeenCalled();
  });

  it("creates a job with an application", async () => {
    createJob.mockResolvedValue({
      job: { id: "job-1" },
      application: { id: "app-1" },
    } as never);

    const response = await POST(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          company: "美团",
          title: "后端开发实习生",
          jd: "负责服务端接口开发",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({
      company: "美团",
      title: "后端开发实习生",
      jd: "负责服务端接口开发",
    }));
  });
});
