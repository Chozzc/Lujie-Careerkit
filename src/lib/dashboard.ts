import { defaultNextFollowUpDate, getApplicationDueDate, isActivePipelineStatus } from "./pipeline";
import type { ApplicationPriority, ApplicationStatus } from "./types";

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
  const active = input.applications.filter((application) => isActivePipelineStatus(application.status));
  const dueApplications = active.filter((application) => Boolean(getDashboardDueDate(application, today)));
  const actions = input.applications
    .flatMap((application) => {
      if (!PRIORITY_STATUSES.has(application.status)) return [];
      const job = jobById.get(application.jobId);
      if (!job) return [];
      if (application.status === "READY" && hasPlaceholderIdentity(job)) return [];
      const schedule = resolvePrioritySchedule(application, job);
      return [{
        applicationId: application.id,
        jobId: job.id,
        company: job.company,
        titleText: job.title,
        status: application.status,
        scheduleKey: schedule.key,
        priorityLabelKey: application.priority,
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

export function getDashboardDueDate(application: DashboardApplication, today = new Date()) {
  return getApplicationDueDate(application, today);
}

function resolvePrioritySchedule(application: DashboardApplication, job: DashboardJob) {
  const activeSchedule = resolveActiveSchedule(application);
  if (activeSchedule) return activeSchedule;
  if (application.status === "READY" && job.deadline) return { date: job.deadline, key: "deadline" as const };
  return { date: application.updatedAt.slice(0, 10), key: "updatedAt" as const };
}

function resolveActiveSchedule(application: DashboardApplication) {
  if (!isActivePipelineStatus(application.status)) return null;
  if (application.nextFollowUpAt) {
    return { date: application.nextFollowUpAt, key: "nextFollowUp" as const };
  }
  if (application.stageDate) {
    return { date: application.stageDate, key: "stageDate" as const };
  }
  const suggestedFollowUp = defaultNextFollowUpDate(application.appliedAt ?? "");
  return suggestedFollowUp
    ? { date: suggestedFollowUp, key: "suggestedFollowUp" as const }
    : null;
}

function hasPlaceholderIdentity(job: DashboardJob) {
  return isPlaceholderLabel(job.company) || isPlaceholderLabel(job.title);
}

function isPlaceholderLabel(value: string) {
  return /待|未知|未识别|目标公司|目标岗位/.test(value.trim());
}

function priorityActionTarget(status: ApplicationStatus): DashboardTarget {
  if (status === "READY") return "match";
  if (status === "INTERVIEW") return "interview";
  return "pipeline";
}

function dateTime(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}
