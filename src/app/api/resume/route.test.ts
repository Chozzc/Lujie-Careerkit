import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateResume } from "@/lib/repository";

import { POST } from "./route";

vi.mock("@/lib/repository", () => ({
  updateResume: vi.fn(),
}));

const update = vi.mocked(updateResume);
const resumeContent = {
  basics: { name: "张三", email: "", phone: "", city: "", links: [] },
  profile: { title: "", summary: "" },
  education: [],
  experiences: [],
  internships: [],
  projects: [],
  skills: [],
  awards: [],
  selfReview: "",
};

describe("/api/resume", () => {
  beforeEach(() => update.mockReset());

  it("rejects invalid resume JSON before persistence", async () => {
    const response = await POST(new Request("http://localhost/api/resume", {
      method: "POST",
      body: JSON.stringify({ content: { basics: {} } }),
    }));

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("normalizes untrusted editor theme settings before persistence", async () => {
    update.mockImplementation(async (_versionId, content) => ({
      id: "version-1",
      resumeId: "resume-1",
      name: "主简历",
      summary: "",
      jobId: null,
      content,
      resume: { id: "resume-1", name: "主简历", createdAt: new Date("2026-07-15T00:00:00.000Z"), updatedAt: new Date("2026-07-15T00:00:00.000Z") },
      createdAt: new Date("2026-07-15T00:00:00.000Z"),
      updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    }));

    const response = await POST(new Request("http://localhost/api/resume", {
      method: "POST",
      body: JSON.stringify({
        versionId: "version-1",
        content: {
          ...resumeContent,
          editor: { themeConfig: { fontFamily: "Inter;}</style><script>alert(1)</script>" } },
        },
      }),
    }));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith("version-1", expect.objectContaining({
      editor: expect.objectContaining({ themeConfig: expect.objectContaining({ fontFamily: "Inter" }) }),
    }), undefined);
  });
});
