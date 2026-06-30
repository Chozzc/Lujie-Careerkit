import { describe, expect, it } from "vitest";

import { buildDashboardSummary } from "./dashboard";

describe("buildDashboardSummary", () => {
  it("derives operational metrics from persisted records", () => {
    const summary = buildDashboardSummary(
      {
        applications: [
          application("draft", "job-draft", "READY", null, null, "2026-06-23T01:00:00.000Z"),
          application("applied", "job-applied", "APPLIED", null, "2026-06-21", "2026-06-22T01:00:00.000Z"),
          application("assessment", "job-assessment", "ASSESSMENT", "rv-1", "2026-06-25", "2026-06-22T02:00:00.000Z"),
          application("interview", "job-interview", "INTERVIEW", "rv-2", "2026-06-22", "2026-06-23T02:00:00.000Z"),
          application("offer", "job-offer", "OFFER", "rv-3", null, "2026-06-20T01:00:00.000Z"),
          application("rejected", "job-rejected", "REJECTED", null, null, "2026-06-19T01:00:00.000Z"),
          application("archived", "job-archived", "ARCHIVED", null, null, "2026-06-18T01:00:00.000Z"),
        ],
        jobs: [
          job("job-draft", "百度", "产品实习生"),
          job("job-applied", "美团", "后端开发实习生"),
          job("job-assessment", "腾讯", "数据分析实习生"),
          job("job-interview", "阿里巴巴", "算法实习生"),
          job("job-offer", "字节跳动", "前端开发实习生"),
          job("job-rejected", "小红书", "产品运营实习生"),
          job("job-archived", "京东", "测试开发实习生"),
        ],
      },
      new Date("2026-06-23T12:00:00.000Z"),
    );

    expect(summary.metrics).toEqual({ submitted: 6, active: 3, followUpsDue: 2, offers: 1 });
    expect(summary.stageCounts).toMatchObject({
      APPLIED: 1,
      ASSESSMENT: 1,
      INTERVIEW: 1,
      OFFER: 1,
      REJECTED: 1,
      ARCHIVED: 1,
    });
    expect(summary).not.toHaveProperty("recentVersions");
    expect(summary).not.toHaveProperty("recentInterviews");
    expect(summary).not.toHaveProperty("resumeHealth");
  });

  it("returns useful empty states without inventing actions or scores", () => {
    const summary = buildDashboardSummary({ applications: [], jobs: [] });

    expect(summary.metrics).toEqual({ submitted: 0, active: 0, followUpsDue: 0, offers: 0 });
    expect(summary).not.toHaveProperty("recentVersions");
    expect(summary).not.toHaveProperty("recentInterviews");
    expect(summary.actions).toEqual([]);
  });

  it("takes the three earliest active dates and uses manual priority for matching dates", () => {
    const summary = buildDashboardSummary(
      {
        applications: [
          application("late-high", "job-late", "ASSESSMENT", null, null, "2026-06-20T08:00:00.000Z", {
            stageDate: "2026-06-30",
            priority: "HIGH",
          }),
          application("soon-low", "job-soon-low", "APPLIED", null, null, "2026-06-20T08:00:00.000Z", {
            stageDate: "2026-06-24",
            priority: "LOW",
          }),
          application("soon-high", "job-soon-high", "INTERVIEW", null, null, "2026-06-20T08:00:00.000Z", {
            stageDate: "2026-06-24",
            priority: "HIGH",
          }),
          application("middle", "job-middle", "ASSESSMENT", null, null, "2026-06-20T08:00:00.000Z", {
            stageDate: "2026-06-25",
            priority: "NORMAL",
          }),
          application("terminal", "job-terminal", "OFFER", null, null, "2026-06-20T08:00:00.000Z", {
            stageDate: "2026-06-23",
            priority: "HIGH",
          }),
        ],
        jobs: [
          job("job-late", "百度", "前端开发实习生"),
          job("job-soon-low", "腾讯", "产品运营实习生"),
          job("job-soon-high", "美团", "后端开发实习生"),
          job("job-middle", "小红书", "Agent 运营实习生"),
          job("job-terminal", "阿里巴巴", "算法实习生"),
        ],
      },
      new Date("2026-06-23T12:00:00.000Z"),
    );

    expect(summary.actions.map((action) => action.applicationId)).toEqual([
      "soon-high",
      "soon-low",
      "middle",
    ]);
  });
});

function job(id: string, company: string, title: string) {
  return { id, company, title, deadline: null };
}

function application(
  id: string,
  jobId: string,
  status: "READY" | "APPLIED" | "ASSESSMENT" | "INTERVIEW" | "OFFER" | "REJECTED" | "ARCHIVED",
  resumeVersionId: string | null,
  nextFollowUpAt: string | null,
  updatedAt: string,
  options: {
    appliedAt?: string | null;
    stageDate?: string | null;
    priority?: "HIGH" | "NORMAL" | "LOW";
  } = {},
) {
  return {
    id,
    jobId,
    status,
    resumeVersionId,
    appliedAt: options.appliedAt ?? null,
    nextFollowUpAt,
    stageDate: options.stageDate ?? null,
    priority: options.priority ?? "NORMAL",
    updatedAt,
  };
}
