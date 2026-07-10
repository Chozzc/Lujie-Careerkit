import { getApplicationActionDate, getApplicationDueDate, isActivePipelineStatus } from "./pipeline";
import type { ApplicationStatus } from "./types";

const ACTION_STATUSES = new Set<ApplicationStatus>(["READY", "APPLIED", "ASSESSMENT", "INTERVIEW"]);
const SUBMITTED_STATUSES = new Set<ApplicationStatus>([
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
]);
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
      if (!ACTION_STATUSES.has(application.status)) return [];
      const job = jobById.get(application.jobId);
      if (!job) return [];
      if (application.status === "READY" && hasPlaceholderIdentity(job)) return [];
      const schedule = resolveActionSchedule(application, job);
      return [{
        applicationId: application.id,
        jobId: job.id,
        company: job.company,
        titleText: job.title,
        status: application.status,
        scheduleKey: schedule.key,
        date: schedule.date,
        isDue: dateTime(schedule.date) <= today.getTime(),
        target: actionTarget(application.status),
      }];
    })
    .toSorted((left, right) => {
      return dateTime(left.date) - dateTime(right.date);
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

function resolveActionSchedule(application: DashboardApplication, job: DashboardJob) {
  const activeSchedule = resolveActiveSchedule(application);
  if (activeSchedule) return activeSchedule;
  if (application.status === "READY" && job.deadline) return { date: job.deadline, key: "deadline" as const };
  return { date: application.updatedAt.slice(0, 10), key: "updatedAt" as const };
}

function resolveActiveSchedule(application: DashboardApplication) {
  if (!isActivePipelineStatus(application.status)) return null;
  const date = getApplicationActionDate(application);
  if (!date) return null;
  if (application.nextFollowUpAt) {
    return { date, key: "nextFollowUp" as const };
  }
  if (application.status === "APPLIED") {
    return { date, key: "suggestedFollowUp" as const };
  }
  if (application.stageDate) {
    return { date, key: "stageDate" as const };
  }
  return { date, key: "suggestedFollowUp" as const };
}

function hasPlaceholderIdentity(job: DashboardJob) {
  return isPlaceholderLabel(job.company) || isPlaceholderLabel(job.title);
}

function isPlaceholderLabel(value: string) {
  return /待|未知|未识别|目标公司|目标岗位/.test(value.trim());
}

function actionTarget(status: ApplicationStatus): DashboardTarget {
  if (status === "READY") return "match";
  if (status === "INTERVIEW") return "interview";
  return "pipeline";
}

function dateTime(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}
