import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApplication, createJob, getAppData, updateApplication } from "@/lib/repository";

import { applicationChangeSchema, applyApplicationChange, searchApplicationContext } from "./application-tools";

vi.mock("@/lib/repository", () => ({
  createApplication: vi.fn(),
  createJob: vi.fn(),
  getAppData: vi.fn(),
  updateApplication: vi.fn(),
}));

const readData = vi.mocked(getAppData);
const createApplicationRecord = vi.mocked(createApplication);
const createJobRecord = vi.mocked(createJob);
const updateApplicationRecord = vi.mocked(updateApplication);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("applicationChangeSchema", () => {
  it("requires an explicit target for updates", () => {
    expect(applicationChangeSchema.safeParse({ action: "update", status: "INTERVIEW" }).success).toBe(false);
  });

  it("accepts a reviewable application creation proposal", () => {
    expect(applicationChangeSchema.safeParse({
      action: "create",
      company: "字节跳动",
      title: "前端实习生",
      status: "APPLIED",
      stageDate: "2026-08-19",
      nextFollowUpAt: "2026-08-26",
    }).success).toBe(true);
  });

  it("rejects impossible calendar dates before a write can be approved", () => {
    expect(applicationChangeSchema.safeParse({
      action: "create",
      company: "字节跳动",
      title: "前端实习生",
      stageDate: "2026-02-30",
    }).success).toBe(false);
  });

  it("updates only the selected application and appends notes", async () => {
    const data = sampleData({ notes: "已投递" });
    readData.mockResolvedValue(data as never);
    updateApplicationRecord.mockResolvedValue({ id: "app-1" } as never);

    const result = await applyApplicationChange({
      action: "update",
      applicationId: "app-1",
      status: "INTERVIEW",
      notesToAppend: "一面安排在周五",
    });

    expect(updateApplicationRecord).toHaveBeenCalledWith(expect.objectContaining({
      id: "app-1",
      status: "INTERVIEW",
      notes: "已投递\n一面安排在周五",
    }));
    expect(createJobRecord).not.toHaveBeenCalled();
    expect(result.operation).toBe("updated");
  });

  it("reuses an existing job when creating its first tracking card", async () => {
    const before = sampleData();
    const after = sampleData({ status: "APPLIED" });
    before.applications = [];
    readData.mockResolvedValueOnce(before as never).mockResolvedValueOnce(after as never);
    createApplicationRecord.mockResolvedValue({ id: "app-1" } as never);

    const result = await applyApplicationChange({
      action: "create",
      company: "字节 跳动",
      title: "前端实习生",
      status: "APPLIED",
    });

    expect(createJobRecord).not.toHaveBeenCalled();
    expect(createApplicationRecord).toHaveBeenCalledWith(expect.objectContaining({ jobId: "job-1" }));
    expect(result.operation).toBe("created");
  });

  it("lists recent records when no search term is needed", async () => {
    readData.mockResolvedValue(sampleData() as never);

    const result = await searchApplicationContext("");

    expect(result).toHaveLength(1);
    expect(result[0].application?.id).toBe("app-1");
  });
});

function sampleData(application: Record<string, unknown> = {}) {
  return {
    jobs: [{
      id: "job-1",
      company: "字节跳动",
      title: "前端实习生",
      city: "北京",
      source: "官网",
      jd: "JD",
      link: "",
      deadline: null,
      analysis: null,
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
    }],
    applications: [{
      id: "app-1",
      jobId: "job-1",
      status: "APPLIED",
      resumeVersionId: null,
      appliedAt: "2026-08-19",
      stageDate: "2026-08-19",
      nextFollowUpAt: null,
      notes: "",
      interviewRound: "",
      updatedAt: "2026-08-19T00:00:00.000Z",
      ...application,
    }],
    resume: null,
    versions: [],
    interviews: [],
    interviewPreparations: [],
    settings: null,
  };
}
