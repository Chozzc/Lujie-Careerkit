import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const transaction = {
    interviewPreparation: { deleteMany: vi.fn() },
    interviewSession: { deleteMany: vi.fn() },
    application: { deleteMany: vi.fn() },
    resumeVersion: { deleteMany: vi.fn() },
    job: { delete: vi.fn(), update: vi.fn() },
  };
  return {
    transaction,
    runTransaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
});

vi.mock("./db", () => ({ prisma: { $transaction: db.runTransaction, job: db.transaction.job } }));

import { clearJobAnalysis, deleteJobWithApplications } from "./repository";

describe("job archive deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.transaction.interviewPreparation.deleteMany.mockResolvedValue({ count: 2 });
    db.transaction.interviewSession.deleteMany.mockResolvedValue({ count: 3 });
    db.transaction.application.deleteMany.mockResolvedValue({ count: 1 });
    db.transaction.resumeVersion.deleteMany.mockResolvedValue({ count: 4 });
    db.transaction.job.delete.mockResolvedValue({ id: "job-1" });
    db.transaction.job.update.mockResolvedValue({ id: "job-1", jd: "", analysis: null });
  });

  it("deletes only records linked to the job and leaves resume roots untouched", async () => {
    const deleted = await deleteJobWithApplications("job-1");

    expect(db.transaction.interviewPreparation.deleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1" } });
    expect(db.transaction.interviewSession.deleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1" } });
    expect(db.transaction.application.deleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1" } });
    expect(db.transaction.resumeVersion.deleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1" } });
    expect(db.transaction.job.delete).toHaveBeenCalledWith({ where: { id: "job-1" } });
    expect(deleted).toEqual({
      interviewPreparations: 2,
      interviews: 3,
      applications: 1,
      resumeVersions: 4,
    });
  });

  it("clears the JD and analysis without deleting the job", async () => {
    await clearJobAnalysis("job-1");

    expect(db.transaction.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { jd: "", analysis: expect.anything() },
    });
    expect(db.transaction.job.delete).not.toHaveBeenCalled();
  });
});
