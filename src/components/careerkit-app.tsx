"use client";

import type {
  ComponentProps,
  ComponentType,
  FormEvent,
  ReactNode,
} from "react";
import Image from "next/image";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  Archive,
  Bell,
  CalendarClock,
  ClipboardList,
  Edit3,
  FileCheck2,
  FileText,
  GripVertical,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Mic,
  Plus,
  Settings,
  Target,
  Trash2,
  WandSparkles,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { NavKey } from "@/lib/navigation";
import { navKeyFromPathname, pathnameForNavKey } from "@/lib/navigation";
import { hasResumeContent } from "@/lib/resume-library";
import {
  buildUploadedResumeDraft,
  isResumeContentLike,
  type UploadedResumeDraft,
} from "@/lib/resume-upload";
import { buildOptimizedResumeVersionName, normalizeOptimizedResumeVersionName } from "@/lib/resume-versioning";
import type { RedactedAiSettings } from "@/lib/ai/settings";
import {
  buildApplicationTimeline,
  buildPipelineOverview,
  chunkPipelineStatuses,
  applicationPriorityLabels,
  applicationPriorityOptions,
  applicationStatusDateLabels,
  applicationSourceOptions,
  companySuggestions,
  defaultNextFollowUpDate,
  interviewPipelineStatuses,
  normalizeApplicationPriority,
  normalizeApplicationSource,
  visiblePipelineStatuses,
} from "@/lib/pipeline";
import type { ApplicationTimelineItem } from "@/lib/pipeline";
import type { ApplicationPriority, ApplicationStatus, InterviewRound, JobAnalysis, ResumeContent } from "@/lib/types";
import type { InterviewSessionRecord } from "@/lib/interview-service";
import { cn } from "@/lib/utils";
import { ResumeWorkbench, type ResumeSaveTarget } from "@/components/resume-workbench";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { InterviewWorkspace } from "@/components/interview/interview-workspace";
import { AiSetupRequiredDialog, PreparationOptionCard, ResumeJdPreparation } from "@/components/resume-jd-preparation";
import { SpeechTextarea } from "@/components/speech-textarea";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { AiSettingsPanel } from "@/components/settings/ai-settings-panel";
import { ZoomableResumeCanvas } from "@/components/preview/zoomable-resume-canvas";
import { contentToJadeResume } from "@/lib/resume-adapter";
import { inferJobIdentity } from "@/lib/job-identity";
import { buildDashboardSummary } from "@/lib/dashboard";
import { AI_ROUTE_WARMUP_PATHS, warmAiRoutes } from "@/lib/ai-route-prewarm";

type JobView = {
  id: string;
  company: string;
  title: string;
  city: string;
  source: string;
  jd: string;
  link: string;
  deadline: string | null;
  tags: string[];
  analysis: JobAnalysis | null;
  createdAt: string;
};

type ApplicationView = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  interviewRound: InterviewRound;
  resumeVersionId: string | null;
  appliedAt: string | null;
  stageDate: string | null;
  priority: ApplicationPriority;
  nextFollowUpAt: string | null;
  notes: string;
  updatedAt: string;
};

type ResumeVersionView = {
  id: string;
  jobId: string | null;
  name: string;
  summary: string;
  content: ResumeContent;
  createdAt: string;
  updatedAt: string;
};

function resumeVersionDisplayName(version: ResumeVersionView, job?: JobView) {
  if (!version.jobId) return version.name;
  const baseResume = readTailoringBaseResume(version.content);
  return job && baseResume
    ? buildOptimizedResumeVersionName(baseResume, job.title)
    : normalizeOptimizedResumeVersionName(version.name);
}

type MatchOptimizationRequest = {
  jd: string;
  resumeVersionId?: string;
  resumeContent?: ResumeContent;
  preferences?: MatchOptimizationPreferences;
};

type MatchOptimizationPreferences = {
  emphasizeImpact: boolean;
  quantifyResults: boolean;
  atsFriendly: boolean;
  highlightMatchedSkills: boolean;
};

type MatchOptimizationResult = {
  job: JobView;
  application: ApplicationView;
  analysis?: JobAnalysis;
  version?: ResumeVersionView;
  message?: string;
};

type ResumeDiffSection = {
  key: string;
  title: string;
  previewTitles: string[];
  detail: string;
};

type FollowUpView = {
  id: string;
  applicationId: string;
  type: string;
  content: string;
  createdAt: string;
};

type InitialData = {
  resume: { id: string; name: string; content: ResumeContent; updatedAt: string } | null;
  versions: ResumeVersionView[];
  jobs: JobView[];
  applications: ApplicationView[];
  followUps: FollowUpView[];
  interviews: InterviewSessionRecord[];
  settings: {
    provider: string;
    model: string;
    baseUrl: string;
    ai: RedactedAiSettings;
    updatedAt: string;
  } | null;
};

type NavItem = { key: NavKey; label: string; icon: ComponentType<{ className?: string }> };
type HeaderMenuKey = "notifications" | "help" | "profile";
type ResumeMode = "library" | "editor";

const navItems: NavItem[] = [
  { key: "dashboard", label: "控制中心", icon: LayoutDashboard },
  { key: "resume", label: "简历编辑器", icon: FileText },
  { key: "match", label: "JD匹配优化", icon: Target },
  { key: "interview", label: "面试助手", icon: Mic },
  { key: "pipeline", label: "投递岗位跟进", icon: ClipboardList },
  { key: "settings", label: "设置", icon: Settings },
];

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: "求职流程", items: navItems.filter((item) => item.key !== "settings") },
  { label: "系统", items: navItems.filter((item) => item.key === "settings") },
];

const statusMeta: Record<
  ApplicationStatus,
  { label: string; icon: ComponentType<{ className?: string }>; className: string }
> = {
  READY: { label: "准备投递", icon: ClipboardList, className: "text-slate-600" },
  APPLIED: { label: "已投递", icon: FileCheck2, className: "text-primary" },
  ASSESSMENT: { label: "笔试 / 测评", icon: ListChecks, className: "text-amber-700" },
  INTERVIEW: { label: "面试中", icon: Mic, className: "text-blue-700" },
  OFFER: { label: "Offer", icon: Trophy, className: "text-emerald-700" },
  REJECTED: { label: "拒绝", icon: XCircle, className: "text-red-700" },
  ARCHIVED: { label: "归档", icon: Archive, className: "text-zinc-500" },
};

const pipelineStatuses = visiblePipelineStatuses;
const interviewRoundLabels: Record<Exclude<InterviewRound, "">, string> = {
  FIRST: "一面",
  SECOND: "二面",
  THIRD: "三面",
  HR: "HR 面",
};

const pipelineStageOptions = pipelineStatuses.flatMap((status) => {
  if (status !== "INTERVIEW") return [{ value: status, label: statusMeta[status].label }];
  return [
    { value: "INTERVIEW:FIRST", label: "一面" },
    { value: "INTERVIEW:SECOND", label: "二面" },
    { value: "INTERVIEW:THIRD", label: "三面" },
    { value: "INTERVIEW:HR", label: "HR 面" },
  ];
});

const pipelineChartColors = ["#7F9CBF", "#9CB69C", "#C3B1D0", "#D4A8A8", "#C4A484", "#AF6F3B"];

const defaultMatchPreferences: MatchOptimizationPreferences = {
  emphasizeImpact: true,
  quantifyResults: true,
  atsFriendly: true,
  highlightMatchedSkills: true,
};

export function CareerKitApp({
  initialData,
  initialView = "dashboard",
  initialResumeMode = "library",
  initialResumeVersionId,
}: {
  initialData: InitialData;
  initialView?: NavKey;
  initialResumeMode?: ResumeMode;
  initialResumeVersionId?: string;
}) {
  const [active, setActive] = useState<NavKey>(initialView);
  const [resumeMode, setResumeMode] = useState<ResumeMode>(initialResumeMode);
  const [resumeEditorVersionId, setResumeEditorVersionId] = useState(initialResumeVersionId);
  const [resume, setResume] = useState<ResumeContent>(initialData.resume?.content ?? emptyResume());
  const [resumeUpdatedAt, setResumeUpdatedAt] = useState(initialData.resume?.updatedAt ?? new Date().toISOString());
  const [jobs, setJobs] = useState(initialData.jobs);
  const [applications, setApplications] = useState(initialData.applications);
  const [versions, setVersions] = useState(initialData.versions);
  const [interviewSessions, setInterviewSessions] = useState(initialData.interviews);
  const [, setSelectedJobId] = useState(initialData.jobs[0]?.id ?? "");
  const [appSettings, setAppSettings] = useState(initialData.settings);
  const [aiSettings, setAiSettings] = useState<RedactedAiSettings | null>(initialData.settings?.ai ?? null);
  const [toast, setToast] = useState("准备就绪");
  const [headerMenu, setHeaderMenu] = useState<HeaderMenuKey | null>(null);
  const [optimizedMenuOpen, setOptimizedMenuOpen] = useState(false);
  const [interviewMenuOpen, setInterviewMenuOpen] = useState(false);
  const [pipelineAddOpen, setPipelineAddOpen] = useState(false);
  const [matchVersionId, setMatchVersionId] = useState<string | undefined>(readMatchVersionIdFromLocation());
  const [interviewSessionId, setInterviewSessionId] = useState<string | undefined>(readInterviewSessionIdFromLocation());
  const [matchResetKey, setMatchResetKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const optimizedVersions = useMemo(() => versions.filter((version) => version.jobId), [versions]);
  const dashboard = useMemo(
    () => buildDashboardSummary({ jobs, applications }),
    [applications, jobs],
  );
  const followUpReminders = useMemo(() => {
    const activeStatuses = new Set<ApplicationStatus>(["APPLIED", "ASSESSMENT", ...interviewPipelineStatuses]);
    const today = new Date();
    return applications
      .filter((application) => {
        if (!application.nextFollowUpAt || !activeStatuses.has(application.status)) return false;
        return new Date(application.nextFollowUpAt) <= today;
      })
      .map((application) => ({
        application,
        job: jobById.get(application.jobId),
      }))
      .filter((item) => item.job)
      .slice(0, 4);
  }, [applications, jobById]);

  useEffect(() => {
    const handlePopState = () => {
      const nextActive = navKeyFromPathname(window.location.pathname);
      setActive(nextActive);
      setResumeMode(window.location.pathname === "/resume/edit" ? "editor" : "library");
      setResumeEditorVersionId(readResumeVersionIdFromLocation());
      setMatchVersionId(readMatchVersionIdFromLocation());
      setInterviewSessionId(readInterviewSessionIdFromLocation());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || active !== "match") return;
    const frame = window.requestAnimationFrame(() => {
      setMatchVersionId(readMatchVersionIdFromLocation());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => {
    if (active === "match") {
      void warmAiRoutes([AI_ROUTE_WARMUP_PATHS.jobCreate, AI_ROUTE_WARMUP_PATHS.match]);
    } else if (active === "interview") {
      void warmAiRoutes([AI_ROUTE_WARMUP_PATHS.interview]);
    }
  }, [active]);

  const navigateTo = useCallback((key: NavKey) => {
    setActive(key);
    setResumeMode("library");
    if (key !== "resume") setResumeEditorVersionId(undefined);
    setMatchVersionId(undefined);
    setInterviewSessionId(undefined);
    setOptimizedMenuOpen(false);
    setInterviewMenuOpen(false);
    setPipelineAddOpen(false);
    const nextPath = pathnameForNavKey(key);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }, []);

  const openOptimizedVersionFromHeader = useCallback((versionId: string) => {
    setActive("match");
    setResumeMode("library");
    setResumeEditorVersionId(undefined);
    setMatchVersionId(versionId);
    setOptimizedMenuOpen(false);
    window.history.pushState(null, "", `/match?version=${encodeURIComponent(versionId)}`);
  }, []);

  const openResumeEditorFromMatch = useCallback((versionId?: string) => {
    setActive("resume");
    setResumeMode("editor");
    setResumeEditorVersionId(versionId);
    const nextPath = versionId ? `/resume/edit?version=${encodeURIComponent(versionId)}` : "/resume/edit";
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }, []);

  const openInterviewSessionFromHeader = useCallback((sessionId: string) => {
    setActive("interview");
    setResumeMode("library");
    setResumeEditorVersionId(undefined);
    setMatchVersionId(undefined);
    setInterviewSessionId(sessionId);
    setInterviewMenuOpen(false);
    window.history.pushState(null, "", `/interview?session=${encodeURIComponent(sessionId)}`);
  }, []);

  const upsertInterviewSession = useCallback((session: InterviewSessionRecord) => {
    setInterviewSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
  }, []);

  async function deleteInterviewSession(sessionId: string) {
    try {
      const response = await fetch(`/api/interviews/${sessionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("删除模拟面试失败。");
      setInterviewSessions((current) => current.filter((session) => session.id !== sessionId));
      if (interviewSessionId === sessionId) {
        setInterviewSessionId(undefined);
        window.history.pushState(null, "", "/interview");
      }
      setToast("模拟面试记录已删除。");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "删除模拟面试失败。");
    }
  }

  async function clearInterviewSessions() {
    if (!window.confirm(`清空 ${interviewSessions.length} 条模拟面试记录？此操作不可撤销。`)) return;
    try {
      const response = await fetch("/api/interviews", { method: "DELETE" });
      if (!response.ok) throw new Error("清空模拟面试失败。");
      setInterviewSessions([]);
      setInterviewMenuOpen(false);
      setInterviewSessionId(undefined);
      window.history.pushState(null, "", "/interview");
      setToast("已清空全部模拟面试记录。");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "清空模拟面试失败。");
    }
  }

  async function resetLocalDataToSample() {
    const result = (await postJson("/api/settings/reset-data", {})) as { data: InitialData };
    const nextData = result.data;
    setResume(nextData.resume?.content ?? emptyResume());
    setResumeUpdatedAt(nextData.resume?.updatedAt ?? new Date().toISOString());
    setJobs(nextData.jobs);
    setApplications(nextData.applications);
    setVersions(nextData.versions);
    setInterviewSessions(nextData.interviews);
    setAppSettings(nextData.settings);
    setAiSettings(nextData.settings?.ai ?? null);
    setResumeEditorVersionId(undefined);
    setMatchVersionId(undefined);
    setInterviewSessionId(undefined);
    setMatchResetKey((key) => key + 1);
    setToast("本地数据已清空，并恢复示例数据。");
    navigateTo("dashboard");
  }

  function resetMatchResultView() {
    setMatchVersionId(undefined);
    setMatchResetKey((current) => current + 1);
    if (window.location.pathname === "/match" || active === "match") {
      window.history.pushState(null, "", "/match");
    }
  }

  function resetMatchIfDeleted(deletedIds: Set<string>) {
    const currentVersionId = readMatchVersionIdFromLocation();
    if (currentVersionId && deletedIds.has(currentVersionId)) {
      resetMatchResultView();
    }
  }

  const isResumeEditor = active === "resume" && resumeMode === "editor";
  const pageTitle = active === "match" ? "JD匹配优化" : navItems.find((item) => item.key === active)?.label;
  const pageSubtitle =
    active === "match"
      ? "基于目标 JD 重新梳理简历重点，强化真实经历中的匹配证据，生成可继续编辑的专属版本。"
      : active === "pipeline"
        ? "记录投递渠道、当前阶段、面试轮次和跟进日期，把每个岗位从投递到 Offer 的进展集中管理。"
        : active === "interview"
          ? "结合所选简历与目标岗位生成模拟问题，完成逐题练习后获得结构化反馈与复盘建议。"
          : "简历到 Offer 的校招实习工作台";

  async function saveResume(contentOverride?: ResumeContent, target: ResumeSaveTarget = { kind: "main" }, name?: string) {
    const nextContent = contentOverride ?? resume;
    if (target.kind === "version") {
      const result = (await postJson(`/api/resume-versions/${target.id}`, { content: nextContent, name }, "PATCH")) as {
        version: ResumeVersionView;
      };
      setVersions((items) =>
        items.map((item) =>
          item.id === target.id
            ? {
                ...item,
                ...result.version,
                content: nextContent,
              }
            : item,
        ),
      );
      setToast("简历已保存到本地 SQLite。");
      return { kind: "version" as const, version: result.version };
    }

    if (target.kind === "new") {
      const result = (await postJson("/api/resume-versions", { content: nextContent, name }, "POST")) as {
        version: ResumeVersionView;
      };
      setVersions((items) => [result.version, ...items]);
      setToast("新简历已保存到本地 SQLite。");
      return { kind: "version" as const, version: result.version };
    }

    setResume(nextContent);
    const result = (await postJson("/api/resume", { content: nextContent })) as {
      resume: { updatedAt?: string };
    };
    setResumeUpdatedAt(result.resume.updatedAt ?? new Date().toISOString());
    setToast("原简历已保存到本地 SQLite。");
    return { kind: "main" as const };
  }

  function deleteMainResume() {
    const confirmed = window.confirm("删除这份原简历？删除后它会从简历库隐藏，你仍可新建其他简历。");
    if (!confirmed) return;
    const blank = emptyResume();
    setResume(blank);
    startTransition(async () => {
      const result = (await postJson("/api/resume", { content: blank })) as {
        resume: { updatedAt?: string };
      };
      setResumeUpdatedAt(result.resume.updatedAt ?? new Date().toISOString());
      setToast("原简历已删除。");
    });
  }

  function deleteResumeVersion(versionId: string) {
    const version = versions.find((item) => item.id === versionId);
    const confirmed = window.confirm(`删除「${version?.name || "这份简历"}」？`);
    if (!confirmed) return;
    const deletedIds = new Set([versionId]);

    startTransition(async () => {
      const response = await fetch(`/api/resume-versions/${versionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      setVersions((current) => current.filter((item) => item.id !== versionId));
      setApplications((current) =>
        current.map((application) =>
          application.resumeVersionId === versionId ? { ...application, resumeVersionId: null } : application,
        ),
      );
      resetMatchIfDeleted(deletedIds);
      setOptimizedMenuOpen(false);
      setToast("简历已删除。");
    });
  }

  function deleteOptimizedResumeVersions() {
    const optimizedIds = new Set(optimizedVersions.map((version) => version.id));
    if (!optimizedIds.size) return;
    const confirmed = window.confirm(`清空 ${optimizedIds.size} 个已优化版本？原简历会保留。`);
    if (!confirmed) return;

    startTransition(async () => {
      const response = await fetch("/api/resume-versions?scope=optimized", { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      const result = (await response.json()) as { deletedCount?: number };
      setVersions((current) => current.filter((version) => !optimizedIds.has(version.id)));
      setApplications((current) =>
        current.map((application) =>
          application.resumeVersionId && optimizedIds.has(application.resumeVersionId)
            ? { ...application, resumeVersionId: null }
            : application,
        ),
      );
      resetMatchIfDeleted(optimizedIds);
      setOptimizedMenuOpen(false);
      setToast(`已清空 ${result.deletedCount ?? optimizedIds.size} 个优化版本。`);
    });
  }

  function addJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const company = String(formData.get("company") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const jd = String(formData.get("jd") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const stage = parsePipelineStage(formData.get("applicationStage") ?? formData.get("applicationStatus"));
    const applicationStatus = stage.status;
    const interviewRound = stage.interviewRound;
    if (!company || !title) {
      setToast("公司和岗位名称都要填写。");
      return;
    }
    if (applicationStatus === "READY" && !jd) {
      setToast("JD匹配优化需要先填写目标 JD。");
      return;
    }

    startTransition(async () => {
      const result = (await postJson("/api/jobs", {
        company,
        title,
        city: String(formData.get("city") ?? "").trim() || "待填写",
        source: String(formData.get("source") ?? "").trim() || "企业官网",
        deadline: String(formData.get("deadline") ?? "") || null,
        link: String(formData.get("link") ?? ""),
        jd: jd || notes || `${company} ${title}，暂未补充完整 JD。`,
        applicationStatus,
        interviewRound,
        stageDate: String(formData.get("stageDate") ?? "") || null,
        priority: normalizeApplicationPriority(String(formData.get("priority") ?? "")),
        nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? "") || null,
        notes,
      })) as { job: JobView; application: ApplicationView };
      const job = normalizeJob(result.job);
      setJobs((current) => [job, ...current]);
      setApplications((current) => [normalizeApplication(result.application), ...current]);
      setSelectedJobId(job.id);
      setToast(applicationStatus === "APPLIED" ? "投递岗位已加入跟进。" : "岗位已加入匹配优化。");
      form.reset();
    });
  }

  async function runMatchOptimization(input: MatchOptimizationRequest): Promise<MatchOptimizationResult> {
    const jd = input.jd.trim();
    if (!jd) throw new Error("请先粘贴职位描述 / 任职要求。");
    if (!isAiReady(aiSettings)) throw new Error(aiReadinessMessage(aiSettings));

    const identity = inferJobIdentity(jd);
    const result = (await postJson("/api/jobs", {
      company: identity.company,
      title: identity.title,
      city: "待填写",
      source: "JD匹配优化",
      deadline: null,
      link: "",
      jd,
      applicationStatus: "READY",
      appliedAt: null,
      stageDate: null,
      priority: "NORMAL",
      nextFollowUpAt: null,
      notes: "来自 JD匹配优化流程。",
    })) as { job: JobView; application: ApplicationView };
    const job = normalizeJob(result.job);
    const application = normalizeApplication(result.application);

    setJobs((current) => [job, ...current]);
    setApplications((current) => [application, ...current]);
    setSelectedJobId(job.id);

    const tailored = (await postJson("/api/ai/resume-tailor", {
      jobId: job.id,
      applicationId: application.id,
      jd: `${identity.company} - ${identity.title}\n${jd}`,
      resumeVersionId: input.resumeVersionId,
      resumeContent: input.resumeContent,
      preferences: input.preferences,
    })) as { analysis: JobAnalysis; version: ResumeVersionView; source?: "ai" | "fallback"; message?: string };
    const version = normalizeVersion(tailored.version);

    setJobs((current) => current.map((item) => (item.id === job.id ? { ...item, analysis: tailored.analysis } : item)));
    setVersions((current) => [version, ...current]);
    setApplications((current) =>
      current.map((item) => (item.id === application.id ? { ...item, resumeVersionId: version.id } : item)),
    );
    setToast(tailored.message ?? `${identity.title} 的优化后简历已生成。`);

    return {
      job: { ...job, analysis: tailored.analysis },
      application: { ...application, resumeVersionId: version.id },
      analysis: tailored.analysis,
      version,
      message: tailored.message,
    };
  }

  function updatePipelineEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const jobId = String(formData.get("jobId") ?? "");
    const applicationId = String(formData.get("applicationId") ?? "");
    const company = String(formData.get("company") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const stage = parsePipelineStage(formData.get("stage") ?? formData.get("status"));
    if (!jobId || !applicationId || !company || !title) {
      setToast("公司和岗位名称都要填写。");
      return;
    }

    startTransition(async () => {
      try {
        const result = (await postJson(
          `/api/jobs/${jobId}`,
          {
            applicationId,
            company,
            title,
            source: String(formData.get("source") ?? "").trim() || "企业官网",
            link: String(formData.get("link") ?? "").trim(),
            jd: String(formData.get("jd") ?? "").trim() || `${company} ${title}，暂未补充完整 JD。`,
            status: stage.status,
            interviewRound: stage.interviewRound,
            stageDate: String(formData.get("stageDate") ?? "") || null,
            priority: normalizeApplicationPriority(String(formData.get("priority") ?? "")),
            nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? "") || null,
            notes: String(formData.get("notes") ?? "").trim(),
          },
          "PATCH",
        )) as { job: JobView; application: ApplicationView };

        const job = normalizeJob(result.job);
        const application = normalizeApplication(result.application);
        setJobs((current) => current.map((item) => (item.id === job.id ? job : item)));
        setApplications((current) =>
          current.map((item) => (item.id === application.id ? { ...item, ...application } : item)),
        );
        setToast(`${company} 的投递信息已更新。`);
      } catch (error) {
        setToast(`投递信息保存失败：${formatRequestError(error)}`);
      }
    });
  }

  function deletePipelineEntry(jobId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
        if (!response.ok) {
          const message = (await response.text()) || response.statusText || `HTTP ${response.status}`;
          throw new Error(message);
        }
        setApplications((current) => current.filter((application) => application.jobId !== jobId));
        setJobs((current) => current.filter((job) => job.id !== jobId));
        setToast("投递岗位已删除。");
      } catch (error) {
        setToast(`删除失败：${formatRequestError(error)}`);
      }
    });
  }

  function updateStatus(applicationId: string, status: ApplicationStatus) {
    startTransition(async () => {
      try {
        const result = (await postJson(`/api/applications/${applicationId}`, { status }, "PATCH")) as {
          application: ApplicationView;
        };
        setApplications((current) =>
          current.map((item) =>
            item.id === applicationId ? { ...item, ...normalizeApplication(result.application) } : item,
          ),
        );
        setToast(`状态已更新为「${statusMeta[status].label}」。`);
      } catch (error) {
        setToast(`状态更新失败：${formatRequestError(error)}`);
      }
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-line bg-surface-low px-4 py-6 lg:flex",
          isResumeEditor && "lg:hidden",
        )}
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="flex items-center justify-center gap-3">
            <Image src="/brand/lujie-mark.svg" alt="" width={44} height={44} className="shrink-0" priority />
            <p className="font-serif text-3xl font-semibold leading-none tracking-normal text-primary">录阶</p>
          </div>
          <p className="mt-2 text-[0.625rem] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            LuJie CareerKit
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-7">
          {navGroups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <p className="px-3 text-xs font-medium text-muted-foreground">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigateTo(item.key)}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition",
                      active === item.key
                        ? "bg-surface-high text-primary shadow-[inset_0_0_0_1px_var(--border)]"
                        : "text-foreground/80 hover:bg-surface-mid hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-line pt-5 text-xs leading-5 text-muted-foreground">
          <p>本地模式</p>
          <p>AI key 仅来自环境变量</p>
        </div>
      </aside>

      <header
        className={cn(
          "no-print sticky top-0 z-20 border-b border-line bg-background/85 px-4 py-3 backdrop-blur lg:ml-72 lg:px-8",
          isResumeEditor && "hidden",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex items-center gap-2">
              <Image src="/brand/lujie-mark.svg" alt="" width={28} height={28} className="shrink-0" priority />
              <span className="font-serif text-xl font-semibold text-primary">录阶</span>
            </div>
            <select
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              value={active}
              onChange={(event) => navigateTo(event.target.value as NavKey)}
            >
              {navItems.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden h-10 w-72 lg:block" aria-hidden />
          <div className="relative flex items-center gap-2 text-primary">
            <HeaderIconButton
              label="跟进提醒"
              active={headerMenu === "notifications"}
              onClick={() => setHeaderMenu((current) => (current === "notifications" ? null : "notifications"))}
            >
              <Bell className="h-5 w-5" />
              {followUpReminders.length > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-600" />
              )}
            </HeaderIconButton>
            <HeaderIconButton
              label="帮助入口"
              active={headerMenu === "help"}
              onClick={() => setHeaderMenu((current) => (current === "help" ? null : "help"))}
            >
              <HelpCircle className="h-5 w-5" />
            </HeaderIconButton>
            <button
              type="button"
              onClick={() => setHeaderMenu((current) => (current === "profile" ? null : "profile"))}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-semibold text-white transition hover:bg-primary/90",
                headerMenu === "profile" && "ring-2 ring-primary/20",
              )}
              aria-label="本地账户"
            >
              L
            </button>
            {headerMenu && (
              <HeaderMenuPanel
                menu={headerMenu}
                reminders={followUpReminders}
                dashboard={dashboard}
                resumeVersionCount={versions.length + (hasResumeContent(resume) ? 1 : 0)}
                provider={aiSettings?.aiProvider ?? "openai"}
                onNavigate={(key) => {
                  navigateTo(key);
                  setHeaderMenu(null);
                }}
                onClose={() => setHeaderMenu(null)}
              />
            )}
          </div>
        </div>
      </header>

      <main className={cn(!isResumeEditor && "lg:ml-72")}>
        <div
          className={cn(
            isResumeEditor
              ? "max-w-none px-0 py-0"
              : active === "pipeline"
                ? "px-4 py-8 lg:px-6"
                : "mx-auto max-w-7xl px-4 py-8 lg:px-10",
          )}
        >
          <div
            className={cn(
              "mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end",
              active === "resume" && "hidden",
              active === "pipeline" && "relative items-center text-center lg:block",
            )}
          >
            <div className={cn(active === "pipeline" && "mx-auto text-center")}>
              <h1 className="font-serif text-2xl font-semibold tracking-normal lg:text-3xl">
                {pageTitle}
              </h1>
              <p
                className={cn(
                  "mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground",
                  active === "pipeline" && "mx-auto max-w-2xl",
                )}
              >
                {pageSubtitle}
              </p>
            </div>
            <div className={cn("flex items-center gap-2", active === "pipeline" && "justify-center lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2")}>
              {active === "pipeline" ? (
                <button
                  type="button"
                  onClick={() => setPipelineAddOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_rgba(49,48,48,0.12)] hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  新增投递岗位
                </button>
              ) : isPending || toast !== "准备就绪" ? (
                <div className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted-foreground">
                  {isPending ? "正在处理..." : toast}
                </div>
              ) : null}
              {active === "match" && optimizedVersions.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOptimizedMenuOpen((current) => !current)}
                    className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-low"
                  >
                    已优化版本 · {optimizedVersions.length}
                  </button>
                  {optimizedMenuOpen && (
                    <div className="absolute right-0 top-11 z-30 w-80 rounded-lg border border-line bg-surface p-2 shadow-[0_18px_60px_rgba(15,23,42,0.14)]">
                      <div className="px-2 pb-2 pt-1 text-xs text-muted-foreground">选择一个历史优化结果继续查看</div>
                      <div className="max-h-80 overflow-y-auto">
                        {optimizedVersions.map((version) => {
                          const job = jobById.get(version.jobId ?? "");
                          const versionLabel = resumeVersionDisplayName(version, job);
                          return (
                            <div
                              key={version.id}
                              className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-surface-low"
                            >
                              <button
                                type="button"
                                onClick={() => openOptimizedVersionFromHeader(version.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className="block truncate text-sm font-semibold text-foreground">
                                  {versionLabel}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {new Date(version.updatedAt).toLocaleDateString("zh-CN")}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteResumeVersion(version.id)}
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-white text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                aria-label={`删除${versionLabel}优化版本`}
                                title="删除优化版本"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={deleteOptimizedResumeVersions}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        清空全部优化版本
                      </button>
                    </div>
                  )}
                </div>
              )}
              {active === "interview" && interviewSessions.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setInterviewMenuOpen((current) => !current)}
                    className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-low"
                  >
                    已模拟面试 · {interviewSessions.length}
                  </button>
                  {interviewMenuOpen && (
                    <div className="absolute right-0 top-11 z-30 w-80 rounded-lg border border-line bg-surface p-2 shadow-[0_18px_60px_rgba(15,23,42,0.14)]">
                      <div className="px-2 pt-1 pb-2 text-xs text-muted-foreground">继续未完成练习，或查看已保存的复盘报告</div>
                      <div className="max-h-80 overflow-y-auto">
                        {interviewSessions.map((session) => (
                          <div key={session.id} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-surface-low">
                            <button type="button" onClick={() => openInterviewSessionFromHeader(session.id)} className="min-w-0 flex-1 text-left">
                              <span className="block truncate text-sm font-semibold text-foreground">{session.context.company} · {session.context.title}</span>
                              <span className="mt-1 block text-xs text-muted-foreground">{new Date(session.updatedAt).toLocaleDateString("zh-CN")} · {session.status === "COMPLETED" ? "已复盘" : "进行中"}</span>
                            </button>
                            <button type="button" onClick={() => void deleteInterviewSession(session.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-white text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`删除${session.context.company}${session.context.title}模拟面试`} title="删除模拟面试">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => void clearInterviewSessions()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">
                        <Trash2 className="h-3.5 w-3.5" />清空全部模拟面试
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {active === "dashboard" && (
            <DashboardWorkspace
              summary={dashboard}
              onNavigate={navigateTo}
              onAddApplication={() => {
                navigateTo("pipeline");
                setPipelineAddOpen(true);
              }}
            />
          )}
          {active === "resume" && (
            <ResumeWorkbench
              key={resumeEditorVersionId ?? "main-resume"}
              resume={resume}
              resumeUpdatedAt={resumeUpdatedAt}
              setResume={setResume}
              saveResume={saveResume}
                versions={versions}
                initialResumeVersionId={resumeEditorVersionId}
                mode={resumeMode}
                onModeChange={setResumeMode}
              onOpenMatch={() => navigateTo("match")}
              onDeleteMainResume={deleteMainResume}
              onDeleteVersion={deleteResumeVersion}
            />
          )}
          {active === "match" && (
            <MatchView
              key={`${matchResetKey}:${matchVersionId ?? "input"}`}
              resume={resume}
              versions={versions}
              jobs={jobs}
              applications={applications}
              targetVersionId={matchVersionId}
              runMatchOptimization={runMatchOptimization}
              onOpenResume={openResumeEditorFromMatch}
              aiSettings={aiSettings}
              onOpenSettings={() => navigateTo("settings")}
            />
          )}
          {active === "pipeline" && (
            <PipelineView
              jobs={jobs}
              applications={applications}
              versions={versions}
              updatePipelineEntry={updatePipelineEntry}
              deletePipelineEntry={deletePipelineEntry}
              updateStatus={updateStatus}
            />
          )}
          {active === "interview" && (
            <InterviewWorkspace
              key={interviewSessionId ?? "setup"}
              versions={versions}
              resume={resume}
              mainResumeName={initialData.resume?.name ?? resumeDisplayName(resume, "原简历")}
              targetSessionId={interviewSessionId}
              onSessionUpsert={upsertInterviewSession}
              onOpenResume={openResumeEditorFromMatch}
              aiReady={isAiReady(aiSettings)}
              aiMessage={aiReadinessMessage(aiSettings)}
              onOpenSettings={() => navigateTo("settings")}
              onStatus={setToast}
            />
          )}
          {active === "settings" && (
            <SettingsView
              settings={appSettings}
              aiSettings={aiSettings}
              onAiSettingsChange={setAiSettings}
              onResetData={resetLocalDataToSample}
              onStatus={setToast}
            />
          )}
        </div>
      </main>
      <AddApplicationDialog
        open={active === "pipeline" && pipelineAddOpen}
        addJob={addJob}
        onOpenChange={setPipelineAddOpen}
      />
    </div>
  );
}

function HeaderIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative grid h-8 w-8 place-items-center rounded-lg transition hover:bg-surface-low",
        active && "bg-surface-low shadow-[inset_0_0_0_1px_var(--border)]",
      )}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function HeaderMenuPanel({
  menu,
  reminders,
  dashboard,
  resumeVersionCount,
  provider,
  onNavigate,
  onClose,
}: {
  menu: HeaderMenuKey;
  reminders: Array<{ application: ApplicationView; job?: JobView }>;
  dashboard: ReturnType<typeof buildDashboardSummary>;
  resumeVersionCount: number;
  provider: string;
  onNavigate: (key: NavKey) => void;
  onClose: () => void;
}) {
  return (
    <section className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-line bg-surface p-4 text-left text-sm text-foreground shadow-[0_18px_60px_rgba(49,48,48,0.14)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold">
          {menu === "notifications" ? "跟进提醒" : menu === "help" ? "快捷入口" : "本地账户"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-surface-low hover:text-foreground"
          aria-label="关闭菜单"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {menu === "notifications" && (
        <div className="space-y-3">
          {reminders.length > 0 ? (
            reminders.map(({ application, job }) => (
              <div key={application.id} className="rounded-lg bg-surface-low p-3">
                <p className="font-medium">{job?.company ?? "未知公司"} · {job?.title ?? "未知岗位"}</p>
                <p className="mt-1 text-xs text-muted-foreground">跟进日期：{application.nextFollowUpAt}</p>
              </div>
            ))
          ) : (
            <p className="rounded-lg bg-surface-low p-3 text-muted-foreground">暂无到期跟进岗位。</p>
          )}
          <button
            type="button"
            onClick={() => onNavigate("pipeline")}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            查看投递跟进
          </button>
        </div>
      )}

      {menu === "help" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onNavigate("resume")}
            className="w-full rounded-lg bg-surface-low px-3 py-2 text-left font-medium hover:bg-surface-mid"
          >
            打开简历编辑器
          </button>
          <button
            type="button"
            onClick={() => onNavigate("match")}
            className="w-full rounded-lg bg-surface-low px-3 py-2 text-left font-medium hover:bg-surface-mid"
          >
            进入 JD匹配优化
          </button>
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="w-full rounded-lg bg-surface-low px-3 py-2 text-left font-medium hover:bg-surface-mid"
          >
            检查本地设置
          </button>
        </div>
      )}

      {menu === "profile" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-low p-3">
              <p className="text-xs text-muted-foreground">跟进岗位</p>
              <p className="mt-1 text-lg font-semibold">{dashboard.metrics.followUpsDue}</p>
            </div>
            <div className="rounded-lg bg-surface-low p-3">
              <p className="text-xs text-muted-foreground">简历版本</p>
              <p className="mt-1 text-lg font-semibold">{resumeVersionCount}</p>
            </div>
          </div>
          <div className="rounded-lg bg-surface-low p-3 text-xs leading-5 text-muted-foreground">
            <p>模式：本地单用户</p>
            <p>Provider：{provider}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            回到控制中心
          </button>
        </div>
      )}
    </section>
  );
}

function MatchView({
  resume,
  versions,
  jobs,
  applications,
  targetVersionId,
  runMatchOptimization,
  onOpenResume,
  aiSettings,
  onOpenSettings,
}: {
  resume: ResumeContent;
  versions: ResumeVersionView[];
  jobs: JobView[];
  applications: ApplicationView[];
  targetVersionId?: string;
  runMatchOptimization: (input: MatchOptimizationRequest) => Promise<MatchOptimizationResult>;
  onOpenResume: (versionId?: string) => void;
  aiSettings: RedactedAiSettings | null;
  onOpenSettings: () => void;
}) {
  const aiReady = isAiReady(aiSettings);
  const aiMessage = aiReadinessMessage(aiSettings);
  const [resumeSource, setResumeSource] = useState<"library" | "upload">("library");
  const [selectedResumeKey, setSelectedResumeKey] = useState("main");
  const [uploadedResume, setUploadedResume] = useState<UploadedResumeDraft | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [jdDraft, setJdDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [screen, setScreen] = useState<"input" | "result">("input");
  const [result, setResult] = useState<MatchOptimizationResult | null>(null);
  const [resultBaseResume, setResultBaseResume] = useState<ResumeContent | null>(null);
  const [optimizedDraft, setOptimizedDraft] = useState<ResumeContent | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [aiSetupDialogOpen, setAiSetupDialogOpen] = useState(false);
  const [preferences, setPreferences] = useState<MatchOptimizationPreferences>(defaultMatchPreferences);

  const resumeOptions = useMemo(() => {
    const options: Array<{ id: string; name: string; detail: string }> = [];
    if (hasResumeContent(resume)) {
      options.push({
        id: "main",
        name: resumeDisplayName(resume, "原简历"),
        detail: `原简历 · ${resume.skills.length} 项技能 · ${resume.projects.length} 个项目`,
      });
    }

    for (const version of versions) {
      const job = version.jobId ? jobs.find((item) => item.id === version.jobId) : undefined;
      options.push({
        id: version.id,
        name: resumeVersionDisplayName(version, job),
        detail: `${version.jobId ? "优化后简历" : "原简历"} · ${new Date(version.updatedAt).toLocaleDateString("zh-CN")}`,
      });
    }

    return options;
  }, [jobs, resume, versions]);
  const selectedResumeOption = resumeOptions.find((item) => item.id === selectedResumeKey) ?? resumeOptions[0];
  const selectedLibraryKey = selectedResumeOption?.id;
  const selectedVersion = versions.find((version) => version.id === selectedLibraryKey);
  const selectedBaseResume =
    resumeSource === "upload"
      ? uploadedResume?.content
      : selectedLibraryKey === "main"
        ? resume
        : selectedVersion?.content;
  const selectedResumeRequest =
    resumeSource === "upload"
      ? { resumeContent: uploadedResume?.content }
      : { resumeVersionId: selectedLibraryKey && selectedLibraryKey !== "main" ? selectedLibraryKey : undefined };
  const resumeReady = resumeSource === "upload" ? Boolean(uploadedResume) : Boolean(selectedBaseResume);
  const canOptimize = resumeReady && Boolean(jdDraft.trim()) && !isGenerating && !isUploadingResume;
  const currentBaseLabel =
    resumeSource === "upload" ? uploadedResume?.fileName ?? "等待上传文件" : selectedResumeOption?.name ?? "请选择简历";

  useEffect(() => {
    if (resumeSource !== "library") return undefined;
    if (!resumeOptions.length) return undefined;
    if (resumeOptions.some((option) => option.id === selectedResumeKey)) return undefined;

    const frame = window.requestAnimationFrame(() => {
      setSelectedResumeKey(resumeOptions[0].id);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resumeOptions, resumeSource, selectedResumeKey]);

  async function handleUploadFile(file: File) {
    setUploadError("");
    setIsUploadingResume(true);
    setSaveStatus("正在解析简历，可能需要一些时间...");
    try {
      const draft = await buildUploadedResumeDraft(file);
      setUploadedResume(draft);
      setResumeSource("upload");
      setSaveStatus(`简历解析已完成，已导入 ${draft.fileName}。`);
    } catch (error) {
      setUploadedResume(null);
      setUploadError(error instanceof Error ? error.message : "文件读取失败。");
      setSaveStatus("");
    } finally {
      setIsUploadingResume(false);
    }
  }

  function togglePreference(key: keyof MatchOptimizationPreferences) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  const openOptimizedVersion = useCallback(
    (versionId: string, options?: { replace?: boolean }) => {
      const version = versions.find((item) => item.id === versionId);
      if (!version) {
        if (options?.replace) window.history.replaceState(null, "", "/match");
        return false;
      }

      const job = jobs.find((item) => item.id === version.jobId) ?? buildSyntheticJobForVersion(version);
      const application =
        applications.find((item) => item.resumeVersionId === version.id || item.jobId === job.id) ??
        buildSyntheticApplicationForVersion(version, job.id);

      setResult({
        job,
        application,
        analysis: job.analysis ?? undefined,
        version,
        message: "已打开本地优化版本。",
      });
      setResultBaseResume(readTailoringBaseResume(version.content) ?? resume);
      setOptimizedDraft(version.content);
      setSelectedResumeKey(version.id);
      setResumeSource("library");
      setScreen("result");
      setSaveStatus("");

      const nextUrl = `/match?version=${encodeURIComponent(version.id)}`;
      if (window.location.pathname + window.location.search !== nextUrl) {
        if (options?.replace) window.history.replaceState(null, "", nextUrl);
        else window.history.pushState(null, "", nextUrl);
      }
      return true;
    },
    [applications, jobs, resume, versions],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const versionId = targetVersionId ?? new URLSearchParams(window.location.search).get("version");
    if (!versionId) return;
    const frame = window.requestAnimationFrame(() => {
      const opened = openOptimizedVersion(versionId, { replace: true });
      if (!opened) {
        setScreen("input");
        setResult(null);
        setResultBaseResume(null);
        setOptimizedDraft(null);
        setSaveStatus("");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openOptimizedVersion, targetVersionId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resumeReady || !selectedBaseResume) {
      setSaveStatus("请先选择或上传一份简历。");
      return;
    }

    if (!jdDraft.trim()) {
      setSaveStatus("请先粘贴职位描述。");
      return;
    }

    if (!aiReady) {
      setAiSetupDialogOpen(true);
      return;
    }

    setIsGenerating(true);
    setSaveStatus("正在分析 JD 并生成优化简历...");
    try {
      const nextResult = await runMatchOptimization({
        jd: jdDraft,
        resumeVersionId: selectedResumeRequest.resumeVersionId,
        resumeContent: selectedResumeRequest.resumeContent,
        preferences,
      });

      if (nextResult.version) {
        setResult(nextResult);
        setResultBaseResume(selectedBaseResume);
        setOptimizedDraft(nextResult.version.content);
        setScreen("result");
        setSaveStatus("优化结果已生成，右侧高亮区域可继续修改。");
        window.history.replaceState(null, "", `/match?version=${encodeURIComponent(nextResult.version.id)}`);
      }
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "匹配优化失败，请稍后再试。");
    } finally {
      setIsGenerating(false);
    }
  }

  if (screen === "result" && result?.version && resultBaseResume && optimizedDraft) {
    const summaryItems = buildOptimizationSummary(resultBaseResume, optimizedDraft, result.analysis);
    const diffSections = buildResumeDiffSections(resultBaseResume, optimizedDraft);

    return (
      <div className="space-y-5">
        <WorkflowStepper labels={["选择简历与 JD", "AI 匹配优化", "预览并编辑"]} current={2} />
        <section className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(49,48,48,0.05)] lg:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-sm font-medium text-primary">优化结果总结</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold">
                {result.job.company} · {result.job.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                已基于职位描述重新组织简历重点。右侧简历中浅黄色区域为本次优化产生或调整的模块，可以进入编辑器继续微调。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setScreen("input");
                  setResult(null);
                  setResultBaseResume(null);
                  setOptimizedDraft(null);
                  setSaveStatus("");
                  window.history.pushState(null, "", "/match");
                }}
                className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-low"
              >
                返回修改 JD
              </button>
              <button
                type="button"
                onClick={() => onOpenResume(result.version?.id)}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white"
              >
                进入编辑器修改
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-lg bg-surface-low px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid items-stretch gap-5 xl:grid-cols-2">
          <ResumeDocumentComparePane
            title="原简历"
            subtitle={resumeDisplayName(resultBaseResume, "未命名简历")}
            resume={resultBaseResume}
          />
          <ResumeDocumentComparePane
            title="优化后"
            subtitle="已生成优化后简历，可进入编辑器继续微调。"
            resume={optimizedDraft}
            optimized
            changedSections={diffSections}
            action={
              <button
                type="button"
                onClick={() => onOpenResume(result.version?.id)}
                aria-label="进入编辑器修改优化后简历"
                title="进入编辑器修改"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-primary hover:bg-primary-soft"
              >
                <FileText className="h-5 w-5" />
              </button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <WorkflowStepper
        labels={["选择简历与 JD", "AI 匹配优化", "预览并编辑"]}
        current={isGenerating ? 1 : 0}
      />
      <form onSubmit={handleSubmit}>
        <ResumeJdPreparation
          resumePicker={{
            description: `选择一份作为优化基准 · 共 ${resumeOptions.length} 份`,
            source: resumeSource,
            selectedId: selectedLibraryKey,
            options: resumeOptions,
            uploadedResume,
            uploadError,
            isUploading: isUploadingResume,
            onSourceChange: setResumeSource,
            onSelect: setSelectedResumeKey,
            onUploadFile: (file) => void handleUploadFile(file),
            onOpenResume: (id) => onOpenResume(id === "main" ? undefined : id),
          }}
          title="填写目标 JD"
          description="粘贴完整的岗位职责、任职要求与加分项，录阶会结合所选简历提炼重点并生成匹配版本。"
          jdLabel="职位描述 / 任职要求 / 加分项 *"
          jdValue={jdDraft}
          onJdChange={setJdDraft}
          jdPlaceholder="粘贴目标 JD，建议包含岗位职责、任职要求、加分项与业务方向..."
          settingsTitle="优化设置"
          settingsDescription="选择本次改写侧重点；所有内容都以原简历事实为边界，不新增不存在的经历或数据。"
          onJdImportStatus={setSaveStatus}
          settings={
            <div className="grid gap-4 md:grid-cols-2">
              <PreparationOptionCard checked={preferences.emphasizeImpact} icon={ListChecks} label="强调项目成果" description="优先突出项目职责与结果证据" onChange={() => togglePreference("emphasizeImpact")} />
              <PreparationOptionCard checked={preferences.quantifyResults} icon={Edit3} label="补充量化表达" description="只重写已有结果，不编造数字" onChange={() => togglePreference("quantifyResults")} />
              <PreparationOptionCard checked={preferences.atsFriendly} icon={FileCheck2} label="ATS 友好" description="优化关键词与格式，通过初筛" onChange={() => togglePreference("atsFriendly")} />
              <PreparationOptionCard checked={preferences.highlightMatchedSkills} icon={Target} label="突出匹配技能" description="优先展示与 JD 对齐的技能" onChange={() => togglePreference("highlightMatchedSkills")} />
            </div>
          }
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                当前基准：{currentBaseLabel}
                {resumeSource === "library" && selectedLibraryKey ? <button type="button" onClick={() => onOpenResume(selectedLibraryKey === "main" ? undefined : selectedLibraryKey)} className="ml-2 font-medium text-primary hover:text-primary/80">修改</button> : null}
              </p>
              <div className="flex gap-3">
                <button type="submit" disabled={!canOptimize} className={cn("flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white", !canOptimize && "cursor-not-allowed opacity-55")} title={canOptimize ? undefined : resumeReady ? "请先粘贴职位描述。" : "请先选择或上传简历。"}>
                  <WandSparkles className="h-4 w-4" />{isGenerating ? "正在生成..." : "开始 JD匹配优化"}
                </button>
              </div>
            </div>
          }
          notice={
            <>
              {saveStatus ? <p className="px-5 pb-4 text-sm text-muted-foreground lg:px-6">{saveStatus}</p> : null}
            </>
          }
        />
      </form>
      <AiSetupRequiredDialog
        open={aiSetupDialogOpen}
        message={aiMessage}
        onOpenChange={setAiSetupDialogOpen}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}

function isNearlyWhiteCssColor(color: string) {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return false;
  const values = match[1]
    .split(",")
    .map((part) => Number(part.trim()));
  const [red, green, blue] = values;
  const alpha = values[3] ?? 1;
  return alpha > 0.45 && red >= 235 && green >= 235 && blue >= 235;
}

function resetHighlightedReadableText(root: HTMLElement) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-match-readable-text='true']"));
  for (const node of nodes) {
    node.style.color = "";
    node.removeAttribute("data-match-readable-text");
  }
}

function makeHighlightedTextReadable(section: HTMLElement) {
  const nodes = Array.from(section.querySelectorAll<HTMLElement>("h1,h2,h3,p,span,li,strong,em,div"));
  for (const node of nodes) {
    if (!node.textContent?.trim()) continue;
    if (!isNearlyWhiteCssColor(window.getComputedStyle(node).color)) continue;
    node.style.color = "#111827";
    node.setAttribute("data-match-readable-text", "true");
  }
}

function ResumeDocumentComparePane({
  title,
  subtitle,
  resume,
  optimized,
  changedSections = [],
  action,
}: {
  title: string;
  subtitle: string;
  resume: ResumeContent;
  optimized?: boolean;
  changedSections?: ResumeDiffSection[];
  action?: ReactNode;
}) {
  const previewRootRef = useRef<HTMLDivElement>(null);
  const previewResume = useMemo(() => contentToJadeResume(resume), [resume]);
  const [canvasZoom, setCanvasZoom] = useState(68);
  const changedPreviewTitles = useMemo(
    () => new Set(changedSections.flatMap((section) => section.previewTitles.map(normalizeDiffText))),
    [changedSections],
  );

  useLayoutEffect(() => {
    const root = previewRootRef.current;
    if (!root || !optimized) return undefined;

    const applyHighlights = () => {
      resetHighlightedReadableText(root);
      const sectionNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-section]"));
      for (const section of sectionNodes) {
        section.style.outline = "";
        section.style.background = "";
        section.style.borderRadius = "";
        section.style.boxShadow = "";
      }

      const headerNodes = Array.from(root.querySelectorAll<HTMLElement>("h1"));
      for (const node of headerNodes) {
        node.style.background = "";
        node.style.boxShadow = "";
        node.style.borderRadius = "";
      }

      if (!changedPreviewTitles.size) return;

      for (const section of sectionNodes) {
        const heading = normalizeDiffText(section.querySelector("h2")?.textContent ?? "");
        if (!changedPreviewTitles.has(heading)) continue;
        section.style.outline = "1px solid rgba(245, 158, 11, 0.32)";
        section.style.background = "rgba(255, 251, 235, 0.72)";
        section.style.borderRadius = "10px";
        section.style.boxShadow = "0 0 0 5px rgba(255, 251, 235, 0.64)";
        makeHighlightedTextReadable(section);
      }

    };

    applyHighlights();
    const frame = window.requestAnimationFrame(applyHighlights);
    const timers = [120, 400, 1000].map((delay) => window.setTimeout(applyHighlights, delay));
    const observer = new MutationObserver(applyHighlights);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      resetHighlightedReadableText(root);
    };
  }, [changedPreviewTitles, optimized, previewResume]);

  return (
    <section
      className="flex h-[820px] min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_18px_50px_rgba(49,48,48,0.04)]"
    >
      <div className="relative flex min-h-[76px] items-center justify-center border-b border-line px-14 py-4">
        <div className="min-w-0 text-center">
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          <p className="sr-only">{subtitle}</p>
        </div>
        <div className="absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {action ?? <FileText className="h-5 w-5 shrink-0 text-primary" />}
        </div>
      </div>
      <ZoomableResumeCanvas
        resume={previewResume}
        zoom={canvasZoom}
        onZoomChange={setCanvasZoom}
        smartOnePage={false}
        previewRootRef={previewRootRef}
        initialZoom={68}
        minZoom={30}
        maxZoom={160}
      />
    </section>
  );
}

function resumeDisplayName(resume: ResumeContent, fallback: string) {
  const name = resume.basics.name.trim();
  if (!name) return fallback;
  return name.includes("简历") ? name : `${name}的简历`;
}

function readTailoringBaseResume(content: ResumeContent) {
  const maybeBase = (content as ResumeContent & { _tailoringBaseResume?: unknown })._tailoringBaseResume;
  return isResumeContentLike(maybeBase) ? maybeBase : null;
}

function buildResumeDiffSections(before: ResumeContent, after: ResumeContent): ResumeDiffSection[] {
  const diffs: ResumeDiffSection[] = [];

  if (
    before.basics.name !== after.basics.name ||
    before.basics.email !== after.basics.email ||
    before.basics.phone !== after.basics.phone ||
    before.basics.city !== after.basics.city ||
    stringifyForDiff(before.basics.links) !== stringifyForDiff(after.basics.links) ||
    before.profile.title !== after.profile.title
  ) {
    diffs.push({
      key: "header",
      title: "顶部信息",
      previewTitles: ["顶部信息"],
      detail: "姓名、联系方式、城市、链接或求职方向发生变化。",
    });
  }

  if (before.profile.summary !== after.profile.summary || before.selfReview !== after.selfReview) {
    diffs.push({
      key: "summary",
      title: "自我评价",
      previewTitles: ["自我评价", "求职摘要"],
      detail: "求职摘要或自我评价经过岗位化改写。",
    });
  }

  if (stringifyForDiff(before.education) !== stringifyForDiff(after.education)) {
    diffs.push({
      key: "education",
      title: "教育背景",
      previewTitles: ["教育背景"],
      detail: "教育经历内容发生调整。",
    });
  }

  if (stringifyForDiff(before.experiences) !== stringifyForDiff(after.experiences)) {
    diffs.push({
      key: "experiences",
      title: "工作经历",
      previewTitles: ["工作经历"],
      detail: "工作经历表达或排序发生调整。",
    });
  }

  if (stringifyForDiff(before.internships) !== stringifyForDiff(after.internships)) {
    diffs.push({
      key: "internships",
      title: "实习经历",
      previewTitles: ["实习经历"],
      detail: "实习经历表达或排序发生调整。",
    });
  }

  if (stringifyForDiff(before.projects) !== stringifyForDiff(after.projects)) {
    diffs.push({
      key: "projects",
      title: "项目经历",
      previewTitles: ["项目经历"],
      detail: "项目经历的职责、行动或结果表达发生调整。",
    });
  }

  if (stringifyForDiff(before.awards) !== stringifyForDiff(after.awards)) {
    diffs.push({
      key: "awards",
      title: "资格证书",
      previewTitles: ["资格证书", "奖项证书"],
      detail: "奖项或证书内容发生调整。",
    });
  }

  if (stringifyForDiff(before.skills) !== stringifyForDiff(after.skills)) {
    diffs.push({
      key: "skills",
      title: "技能特长",
      previewTitles: ["技能特长", "核心技能"],
      detail: "技能顺序或关键词覆盖发生调整。",
    });
  }

  return diffs;
}

function stringifyForDiff(value: unknown) {
  return JSON.stringify(value);
}

function normalizeDiffText(value: string) {
  return value.replace(/\s+/g, "").replace(/[：:]/g, "");
}

function buildOptimizationSummary(before: ResumeContent, after: ResumeContent, analysis?: JobAnalysis) {
  const changedSections = [
    before.profile.summary !== after.profile.summary ? "求职摘要" : "",
    before.skills.join("\n") !== after.skills.join("\n") ? "核心技能" : "",
    JSON.stringify(before.projects) !== JSON.stringify(after.projects) ? "项目经历" : "",
    JSON.stringify(before.internships) !== JSON.stringify(after.internships) ? "实习经历" : "",
  ].filter(Boolean);
  const keywordText = analysis?.keywords?.slice(0, 5).join("、") || "岗位关键词";

  return [
    {
      label: "岗位关键词",
      value: keywordText,
    },
    {
      label: "调整范围",
      value: changedSections.length ? changedSections.join("、") : "保留原结构，仅调整表达重点。",
    },
    {
      label: "事实边界",
      value: "只重排和改写原简历已有事实，不新增经历或数据。",
    },
  ];
}

function PipelineView({
  jobs,
  applications,
  versions,
  updatePipelineEntry,
  deletePipelineEntry,
  updateStatus,
}: {
  jobs: JobView[];
  applications: ApplicationView[];
  versions: ResumeVersionView[];
  updatePipelineEntry: (event: FormEvent<HTMLFormElement>) => void;
  deletePipelineEntry: (jobId: string) => void;
  updateStatus: (applicationId: string, status: ApplicationStatus) => void;
}) {
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const overview = useMemo(
    () =>
      buildPipelineOverview({
        jobs,
        applications,
      }),
    [applications, jobs],
  );
  const applicationsByStatus = useMemo(() => {
    const grouped = new Map<ApplicationStatus, ApplicationView[]>(
      pipelineStatuses.map((status) => [status, [] as ApplicationView[]]),
    );
    for (const application of applications) {
      if (isPipelineStatus(application.status)) grouped.get(application.status)?.push(application);
    }
    return grouped;
  }, [applications]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const editingApplication = applications.find((application) => application.id === editingApplicationId);
  const editingJob = editingApplication ? jobById.get(editingApplication.jobId) : undefined;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <div className="space-y-5">
      <PipelineOverview overview={overview} />

      <DndContext
        id="pipeline-board-dnd"
        sensors={sensors}
        modifiers={[restrictToWindowEdges]}
        onDragStart={(event) => setDraggedId(String(event.active.id))}
        onDragEnd={(event: DragEndEvent) => {
          const applicationId = String(event.active.id);
          const nextStatus = event.over?.id;
          if (typeof nextStatus === "string" && isPipelineStatus(nextStatus)) {
            const application = applications.find((item) => item.id === applicationId);
            if (application && application.status !== nextStatus) updateStatus(applicationId, nextStatus);
          }
          setDraggedId(null);
        }}
        onDragCancel={() => setDraggedId(null)}
      >
        <div data-tour="pipeline-board" className="space-y-4">
          {chunkPipelineStatuses().map((row, rowIndex) => (
            <div key={rowIndex} className="grid gap-4 lg:grid-cols-3">
              {row.map((status) => (
                <PipelineStatusColumn
                  key={status}
                  status={status}
                  applications={applicationsByStatus.get(status) ?? []}
                  versions={versions}
                  jobById={jobById}
                  draggingApplicationId={draggedId}
                  onEditApplication={setEditingApplicationId}
                />
              ))}
            </div>
          ))}
        </div>
      </DndContext>
      <PipelineEditDialog
        application={editingApplication}
        job={editingJob}
        open={Boolean(editingApplication && editingJob)}
        onOpenChange={(open) => {
          if (!open) setEditingApplicationId(null);
        }}
        onSubmit={(event) => {
          updatePipelineEntry(event);
          setEditingApplicationId(null);
        }}
        onDelete={() => {
          if (!editingJob) return;
          deletePipelineEntry(editingJob.id);
          setEditingApplicationId(null);
        }}
      />
    </div>
  );
}

function PipelineStatusColumn({
  status,
  applications,
  versions,
  jobById,
  draggingApplicationId,
  onEditApplication,
}: {
  status: ApplicationStatus;
  applications: ApplicationView[];
  versions: ResumeVersionView[];
  jobById: Map<string, JobView>;
  draggingApplicationId: string | null;
  onEditApplication: (applicationId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const Icon = statusMeta[status].icon;

  return (
    <section
      ref={setNodeRef}
      data-pipeline-status={status}
      className={cn(
        "min-h-56 rounded-xl border bg-surface p-4 shadow-[0_12px_32px_rgba(49,48,48,0.035)] transition-[background-color,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        isOver ? "border-primary/45 bg-primary-soft/25 shadow-[0_14px_36px_rgba(49,48,48,0.055),inset_0_0_0_1px_rgba(49,48,48,0.03)]" : "border-line",
      )}
    >
      <div className="relative mb-4 flex items-center justify-center px-9 text-center">
        <div className="flex min-w-0 items-center justify-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", statusMeta[status].className)} />
          <h2 className="truncate text-lg font-semibold tracking-normal">{statusMeta[status].label}</h2>
        </div>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md bg-surface-mid px-2 py-1 text-xs">
          {applications.length}
        </span>
      </div>
      <div className="space-y-3">
        {applications.length === 0 && (
          <p
            className={cn(
              "rounded-lg border border-dashed px-3 py-5 text-center text-xs transition-colors",
              isOver ? "border-primary/40 bg-white/70 text-primary" : "border-line text-muted-foreground",
            )}
          >
            {isOver ? `松开后移入${statusMeta[status].label}` : "暂无岗位"}
          </p>
        )}
        {applications.map((application) => (
          <PipelineApplicationCard
            key={application.id}
            application={application}
            job={jobById.get(application.jobId)}
            version={versions.find((item) => item.id === application.resumeVersionId)}
            timeline={buildApplicationTimeline({
              status: application.status,
              appliedAt: application.appliedAt,
              updatedAt: application.updatedAt,
            })}
            isAnyDragging={Boolean(draggingApplicationId)}
            onEdit={() => onEditApplication(application.id)}
          />
        ))}
      </div>
    </section>
  );
}

function PipelineOverview({ overview }: { overview: ReturnType<typeof buildPipelineOverview> }) {
  const sourceCountMap = new Map(overview.sourceCounts.map((item) => [item.source, item.count]));
  const sourceData = applicationSourceOptions.map((source) => ({
    source,
    count: sourceCountMap.get(source) ?? 0,
  }));
  const sourceChartData = sourceData.filter((item) => item.count > 0);
  const sourceTotal = sourceData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Panel title="数据总览">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PipelineMetric icon={ClipboardList} label="跟进岗位" value={overview.total} />
        <PipelineMetric icon={CalendarClock} label="活跃流程" value={overview.active} />
        <PipelineMetric icon={Mic} label="面试转化" value={`${overview.interviewRate}%`} />
        <PipelineMetric icon={Trophy} label="Offer 转化" value={`${overview.offerRate}%`} />
      </div>
      <div className="mt-4 grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.65fr)]">
        <div className="min-w-0">
          <div className="relative min-h-[24rem] min-w-0">
            <p className="absolute left-1/2 top-3 z-10 min-w-20 -translate-x-1/2 rounded-md bg-background/85 px-2 py-1 text-center text-[0.6875rem] font-medium text-muted-foreground shadow-[0_4px_14px_rgba(49,48,48,0.04)]">
              阶段分布
            </p>
            <ResponsiveContainer width="100%" height={392} minWidth={160}>
              <BarChart data={overview.statusCounts} margin={{ top: 8, right: 18, bottom: 4, left: -12 }} barCategoryGap="22%">
                <defs>
                  {overview.statusCounts.map((entry, index) => {
                    const color = pipelineChartColors[index % pipelineChartColors.length];
                    return (
                      <linearGradient key={entry.status} id={`pipeline-status-${entry.status}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.64} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5DDD0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: "#4A3F35" }} />
                <YAxis
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.max(4, dataMax)]}
                  tickCount={5}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 13, fill: "#4A3F35" }}
                />
                <RechartsTooltip
                  cursor={{ fill: "rgba(156, 182, 156, 0.12)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E5DDD0", fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} name="岗位数">
                  {overview.statusCounts.map((entry) => (
                    <Cell key={entry.status} fill={`url(#pipeline-status-${entry.status})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-x-5 gap-y-3 border-t border-line pt-4">
            {overview.statusCounts.map((item, index) => (
              <div key={item.status} className="min-w-0 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: pipelineChartColors[index % pipelineChartColors.length] }}
                  />
                  <span className="truncate font-medium text-foreground">{item.label}</span>
                </span>
                <span className="mt-1 block text-muted-foreground">{item.count}个</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          {sourceChartData.length > 0 ? (
            <div className="relative min-h-[20rem] min-w-0">
              <p className="absolute left-1/2 top-3 z-10 min-w-20 -translate-x-1/2 rounded-md bg-background/85 px-2 py-1 text-center text-[0.6875rem] font-medium text-muted-foreground shadow-[0_4px_14px_rgba(49,48,48,0.04)]">
                来源组成
              </p>
              <ResponsiveContainer width="100%" height={328} minWidth={160}>
                <PieChart>
                  <defs>
                    {sourceChartData.map((entry) => {
                      const sourceIndex = applicationSourceOptions.indexOf(entry.source);
                      const color = pipelineChartColors[sourceIndex % pipelineChartColors.length];
                      return (
                        <linearGradient key={entry.source} id={`pipeline-source-${sourceIndex}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.88} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.64} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <Pie
                    data={sourceChartData}
                    dataKey="count"
                    nameKey="source"
                    cy="57%"
                    innerRadius={66}
                    outerRadius={104}
                    paddingAngle={2}
                  >
                    {sourceChartData.map((entry) => {
                      const sourceIndex = applicationSourceOptions.indexOf(entry.source);
                      return <Cell key={entry.source} fill={`url(#pipeline-source-${sourceIndex})`} />;
                    })}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #E5DDD0", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="relative grid min-h-[22rem] place-items-center rounded-lg bg-surface-low text-sm text-muted-foreground">
              <p className="absolute left-1/2 top-3 min-w-20 -translate-x-1/2 rounded-md bg-background/85 px-2 py-1 text-center text-[0.6875rem] font-medium text-muted-foreground shadow-[0_4px_14px_rgba(49,48,48,0.04)]">
                来源组成
              </p>
              暂无来源数据
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-x-5 gap-y-3 border-t border-line pt-4">
            {sourceData.map((entry, index) => (
              <div key={entry.source} className="min-w-0 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: pipelineChartColors[index % pipelineChartColors.length] }}
                  />
                  <span className="truncate font-medium text-foreground">{entry.source}</span>
                </span>
                <span className="mt-1 block text-muted-foreground">
                  {entry.count}个 · {sourceTotal > 0 ? Math.round((entry.count / sourceTotal) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function AddApplicationDialog({
  open,
  addJob,
  onOpenChange,
}: {
  open: boolean;
  addJob: (event: FormEvent<HTMLFormElement>) => void;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        aria-labelledby="pipeline-add-title"
        aria-modal="true"
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-[0_24px_80px_rgba(49,48,48,0.18)]"
        role="dialog"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="pipeline-add-title" className="font-serif text-xl font-semibold">
              新增投递岗位
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              记录岗位、渠道和跟进日期，保存后会进入下方投递看板。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-muted-foreground hover:bg-surface-low hover:text-foreground"
            aria-label="关闭新增投递窗口"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <AddApplicationForm addJob={addJob} onSubmitted={() => onOpenChange(false)} />
      </section>
    </div>
  );
}

function AddApplicationForm({
  addJob,
  onSubmitted,
}: {
  addJob: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitted?: () => void;
}) {
  const [applicationStage, setApplicationStage] = useState("APPLIED");
  const [stageDate, setStageDate] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [jd, setJd] = useState("");
  const applicationStatus = parsePipelineStage(applicationStage).status;

  function handleStageDateChange(value: string) {
    setStageDate(value);
    if (applicationStatus === "APPLIED" && !nextFollowUpAt) {
      setNextFollowUpAt(defaultNextFollowUpDate(value));
    }
  }

  return (
    <form
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const hasRequiredFields =
          String(formData.get("company") ?? "").trim() &&
          String(formData.get("title") ?? "").trim();
        addJob(event);
        if (hasRequiredFields) {
          setApplicationStage("APPLIED");
          setStageDate("");
          setNextFollowUpAt("");
          setJd("");
          onSubmitted?.();
        }
      }}
      className="grid gap-3"
    >
      <datalist id="pipeline-company-suggestions">
        {companySuggestions.map((company) => (
          <option key={company} value={company} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="公司" required>
          <Input name="company" placeholder="输入投递的公司" list="pipeline-company-suggestions" required />
        </FormField>
        <FormField label="岗位名称" required>
          <Input name="title" placeholder="例：前端开发实习生" required />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="投递渠道" required>
          <SourceSelect name="source" defaultValue="企业官网" required />
        </FormField>
        <FormField label="当前状态" required>
          <PipelineStageSelect
            name="applicationStage"
            value={applicationStage}
            onValueChange={setApplicationStage}
            required
          />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label={applicationStatusDateLabels[applicationStatus]} optional>
          <Input
            name="stageDate"
            type="date"
            value={stageDate}
            onChange={(event) => handleStageDateChange(event.target.value)}
          />
        </FormField>
        <FormField label="下次跟进日期" optional>
          <Input
            name="nextFollowUpAt"
            type="date"
            value={nextFollowUpAt}
            onChange={(event) => setNextFollowUpAt(event.target.value)}
          />
        </FormField>
        <FormField label="求职优先级" required>
          <ApplicationPrioritySelect name="priority" defaultValue="NORMAL" required />
        </FormField>
      </div>
      <FormField label="招聘链接" optional>
        <Input name="link" placeholder="例：官网岗位链接、BOSS 聊天链接" />
      </FormField>
      <FormField label="投递备注" optional>
        <textarea
          name="notes"
          placeholder="例：内推人、当前进度、材料状态"
          className="min-h-24 w-full resize-none rounded-lg border border-line bg-surface-low px-3 py-2 text-sm leading-6 outline-none focus:border-primary"
        />
      </FormField>
      <FormField label="岗位描述 / JD" optional>
        <SpeechTextarea
          name="jd"
          value={jd}
          onValueChange={setJd}
          maxLength={8000}
          placeholder="例：岗位职责、任职要求、加分项；可后续补完整 JD"
          className="min-h-28 resize-y bg-surface-low text-sm leading-6"
        />
      </FormField>
      <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white">
        <Plus className="h-4 w-4" />
        添加到跟进
      </button>
    </form>
  );
}

function PipelineMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg bg-surface-low p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PipelineApplicationCard({
  application,
  job,
  version,
  timeline,
  isAnyDragging,
  onEdit,
}: {
  application: ApplicationView;
  job?: JobView;
  version?: ResumeVersionView;
  timeline: ApplicationTimelineItem[];
  isAnyDragging?: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: application.id });
  const dragTransform = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;

  return (
    <article
      ref={setNodeRef}
      data-application-card={application.id}
      {...attributes}
      {...listeners}
      style={{
        transform: dragTransform,
        transition: isDragging
          ? "box-shadow 120ms ease, opacity 120ms ease, border-color 120ms ease"
          : "box-shadow 160ms ease, opacity 140ms ease, border-color 140ms ease",
        willChange: isDragging ? "transform" : undefined,
        zIndex: isDragging ? 30 : undefined,
      }}
      className={cn(
        "relative touch-none cursor-grab select-none rounded-lg border border-line bg-background p-3 shadow-[0_8px_20px_rgba(49,48,48,0.03)] outline-none transition-[border-color,box-shadow,opacity] duration-150 ease-out hover:border-brand/40 hover:shadow-[0_10px_24px_rgba(49,48,48,0.06)] active:cursor-grabbing motion-reduce:transition-none",
        isDragging && "border-primary/35 opacity-95 shadow-[0_20px_48px_rgba(49,48,48,0.16)]",
        isAnyDragging && !isDragging && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{job?.company ?? "未知公司"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{job?.title ?? "未知岗位"}</p>
        </div>
        <button
          type="button"
          draggable={false}
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[0.6875rem] font-medium text-primary hover:bg-primary-soft"
          aria-label={`编辑${job?.company ?? "岗位"}投递信息`}
          title="编辑投递信息"
        >
          <Edit3 className="h-3 w-3" />
          编辑
        </button>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {application.notes || "暂无备注"}
      </p>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span className="rounded-md bg-surface-low px-2 py-1">渠道：{displaySource(job?.source)}</span>
        <span className="rounded-md bg-surface-low px-2 py-1">
          {applicationStatusDateLabels[application.status].replace("日期", "").trim()}：{application.stageDate ?? application.appliedAt ?? "未记录"}
        </span>
        <span className="rounded-md bg-surface-low px-2 py-1">跟进：{application.nextFollowUpAt ?? "未设置"}</span>
        <span className="rounded-md bg-surface-low px-2 py-1">优先：{applicationPriorityLabels[application.priority]}</span>
        <span className="rounded-md bg-surface-low px-2 py-1">简历：{version?.name ?? "未绑定"}</span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-surface-low px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] font-semibold text-foreground">投递进度</span>
          <span className="rounded-full bg-background px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
            {applicationStageLabel(application)}
          </span>
        </div>
        <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))` }}>
          {timeline.map((item, index) => {
            const Icon = statusMeta[item.status].icon;
            const nextItem = timeline[index + 1];
            return (
              <li key={item.key} className="relative min-w-0">
                {nextItem && (
                  <span
                    className={cn(
                      "absolute left-1/2 right-[-50%] top-3 h-px",
                      timelineConnectorClass(item, nextItem),
                    )}
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex min-w-0 flex-col items-center text-center">
                  <span className={cn("grid h-6 w-6 place-items-center rounded-full border", timelineMarkerClass(item))}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className={cn("mt-1 w-full truncate text-[0.625rem] font-semibold", timelineTextClass(item))}>
                    {item.label}
                  </span>
                  <span className="mt-0.5 w-full truncate text-[0.5625rem] text-muted-foreground">
                    {formatTimelineDate(item)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1 rounded-md border border-dashed border-line bg-surface-low px-2 py-2 text-xs font-medium text-muted-foreground">
        <GripVertical className="h-3.5 w-3.5" />
        整张卡片可拖动切换阶段
      </div>
    </article>
  );
}

function PipelineEditDialog({
  application,
  job,
  open,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  application?: ApplicationView;
  job?: JobView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  if (!open || !application || !job) return null;

  return (
    <PipelineEditDialogContent
      key={job.id}
      application={application}
      job={job}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      onDelete={onDelete}
    />
  );
}

function PipelineEditDialogContent({
  application,
  job,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  application: ApplicationView;
  job: JobView;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  const [jd, setJd] = useState(job.jd ?? "");
  const [applicationStage, setApplicationStage] = useState(
    pipelineStageValue(application.status, application.interviewRound),
  );
  const applicationStatus = parsePipelineStage(applicationStage).status;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        aria-labelledby="pipeline-edit-title"
        aria-modal="true"
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-[0_24px_80px_rgba(49,48,48,0.18)]"
        role="dialog"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="pipeline-edit-title" className="font-serif text-xl font-semibold">
              编辑投递信息
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              修改岗位资料、跟进日期和当前阶段；需要彻底移除时可在底部删除。
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-muted-foreground hover:bg-surface-low hover:text-foreground"
            aria-label="关闭编辑窗口"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="applicationId" value={application.id} />
          <datalist id="pipeline-edit-company-suggestions">
            {companySuggestions.map((company) => (
              <option key={company} value={company} />
            ))}
          </datalist>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="公司" required>
              <Input
                name="company"
                defaultValue={job.company}
                list="pipeline-edit-company-suggestions"
                required
              />
            </FormField>
            <FormField label="岗位名称" required>
              <Input name="title" defaultValue={job.title} required />
            </FormField>
            <FormField label="投递渠道" required>
              <SourceSelect name="source" defaultValue={displaySource(job.source)} required />
            </FormField>
            <FormField label="当前阶段" required>
              <PipelineStageSelect
                name="stage"
                value={applicationStage}
                onValueChange={setApplicationStage}
                required
              />
            </FormField>
            <FormField label={applicationStatusDateLabels[applicationStatus]} optional>
              <Input name="stageDate" type="date" defaultValue={application.stageDate ?? application.appliedAt ?? ""} />
            </FormField>
            <FormField label="下次跟进日期" optional>
              <Input name="nextFollowUpAt" type="date" defaultValue={application.nextFollowUpAt ?? ""} />
            </FormField>
            <FormField label="求职优先级" required>
              <ApplicationPrioritySelect name="priority" defaultValue={application.priority} required />
            </FormField>
          </div>

          <FormField label="招聘链接" optional>
            <Input name="link" defaultValue={job.link ?? ""} placeholder="例：官网岗位链接、BOSS 聊天链接" />
          </FormField>
          <FormField label="投递备注" optional>
            <textarea
              name="notes"
              defaultValue={application.notes ?? ""}
              placeholder="例：内推人、当前进度、材料状态"
              className="min-h-24 w-full resize-none rounded-lg border border-line bg-surface-low px-3 py-2 text-sm leading-6 outline-none focus:border-primary"
            />
          </FormField>
          <FormField label="岗位描述 / JD" optional>
            <SpeechTextarea
              name="jd"
              value={jd}
              onValueChange={setJd}
              maxLength={8000}
              placeholder="例：岗位职责、任职要求、加分项"
              className="min-h-28 resize-y bg-surface-low text-sm leading-6"
            />
          </FormField>

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`删除「${job.company} · ${job.title}」这条投递记录？`)) {
                  onDelete();
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              删除投递岗位
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-primary hover:bg-surface-low"
              >
                取消
              </button>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
                保存修改
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function isAiReady(settings: RedactedAiSettings | null) {
  if (!settings?.aiEnabled) return false;
  if (settings.requiresApiKey && !settings.hasApiKey) return false;
  return settings.aiLastTestStatus === "success";
}

function aiReadinessMessage(settings: RedactedAiSettings | null) {
  if (!settings) return "AI 模型尚未配置。请先在设置页选择 Provider、填写模型与密钥，并测试连接。";
  if (!settings.aiEnabled) return "AI 功能当前未启用。请在设置页开启并测试连接。";
  if (settings.requiresApiKey && !settings.hasApiKey) return "当前 Provider 需要 API Key。请先在设置页保存密钥。";
  if (settings.aiLastTestStatus === "failed") return "上次 AI 连接测试失败。请检查 Base URL、模型名称或密钥后重新测试。";
  if (settings.aiLastTestStatus !== "success") return "AI 设置尚未通过连接测试。请先在设置页点击测试连接。";
  return "AI 功能可用。";
}

function SettingsView({
  settings,
  aiSettings,
  onAiSettingsChange,
  onResetData,
  onStatus,
}: {
  settings: InitialData["settings"];
  aiSettings: RedactedAiSettings | null;
  onAiSettingsChange: (settings: RedactedAiSettings) => void;
  onResetData: () => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const [isResettingData, setIsResettingData] = useState(false);

  async function handleResetData() {
    const confirmed = window.confirm("清空本地 SQLite 中的简历、投递进度、面试记录和 AI 设置，并恢复项目内置示例数据？");
    if (!confirmed) return;

    setIsResettingData(true);
    try {
      await onResetData();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "本地数据重置失败。");
    } finally {
      setIsResettingData(false);
    }
  }

  return (
    <div className="flex max-w-6xl flex-col gap-4">
      <AiSettingsPanel
        key={settings?.updatedAt ?? "empty-ai-settings"}
        settings={aiSettings}
        onSettingsChange={onAiSettingsChange}
        onStatus={onStatus}
      />
      <section className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(49,48,48,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">本地数据</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              会清空本地 SQLite 中的简历、优化版本、投递进度、面试记录和 AI 设置，并恢复项目内置示例数据。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleResetData()}
            disabled={isResettingData}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResettingData ? "正在恢复示例数据" : "清空并恢复示例数据"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Panel({
  title,
  action,
  onAction,
  children,
  className,
  contentClassName,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-surface p-4 shadow-[0_12px_40px_rgba(49,48,48,0.04)]",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        {action && (
          <button onClick={onAction} className="text-xs font-medium text-primary">
            {action}
          </button>
        )}
      </div>
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </section>
  );
}

function FormField({
  label,
  required,
  optional,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5 text-xs font-medium text-muted-foreground", className)}>
      <span>
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
        {optional && <span className="ml-1 font-normal text-muted-foreground">（可选）</span>}
      </span>
      {children}
    </label>
  );
}

function SourceSelect({
  name,
  defaultValue,
  required,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      required={required}
      className="w-full rounded-lg border border-line bg-surface-low px-3 py-3 text-sm text-foreground outline-none focus:border-primary"
    >
      {applicationSourceOptions.map((source) => (
        <option key={source} value={source}>
          {source}
        </option>
      ))}
    </select>
  );
}

function PipelineStageSelect({
  name,
  defaultValue,
  value,
  onValueChange,
  required,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={value === undefined ? defaultValue : undefined}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      required={required}
      className="w-full rounded-lg border border-line bg-surface-low px-3 py-3 text-sm text-foreground outline-none focus:border-primary"
    >
      {pipelineStageOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ApplicationPrioritySelect({
  name,
  defaultValue,
  required,
}: {
  name: string;
  defaultValue: ApplicationPriority;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      required={required}
      className="w-full rounded-lg border border-line bg-surface-low px-3 py-3 text-sm text-foreground outline-none focus:border-primary"
    >
      {applicationPriorityOptions.map((priority) => (
        <option key={priority} value={priority}>
          {applicationPriorityLabels[priority]}
        </option>
      ))}
    </select>
  );
}

function isPipelineStatus(value: string): value is (typeof visiblePipelineStatuses)[number] {
  return visiblePipelineStatuses.includes(value as (typeof visiblePipelineStatuses)[number]);
}

function normalizeInterviewRound(value: FormDataEntryValue | null): InterviewRound {
  return value === "FIRST" || value === "SECOND" || value === "THIRD" || value === "HR" ? value : "";
}

function parsePipelineStage(value: FormDataEntryValue | null): {
  status: ApplicationStatus;
  interviewRound: InterviewRound;
} {
  const stage = String(value ?? "APPLIED");
  if (stage === "INTERVIEW:FIRST") return { status: "INTERVIEW", interviewRound: "FIRST" };
  if (stage === "INTERVIEW:SECOND") return { status: "INTERVIEW", interviewRound: "SECOND" };
  if (stage === "INTERVIEW:THIRD") return { status: "INTERVIEW", interviewRound: "THIRD" };
  if (stage === "INTERVIEW:HR") return { status: "INTERVIEW", interviewRound: "HR" };
  if (isPipelineStatus(stage)) return { status: stage, interviewRound: "" };
  return { status: "APPLIED", interviewRound: "" };
}

function pipelineStageValue(status: ApplicationStatus, interviewRound?: InterviewRound | null) {
  if (status !== "INTERVIEW") return status;
  return `INTERVIEW:${interviewRound || "FIRST"}`;
}

function applicationStageLabel(application: Pick<ApplicationView, "status" | "interviewRound">) {
  if (application.status !== "INTERVIEW") return statusMeta[application.status].label;
  const round = application.interviewRound ? interviewRoundLabels[application.interviewRound] : "";
  return round ? `面试中（${round}）` : "面试中";
}

function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="text"
      className={cn("w-full rounded-lg border border-line bg-surface-low px-3 py-3 text-sm outline-none focus:border-primary", className)}
      {...props}
    />
  );
}

function displaySource(source?: string) {
  return normalizeApplicationSource(source);
}

function formatTimelineDate(item: ApplicationTimelineItem) {
  if (item.date) return item.date.slice(0, 10);
  if (item.tone === "future") return "未到";
  if (item.tone === "current") return "当前";
  if (item.tone === "win") return "达成";
  if (item.tone === "terminal") return "结束";
  return "已过";
}

function timelineMarkerClass(item: ApplicationTimelineItem) {
  if (item.tone === "win") return "border-[#e3a600] bg-[#f6c343] text-[#3a2a00] shadow-[0_0_0_3px_rgba(246,195,67,0.24)]";
  if (item.tone === "current") return "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_0_0_3px_rgba(217,119,6,0.10)]";
  if (item.tone === "terminal") {
    return item.status === "REJECTED"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-zinc-300 bg-zinc-100 text-zinc-600";
  }
  if (item.tone === "future") return "border-line bg-background text-muted-foreground/55";
  return "border-emerald-600 bg-emerald-600 text-white";
}

function timelineTextClass(item: ApplicationTimelineItem) {
  if (item.tone === "future") return "text-muted-foreground";
  if (item.tone === "win") return "text-[#b77900]";
  if (item.tone === "terminal") return item.status === "REJECTED" ? "text-red-700" : "text-zinc-600";
  if (item.tone === "current") return "text-amber-700";
  return "text-emerald-700";
}

function timelineConnectorClass(current: ApplicationTimelineItem, next: ApplicationTimelineItem) {
  if (next.tone === "win" && current.tone !== "future") return "bg-[#f6c343]/80";
  if (current.tone !== "future" && next.tone !== "future" && next.tone !== "terminal") return "bg-emerald-500/45";
  return "bg-line";
}

function normalizeJob(job: JobView): JobView {
  return {
    ...job,
    deadline: job.deadline ? String(job.deadline).slice(0, 10) : null,
    tags: Array.isArray(job.tags) ? job.tags : [],
  };
}

function normalizeApplication(application: ApplicationView): ApplicationView {
  return {
    ...application,
    interviewRound: normalizeInterviewRound(application.interviewRound ?? ""),
    appliedAt: application.appliedAt ? String(application.appliedAt).slice(0, 10) : null,
    stageDate: application.stageDate ? String(application.stageDate).slice(0, 10) : null,
    priority: normalizeApplicationPriority(application.priority),
    nextFollowUpAt: application.nextFollowUpAt ? String(application.nextFollowUpAt).slice(0, 10) : null,
  };
}

function normalizeVersion(version: ResumeVersionView): ResumeVersionView {
  return {
    ...version,
    createdAt: version.createdAt ? String(version.createdAt) : new Date().toISOString(),
    updatedAt: version.updatedAt ? String(version.updatedAt) : String(version.createdAt ?? new Date().toISOString()),
  };
}

function buildSyntheticJobForVersion(version: ResumeVersionView): JobView {
  return {
    id: version.jobId ?? `version-${version.id}`,
    company: "本地优化版本",
    title: version.name,
    city: "待填写",
    source: "JD匹配优化",
    jd: version.summary || version.name,
    link: "",
    deadline: null,
    tags: [],
    analysis: null,
    createdAt: version.createdAt,
  };
}

function buildSyntheticApplicationForVersion(version: ResumeVersionView, jobId: string): ApplicationView {
  return {
    id: `version-application-${version.id}`,
    jobId,
    status: "READY",
    interviewRound: "",
    resumeVersionId: version.id,
    appliedAt: null,
    stageDate: null,
    priority: "NORMAL",
    nextFollowUpAt: null,
    notes: "来自本地优化版本。",
    updatedAt: version.updatedAt,
  };
}

function readResumeVersionIdFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/resume/edit") return undefined;
  return new URLSearchParams(window.location.search).get("version") ?? undefined;
}

function readMatchVersionIdFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/match") return undefined;
  return new URLSearchParams(window.location.search).get("version") ?? undefined;
}

function readInterviewSessionIdFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/interview") return undefined;
  return new URLSearchParams(window.location.search).get("session") ?? undefined;
}

async function postJson(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = (await response.text()) || response.statusText || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return response.json();
}

function formatRequestError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "请稍后重试";
}

function emptyResume(): ResumeContent {
  return {
    basics: { name: "", email: "", phone: "", city: "", links: [] },
    profile: { title: "", summary: "" },
    education: [],
    experiences: [],
    internships: [],
    projects: [],
    skills: [],
    awards: [],
    selfReview: "",
  };
}

