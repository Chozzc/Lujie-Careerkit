import { describe, expect, it } from "vitest";

import { interviewReportSchema } from "./interview";
import { interviewPreparationSchema } from "./interview-preparation";
import {
  sampleApplications,
  sampleInterviewPreparation,
  sampleInterviewSession,
  sampleJobs,
  sampleResumeVersions,
  sampleTailoredResumeVersion,
} from "./sample-data";

describe("sample resume versions", () => {
  it("provides complete, distinct public resume examples", () => {
    expect(sampleResumeVersions.length).toBeGreaterThanOrEqual(1);
    expect(new Set(sampleResumeVersions.map((version) => version.id)).size).toBe(sampleResumeVersions.length);
    expect(new Set(sampleResumeVersions.map((version) => version.content.basics.name)).size).toBe(
      sampleResumeVersions.length,
    );
    expect(new Set(sampleResumeVersions.map((version) => JSON.stringify(version.content))).size).toBe(
      sampleResumeVersions.length,
    );

    for (const version of sampleResumeVersions) {
      expect(version.content.basics.name).toBeTruthy();
      expect(version.content.education.length).toBeGreaterThan(0);
      expect(version.content.internships.length).toBeGreaterThan(0);
      expect(version.content.projects.length).toBeGreaterThan(0);
      expect(version.content.skills.length).toBeGreaterThan(0);
      expect(version.content.selfReview).toBeTruthy();
    }
  });

  it("spreads sample job sources across common channels", () => {
    expect(new Set(sampleJobs.map((job) => job.source)).size).toBeGreaterThanOrEqual(5);
  });

  it("provides a complete and internally linked demo workflow", () => {
    const jobIds = new Set(sampleJobs.map((job) => job.id));
    const versionIds = new Set([
      ...sampleResumeVersions.map((version) => version.id),
      sampleTailoredResumeVersion.id,
    ]);

    expect(sampleJobs.every((job) => job.city && job.link && !job.jd.includes("暂未补充"))).toBe(true);
    expect(sampleApplications.every((application) => jobIds.has(application.jobId))).toBe(true);
    expect(
      sampleApplications.every(
        (application) => application.resumeVersionId === null || versionIds.has(application.resumeVersionId),
      ),
    ).toBe(true);
    expect(jobIds.has(sampleTailoredResumeVersion.jobId)).toBe(true);
    expect(sampleInterviewPreparation.jobId).toBe(sampleTailoredResumeVersion.jobId);
    expect(sampleInterviewSession.jobId).toBe(sampleTailoredResumeVersion.jobId);
    expect(interviewPreparationSchema.safeParse(sampleInterviewPreparation.content).success).toBe(true);
    expect(sampleInterviewSession.questions).toHaveLength(8);
    expect(interviewReportSchema.safeParse(sampleInterviewSession.feedback).success).toBe(true);
  });
});
