import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteJobWithApplications, updateJobIdentity } from "@/lib/repository";

import { DELETE, PATCH } from "./route";

vi.mock("@/lib/repository", () => ({
  deleteJobWithApplications: vi.fn(),
  updateJobIdentity: vi.fn(),
  updateJobWithApplication: vi.fn(),
}));

const deleteArchive = vi.mocked(deleteJobWithApplications);
const updateIdentity = vi.mocked(updateJobIdentity);

describe("DELETE /api/jobs/[id]", () => {
  beforeEach(() => deleteArchive.mockReset());

  it("deletes the complete job archive and returns affected counts", async () => {
    deleteArchive.mockResolvedValue({
      interviewPreparations: 1,
      interviews: 2,
      applications: 1,
      resumeVersions: 3,
    });

    const response = await DELETE(new Request("http://localhost/api/jobs/job-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "job-1" }),
    });

    expect(deleteArchive).toHaveBeenCalledWith("job-1");
    expect(await response.json()).toEqual({
      ok: true,
      deleted: { interviewPreparations: 1, interviews: 2, applications: 1, resumeVersions: 3 },
    });
  });
});

describe("PATCH /api/jobs/[id]", () => {
  it("updates the job identity without requiring an application", async () => {
    updateIdentity.mockResolvedValue({ id: "job-1", company: "字节跳动", title: "AI 产品实习生" } as never);

    const response = await PATCH(new Request("http://localhost/api/jobs/job-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: "字节跳动", title: "AI 产品实习生" }),
    }), { params: Promise.resolve({ id: "job-1" }) });

    expect(updateIdentity).toHaveBeenCalledWith("job-1", "字节跳动", "AI 产品实习生");
    expect(response.status).toBe(200);
  });
});
