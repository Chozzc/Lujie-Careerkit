import { describe, expect, it } from "vitest";

import { contentToJadeResume, jadeResumeToContent } from "./resume-adapter";
import { normalizeResumeContent } from "./resume-content";
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

  it("keeps the sample GPA in its education field after saving and reopening", () => {
    const source = sampleResumeVersions.find((version) => version.id === "rv-baidu-ai-original")!.content;
    const saved = jadeResumeToContent(contentToJadeResume(normalizeResumeContent(source)));
    expect(saved.education[0].gpa).toBe("3.8/4.0");
    expect(saved.education[0].highlights).toEqual(["核心课程：数据结构、数据库、机器学习、软件工程"]);
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
      sampleApplications.every((application) =>
        [application.appliedAt, application.stageDate, application.nextFollowUpAt]
          .filter(Boolean)
          .every((date) => /^2026-(09|11|12)-\d{2}$/.test(date ?? "")),
      ),
    ).toBe(true);
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
    expect(Object.keys(sampleInterviewSession.answers)).toHaveLength(sampleInterviewSession.questions.length);
    expect(sampleInterviewSession.feedback.questionReviews).toHaveLength(sampleInterviewSession.questions.length);
    expect(interviewReportSchema.safeParse(sampleInterviewSession.feedback).success).toBe(true);
  });
});
