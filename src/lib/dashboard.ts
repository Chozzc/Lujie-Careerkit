import { applicationPriorityLabels, applicationStatusDateLabels } from "./pipeline";
import type { ApplicationPriority, ApplicationStatus } from "./types";

const ACTIVE_STATUSES = new Set<ApplicationStatus>(["APPLIED", "ASSESSMENT", "INTERVIEW"]);
const PRIORITY_STATUSES = new Set<ApplicationStatus>(["READY", "APPLIED", "ASSESSMENT", "INTERVIEW"]);
const SUBMITTED_STATUSES = new Set<ApplicationStatus>([
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
]);
const PRIORITY_RANK: Record<ApplicationPriority, number> = {
  HIGH: 0,
  NORMAL: 1,
  LOW: 2,
};

export const DASHBOARD_STAGE_STATUSES = [
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
] as const;

export type DashboardTarget = "resume" | "match" | "pipeline" | "interview";

export type DashboardJob = {
  id: string;
  company: string;
  title: string;
  deadline: string | null;
};

export type DashboardApplication = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  resumeVersionId: string | null;
  appliedAt: string | null;
  stageDate: string | null;
  priority: ApplicationPriority;
  nextFollowUpAt: string | null;
  updatedAt: string;
};

export type DashboardSummary = ReturnType<typeof buildDashboardSummary>;

type DashboardInput = {
  applications: DashboardApplication[];
  jobs: DashboardJob[];
};

export function buildDashboardSummary(input: DashboardInput, today = new Date()) {
  const jobById = new Map(input.jobs.map((job) => [job.id, job]));
  const submitted = input.applications.filter((application) => SUBMITTED_STATUSES.has(application.status));
  const active = input.applications.filter((application) => ACTIVE_STATUSES.has(application.status));
  const dueApplications = active.filter((application) => isDue(application.nextFollowUpAt, today));
  const actions = input.applications
    .flatMap((application) => {
      if (!PRIORITY_STATUSES.has(application.status)) return [];
      const job = jobById.get(application.jobId);
      if (!job) return [];
      const schedule = resolvePrioritySchedule(application, job);
      return [{
        applicationId: application.id,
        jobId: job.id,
        title: priorityActionTitle(application.status, job),
        detail: `${schedule.label}：${schedule.date} · ${applicationPriorityLabels[application.priority]}`,
        date: schedule.date,
        priority: application.priority,
        target: priorityActionTarget(application.status),
      }];
    })
    .toSorted((left, right) => {
      const dateDifference = dateTime(left.date) - dateTime(right.date);
      return dateDifference || PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
    })
    .slice(0, 3);

  return {
    metrics: {
      submitted: submitted.length,
      active: active.length,
      followUpsDue: dueApplications.length,
      offers: input.applications.filter((application) => application.status === "OFFER").length,
    },
    stageCounts: Object.fromEntries(
      DASHBOARD_STAGE_STATUSES.map((status) => [
        status,
        input.applications.filter((application) => application.status === status).length,
      ]),
    ) as Record<(typeof DASHBOARD_STAGE_STATUSES)[number], number>,
    actions,
  };
}

function resolvePrioritySchedule(application: DashboardApplication, job: DashboardJob) {
  if (application.stageDate) {
    return { date: application.stageDate, label: applicationStatusDateLabels[application.status] };
  }
  if (job.deadline) return { date: job.deadline, label: "岗位截止日期" };
  if (application.nextFollowUpAt) return { date: application.nextFollowUpAt, label: "下次跟进日期" };
  if (application.appliedAt) return { date: application.appliedAt, label: "投递日期" };
  return { date: application.updatedAt.slice(0, 10), label: "最近更新" };
}

function priorityActionTitle(status: ApplicationStatus, job: DashboardJob) {
  if (status === "READY") return `完成 ${job.company} · ${job.title} 的岗位匹配`;
  if (status === "ASSESSMENT") return `准备 ${job.company} · ${job.title} 的笔试 / 测评`;
  if (status === "INTERVIEW") return `准备 ${job.company} · ${job.title} 面试`;
  return `跟进 ${job.company} · ${job.title}`;
}

function priorityActionTarget(status: ApplicationStatus): DashboardTarget {
  if (status === "READY") return "match";
  if (status === "INTERVIEW") return "interview";
  return "pipeline";
}

function isDue(value: string | null, today: Date) {
  return Boolean(value && dateTime(value) <= today.getTime());
}

function dateTime(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}
