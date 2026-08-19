import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJob } from "@/lib/repository";

import { GET, POST } from "./route";

vi.mock("@/lib/repository", () => ({
  createJob: vi.fn(),
}));

const create = vi.mocked(createJob);

describe("/api/jobs", () => {
  beforeEach(() => {
    create.mockReset();
  });

  it("prewarms the route without creating a job", async () => {
    const response = await GET();

    expect(response.status).toBe(204);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a job without implying an application", async () => {
    create.mockResolvedValue({ id: "job-1" } as never);

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
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      company: "美团",
      title: "后端开发实习生",
      jd: "负责服务端接口开发",
    }));
  });

  it("rejects blank required fields without calling the repository", async () => {
    const response = await POST(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({ company: "  ", title: "后端开发", jd: "岗位描述" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects invalid calendar dates before persistence", async () => {
    const response = await POST(
      new Request("http://localhost/api/jobs", {
        method: "POST",
        body: JSON.stringify({ company: "美团", title: "后端开发", jd: "岗位描述", deadline: "2026-02-30" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
