import { describe, expect, it } from "vitest";

import {
  applicationSourceOptions,
  buildApplicationTimeline,
  buildPipelineOverview,
  chunkPipelineStatuses,
  companySuggestions,
  defaultNextFollowUpDate,
  visiblePipelineStatuses,
} from "./pipeline";

describe("pipeline presentation helpers", () => {
  it("shows only tracked application states in two rows of three", () => {
    expect(visiblePipelineStatuses).toEqual([
      "APPLIED",
      "ASSESSMENT",
      "INTERVIEW",
      "OFFER",
      "REJECTED",
      "ARCHIVED",
    ]);
    expect(chunkPipelineStatuses()).toEqual([
      ["APPLIED", "ASSESSMENT", "INTERVIEW"],
      ["OFFER", "REJECTED", "ARCHIVED"],
    ]);
  });

  it("builds overview metrics from visible applications", () => {
    const overview = buildPipelineOverview(
      {
        jobs: [
          { id: "job-1", source: "手动录入", deadline: "2026-06-10" },
          { id: "job-2", source: "内推", deadline: "2026-06-20" },
          { id: "job-3", source: "Boss", deadline: null },
          { id: "job-ready", source: "官网", deadline: "2026-06-08" },
        ],
        applications: [
          {
            id: "app-1",
            jobId: "job-1",
            status: "APPLIED",
            nextFollowUpAt: "2026-06-05",
          },
          {
            id: "app-2",
            jobId: "job-2",
            status: "INTERVIEW",
            nextFollowUpAt: "2026-06-12",
          },
          {
            id: "app-3",
            jobId: "job-3",
            status: "OFFER",
            nextFollowUpAt: null,
          },
          {
            id: "app-ready",
            jobId: "job-ready",
            status: "READY",
            nextFollowUpAt: "2026-06-01",
          },
        ],
      },
      new Date("2026-06-06T00:00:00.000Z"),
    );

    expect(overview.total).toBe(3);
    expect(overview.active).toBe(2);
    expect(overview.followUpsDue).toBe(1);
    expect(overview.offerRate).toBe(33);
    expect(overview.interviewRate).toBe(67);
    expect(overview.statusCounts.map((item) => String(item.status))).not.toContain("READY");
    expect(overview.sourceCounts).toEqual([
      { source: "企业官网", count: 1 },
      { source: "内推", count: 1 },
      { source: "BOSS直聘", count: 1 },
    ]);
  });

  it("provides common company and source options for application entry", () => {
    expect(companySuggestions).toContain("字节跳动");
    expect(companySuggestions).toContain("腾讯");
    expect(applicationSourceOptions).toEqual(
      expect.arrayContaining(["实习僧", "BOSS直聘", "猎聘", "企业官网", "内推", "邮件", "其他"]),
    );
    expect(applicationSourceOptions).not.toContain("手动录入");
  });

  it("defaults the next follow-up date to one week after applying", () => {
    expect(defaultNextFollowUpDate("2026-06-06")).toBe("2026-06-13");
    expect(defaultNextFollowUpDate("")).toBe("");
  });

  it("builds a compact card progress line from application status", () => {
    const timeline = buildApplicationTimeline({
      status: "INTERVIEW",
      appliedAt: "2026-06-01",
      updatedAt: "2026-06-08T09:00:00.000Z",
    });

    expect(timeline.map((item) => item.label)).toEqual(["已投递", "笔试 / 测评", "面试中", "Offer"]);
    expect(timeline.map((item) => item.tone)).toEqual(["done", "done", "current", "future"]);
    expect(timeline[0].date).toBe("2026-06-01");
    expect(timeline[2].date).toBe("2026-06-08T09:00:00.000Z");
  });

  it("replaces the final step for closed application states", () => {
    const timeline = buildApplicationTimeline({
      status: "REJECTED",
      appliedAt: "2026-06-01",
      updatedAt: "2026-06-08",
    });

    expect(timeline.map((item) => item.label)).toEqual(["已投递", "笔试 / 测评", "面试中", "拒绝"]);
    expect(timeline.map((item) => item.tone)).toEqual(["done", "future", "future", "terminal"]);
  });
});
