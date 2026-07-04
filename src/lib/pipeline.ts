import type { ApplicationPriority, ApplicationStatus } from "./types";

export const applicationPriorityLabels: Record<ApplicationPriority, string> = {
  HIGH: "高优先级",
  NORMAL: "普通",
  LOW: "低优先级",
};

export const applicationPriorityOptions = ["HIGH", "NORMAL", "LOW"] as const satisfies ApplicationPriority[];

export const applicationStatusDateLabels: Record<ApplicationStatus, string> = {
  READY: "岗位截止日期",
  APPLIED: "投递日期",
  ASSESSMENT: "笔试 / 测评日期",
  INTERVIEW: "面试日期",
  OFFER: "Offer 日期",
  REJECTED: "拒绝日期",
  ARCHIVED: "归档日期",
};

export const visiblePipelineStatuses = [
  "APPLIED",
  "ASSESSMENT",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
  "ARCHIVED",
] as const satisfies ApplicationStatus[];

export const pipelineStatusLabels: Record<(typeof visiblePipelineStatuses)[number], string> = {
  APPLIED: "已投递",
  ASSESSMENT: "笔试 / 测评",
  INTERVIEW: "面试中",
  OFFER: "Offer",
  REJECTED: "拒绝",
  ARCHIVED: "归档",
};

export const companySuggestions = [
  "字节跳动",
  "腾讯",
  "阿里巴巴",
  "美团",
  "百度",
  "京东",
  "小米",
  "网易",
  "快手",
  "哔哩哔哩",
  "拼多多",
  "蚂蚁集团",
  "华为",
  "携程",
  "小红书",
  "米哈游",
  "蔚来",
  "理想汽车",
  "小鹏汽车",
  "滴滴",
];

export const applicationSourceOptions = [
  "实习僧",
  "BOSS直聘",
  "猎聘",
  "智联招聘",
  "前程无忧",
  "企业官网",
  "内推",
  "邮件",
  "其他",
];

type VisiblePipelineStatus = (typeof visiblePipelineStatuses)[number];

type PipelineApplicationInput = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  nextFollowUpAt: string | null;
  appliedAt?: string | null;
  stageDate?: string | null;
};

type PipelineJobInput = {
  id: string;
  source: string;
  deadline: string | null;
};

type ApplicationTimelineInput = {
  status: ApplicationStatus;
  appliedAt: string | null;
  updatedAt?: string;
};

export type ApplicationTimelineItem = {
  key: string;
  status: ApplicationStatus;
  date: string | null;
  label: string;
  tone: "done" | "current" | "future" | "win" | "terminal";
};

export const interviewPipelineStatuses = ["INTERVIEW"] as const satisfies ApplicationStatus[];
export const activePipelineStatuses = ["APPLIED", "ASSESSMENT", ...interviewPipelineStatuses] as const satisfies ApplicationStatus[];

const applicationJourneyStatuses = ["APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER"] as const satisfies ApplicationStatus[];

export function chunkPipelineStatuses(size = 3): VisiblePipelineStatus[][] {
  const rows: VisiblePipelineStatus[][] = [];
  for (let index = 0; index < visiblePipelineStatuses.length; index += size) {
    rows.push(visiblePipelineStatuses.slice(index, index + size));
  }
  return rows;
}

export function isVisiblePipelineStatus(status: ApplicationStatus): status is VisiblePipelineStatus {
  return visiblePipelineStatuses.includes(status as VisiblePipelineStatus);
}

export function isActivePipelineStatus(status: ApplicationStatus) {
  return activePipelineStatuses.includes(status as (typeof activePipelineStatuses)[number]);
}

export function getApplicationDueDate(
  application: Pick<PipelineApplicationInput, "status" | "nextFollowUpAt" | "appliedAt" | "stageDate">,
  today = new Date(),
) {
  if (!isActivePipelineStatus(application.status)) return null;
  const dueDate = application.nextFollowUpAt ?? application.stageDate ?? defaultNextFollowUpDate(application.appliedAt ?? "");
  if (!dueDate) return null;
  return dateTime(dueDate) <= today.getTime() ? dueDate : null;
}

export function defaultNextFollowUpDate(appliedAt: string, days = 7) {
  if (!appliedAt) return "";
  const [year, month, day] = appliedAt.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function normalizeApplicationSource(source?: string) {
  const value = source?.trim();
  if (!value || value === "手动录入" || value === "官网" || value === "企业官网") return "企业官网";
  if (value === "Boss" || value === "BOSS" || value === "BOSS直聘") return "BOSS直聘";
  if (applicationSourceOptions.includes(value)) return value;
  return "其他";
}

export function normalizeApplicationPriority(value?: string | null): ApplicationPriority {
  return value === "HIGH" || value === "LOW" ? value : "NORMAL";
}

export function buildApplicationTimeline(input: ApplicationTimelineInput): ApplicationTimelineItem[] {
  const isTerminal = input.status === "REJECTED" || input.status === "ARCHIVED";
  const statuses: ApplicationStatus[] = isTerminal
    ? ["APPLIED", "ASSESSMENT", "INTERVIEW", input.status]
    : [...applicationJourneyStatuses];
  const currentIndex = applicationJourneyStatuses.indexOf(input.status as (typeof applicationJourneyStatuses)[number]);

  return statuses.map((status, index) => ({
    key: status,
    status,
    date: getTimelineStepDate(input, status),
    label: isVisiblePipelineStatus(status) ? pipelineStatusLabels[status] : "当前阶段",
    tone: getTimelineStepTone({
      status,
      index,
      currentIndex,
      terminalStatus: isTerminal ? input.status : null,
      hasAppliedDate: Boolean(input.appliedAt),
    }),
  }));
}

export function buildPipelineOverview(
  input: {
    jobs: PipelineJobInput[];
    applications: PipelineApplicationInput[];
  },
  today = new Date(),
) {
  const visibleApplications = input.applications.filter((application) =>
    isVisiblePipelineStatus(application.status),
  );
  const jobById = new Map(input.jobs.map((job) => [job.id, job]));
  const terminalStatuses = new Set<ApplicationStatus>(["OFFER", "REJECTED", "ARCHIVED"]);
  const total = visibleApplications.length;

  const statusCounts = visiblePipelineStatuses.map((status) => ({
    status,
    label: pipelineStatusLabels[status],
    count: visibleApplications.filter((application) => application.status === status).length,
  }));

  const sourceCountMap = new Map<string, number>();
  for (const application of visibleApplications) {
    const source = normalizeApplicationSource(jobById.get(application.jobId)?.source);
    sourceCountMap.set(source, (sourceCountMap.get(source) ?? 0) + 1);
  }

  const sourceCounts = Array.from(sourceCountMap.entries()).map(([source, count]) => ({ source, count }));
  const active = visibleApplications.filter((application) => isActivePipelineStatus(application.status)).length;
  const terminal = visibleApplications.filter((application) => terminalStatuses.has(application.status)).length;
  const interviewReachedStatuses = new Set<ApplicationStatus>([...interviewPipelineStatuses, "OFFER"]);
  const interviewCount = visibleApplications.filter((application) =>
    interviewReachedStatuses.has(application.status),
  ).length;
  const offerCount = visibleApplications.filter((application) => application.status === "OFFER").length;
  const followUpsDue = visibleApplications.filter((application) => getApplicationDueDate(application, today)).length;

  return {
    total,
    active,
    terminal,
    followUpsDue,
    interviewRate: total > 0 ? Math.round((interviewCount / total) * 100) : 0,
    offerRate: total > 0 ? Math.round((offerCount / total) * 100) : 0,
    statusCounts,
    sourceCounts,
  };
}

function dateTime(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function getTimelineStepDate(input: ApplicationTimelineInput, status: ApplicationStatus) {
  if (status === "APPLIED") return input.appliedAt;
  if (status === input.status) return input.updatedAt ?? null;
  return null;
}

function getTimelineStepTone({
  status,
  index,
  currentIndex,
  terminalStatus,
  hasAppliedDate,
}: {
  status: ApplicationStatus;
  index: number;
  currentIndex: number;
  terminalStatus: ApplicationStatus | null;
  hasAppliedDate: boolean;
}): ApplicationTimelineItem["tone"] {
  if (terminalStatus && status === terminalStatus) return "terminal";
  if (currentIndex === -1) return status === "APPLIED" && hasAppliedDate ? "done" : "future";
  if (index < currentIndex) return "done";
  if (index === currentIndex) return status === "OFFER" ? "win" : "current";
  return "future";
}
