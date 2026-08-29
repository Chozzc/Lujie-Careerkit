import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApplication, createJob, getAppData, updateApplication } from "@/lib/repository";

import {
  applicationChangeSchema,
  applyApplicationChange,
  getResumeContext,
  searchApplicationContext,
} from "./application-tools";

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

    expect(result.total).toBe(1);
    expect(result.records[0].application?.id).toBe("app-1");
  });

  it("searches all jobs before paginating and supports exact full-JD reads", async () => {
    const base = sampleData();
    const data = {
      ...base,
      jobs: Array.from({ length: 12 }, (_, index) => ({
        ...base.jobs[0],
        id: `job-${index + 1}`,
        company: index === 11 ? "目标公司" : `公司${index + 1}`,
        jd: index === 11 ? "完整目标 JD" : "JD",
        updatedAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      })),
      applications: [],
    };
    readData.mockResolvedValue(data as never);

    const searched = await searchApplicationContext({ query: "目标公司", limit: 8 });
    expect(searched.total).toBe(1);
    expect(searched.records[0].job.id).toBe("job-12");
    expect(searched.records[0].job).not.toHaveProperty("jd");

    const exact = await searchApplicationContext({ jobId: "job-12" });
    expect(exact.records[0].job).toMatchObject({ jd: "完整目标 JD" });
  });

  it("searches every resume and returns a privacy-filtered exact result", async () => {
    const data = {
      ...sampleData(),
      versions: Array.from({ length: 12 }, (_, index) => ({
        id: `resume-${index + 1}`,
        resumeId: `root-${index + 1}`,
        jobId: null,
        name: index === 11 ? "后端目标简历" : `简历${index + 1}`,
        summary: "摘要",
        content: sampleResume(),
        createdAt: "2026-08-19T00:00:00.000Z",
        updatedAt: "2026-08-19T00:00:00.000Z",
      })),
    };
    readData.mockResolvedValue(data as never);

    const searched = await getResumeContext({ query: "后端目标", limit: 8 });
    expect("resumes" in searched && searched.resumes?.[0].id).toBe("resume-12");

    const exact = await getResumeContext({ resumeVersionId: "resume-12" });
    expect("resume" in exact && exact.resume?.content).toMatchObject({
      basics: { name: "张三", city: "北京" },
    });
    expect("resume" in exact && exact.resume?.content).not.toHaveProperty("basics.email");
    expect("resume" in exact && exact.resume?.content).not.toHaveProperty("editor");
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

function sampleResume() {
  return {
    editor: { template: "classic" },
    basics: { name: "张三", email: "test@example.com", phone: "13800000000", city: "北京", links: ["https://example.com"] },
    profile: { title: "后端工程师", summary: "简介" },
    education: [],
    experiences: [{ company: "示例公司", role: "工程师", logo: "data:image/png;base64,abc", start: "", end: "", highlights: [] }],
    internships: [],
    projects: [],
    skills: ["TypeScript"],
    awards: [],
    selfReview: "",
  };
}
