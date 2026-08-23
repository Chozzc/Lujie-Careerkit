"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import type { NavKey } from "@/lib/navigation";
import { navKeyFromPathname, pathnameForNavKey } from "@/lib/navigation";
import { hasResumeContent } from "@/lib/resume-library";
import { buildResumeDisplayName } from "@/lib/resume-naming";
import type { RedactedAiSettings } from "@/lib/ai/settings";
import { aiReadinessMessage, isAiReady, isResumeImportAiReady } from "@/lib/ai/readiness";
import type {
  ResumeDiagnosis,
  ResumeDiagnosisIssue,
} from "@/lib/ai/resume-diagnosis";
import type { ApplicationStatus, JobAnalysis, ResumeContent, ResumeOptimizationMeta } from "@/lib/types";
import type { InterviewSessionRecord } from "@/lib/interview-service";
import type { InterviewPreparation, InterviewPreparationRecord } from "@/lib/interview-preparation";
import { cn } from "@/lib/utils";
import { ResumeWorkbench, type ResumeSaveTarget } from "@/components/resume/resume-workbench";
import {
  ResumeDiagnosisDialog,
  type ResumeDiagnosisSelection,
} from "@/components/resume/resume-diagnosis-dialog";
import {
  ResumeOptimizationResult,
  buildResumeDiffSections,
  buildOptimizationDescription,
  buildOptimizationSummary,
} from "@/components/resume/resume-optimization-result";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { InterviewWorkspace } from "@/components/interview/interview-workspace";
import { SettingsView } from "@/components/settings/settings-view";
import { buildDashboardSummary, getDashboardDueDate } from "@/lib/dashboard";
import { AI_ROUTE_WARMUP_PATHS, warmAiRoutes } from "@/lib/ai-route-prewarm";
import {
  MatchView,
  type MatchOptimizationRequest,
  type MatchOptimizationResult,
} from "@/components/match/match-view";
import { AppPageHeader } from "@/components/app/app-page-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { FirstUseTour } from "@/components/app/first-use-tour";
import { AgentAssistant } from "@/components/agent/agent-assistant";
import type { HeaderMenuKey } from "@/components/app/header-menu";
import { navItems } from "@/components/app/navigation";
import {
  AddApplicationDialog,
  PipelineView,
  normalizeInterviewRound,
  parsePipelineStage,
  statusMeta,
} from "@/components/pipeline/pipeline-workspace";
import type { ApplicationView, InitialData, JobView, ResumeVersionView } from "@/components/app/types";
import {
  attachGeneralResumeOptimizationState,
  readGeneralResumeOptimizationStages,
} from "@/lib/resume-optimization-state";
import { CareerLibraryView } from "@/components/library/career-library-view";
import { CareerLibraryWorkspace } from "@/components/library/career-library-workspace";
import {
  careerLibraryTargetPath,
  parseCareerLibraryTarget,
  readCareerLibraryGroup,
  type CareerArtifact,
  type CareerLibraryGroup,
  type CareerLibraryTarget,
} from "@/lib/career-library";
import { hasSeenFirstUseTour, markFirstUseTourSeen } from "@/lib/first-use-tour";

type ResumeMode = "library" | "editor";
type ResumeOptimizationRequest = {
  resumeContent: ResumeContent;
  diagnosis: ResumeDiagnosis;
  selectedIssueIds: string[];
  additionalDirection: string;
  locale: "zh-CN" | "en";
};
type ResumeOptimizationResponse = { draft: ResumeContent; message?: string; optimization?: ResumeOptimizationMeta };
type ResumeOptimizationView = {
  before: ResumeContent;
  after: ResumeContent;
  savedContent?: ResumeContent;
  version?: ResumeVersionView;
  sourceVersionId?: string;
  diagnosis?: ResumeDiagnosis;
  selectedIssueIds?: string[];
  selectedIssues?: ResumeDiagnosisIssue[];
  additionalDirection?: string;
  acceptedChangeIds?: string[];
  editedValues?: Record<string, string>;
  message?: string;
  optimization?: ResumeOptimizationMeta;
};

export function CareerKitApp({
  initialData,
  initialView = "dashboard",
  initialResumeMode = "library",
  initialResumeVersionId,
  initialLibraryTarget = null,
  initialLibraryGroup = "job",
}: {
  initialData: InitialData;
  initialView?: NavKey;
  initialResumeMode?: ResumeMode;
  initialResumeVersionId?: string;
  initialLibraryTarget?: CareerLibraryTarget | null;
  initialLibraryGroup?: CareerLibraryGroup;
}) {
  const t = useTranslations("app");
  const optimizationT = useTranslations("optimizationResult");
  const libraryT = useTranslations("careerLibrary");
  const [active, setActive] = useState<NavKey>(initialView);
  const [resumeMode, setResumeMode] = useState<ResumeMode>(initialResumeMode);
  const [resumeEditorVersionId, setResumeEditorVersionId] = useState(initialResumeVersionId);
  const [libraryTarget, setLibraryTarget] = useState<CareerLibraryTarget | null>(initialLibraryTarget);
  const [libraryGroup, setLibraryGroup] = useState<CareerLibraryGroup>(initialLibraryGroup);
  const [resume, setResume] = useState<ResumeContent>(initialData.resume?.content ?? emptyResume());
  const [resumeUpdatedAt, setResumeUpdatedAt] = useState(initialData.resume?.updatedAt ?? new Date().toISOString());
  const [mainResumeVersionId, setMainResumeVersionId] = useState(initialData.resume?.id ?? "");
  const [mainResumeRootId, setMainResumeRootId] = useState(initialData.resume?.resumeId ?? "");
  const [jobs, setJobs] = useState(initialData.jobs);
  const [applications, setApplications] = useState(initialData.applications);
  const [versions, setVersions] = useState(initialData.versions);
  const [interviewSessions, setInterviewSessions] = useState(initialData.interviews);
  const [interviewPreparations, setInterviewPreparations] = useState(initialData.interviewPreparations);
  const [appSettings, setAppSettings] = useState(initialData.settings);
  const [aiSettings, setAiSettings] = useState<RedactedAiSettings | null>(initialData.settings?.ai ?? null);
  const [toast, setToast] = useState("");
  const [headerMenu, setHeaderMenu] = useState<HeaderMenuKey | null>(null);
  const [firstUseTourOpen, setFirstUseTourOpen] = useState(false);
  const [pipelineAddOpen, setPipelineAddOpen] = useState(false);
  const [matchVersionId, setMatchVersionId] = useState<string | undefined>(readMatchVersionIdFromLocation());
  const [interviewSessionId, setInterviewSessionId] = useState<string | undefined>(readInterviewSessionIdFromLocation());
  const [interviewPreparationId, setInterviewPreparationId] = useState<string | undefined>(readInterviewPreparationIdFromLocation());
  const [resumeOptimizationVersionId, setResumeOptimizationVersionId] = useState(readResumeOptimizationVersionIdFromLocation());
  const [resumeOptimizationResult, setResumeOptimizationResult] = useState<ResumeOptimizationView | null>(null);
  const [resumeOptimizationStage, setResumeOptimizationStage] = useState<0 | 1 | 2>(
    readResumeOptimizationVersionIdFromLocation() ? 2 : 1,
  );
  const [resumeDiagnosisDialogOpen, setResumeDiagnosisDialogOpen] = useState(false);
  const [resumeOptimizationPreviousStage, setResumeOptimizationPreviousStage] = useState<0 | 1 | 2>(2);
  const [matchResetKey, setMatchResetKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const storedResumeOptimizationResult = useMemo<ResumeOptimizationView | null>(() => {
    if (active !== "resume" || !resumeOptimizationVersionId) return null;
    const version = versions.find((item) => item.id === resumeOptimizationVersionId);
    if (!version) return null;
    const stages = readGeneralResumeOptimizationStages(version.content);
    const diagnosis = stages?.diagnosis;
    return {
      before: readStoredOptimizationBase(version.content) ?? resume,
      after: stages?.draft ?? version.content,
      savedContent: version.content,
      version,
      diagnosis,
      selectedIssueIds: stages?.selectedIssueIds,
      selectedIssues: diagnosis?.issues.filter((issue) => stages?.selectedIssueIds?.includes(issue.id)),
      additionalDirection: stages?.additionalDirection,
      acceptedChangeIds: stages?.acceptedChangeIds,
      editedValues: stages?.editedValues,
      optimization: readStoredOptimizationMeta(version.content),
      message: version.summary,
    };
  }, [active, resume, resumeOptimizationVersionId, versions]);
  const currentResumeOptimizationResult = resumeOptimizationResult ?? storedResumeOptimizationResult;
  const dashboard = useMemo(
    () => buildDashboardSummary({ jobs, applications }),
    [applications, jobs],
  );
  const followUpReminders = useMemo(() => {
    const today = new Date();
    return applications
      .map((application) => ({ application, job: jobById.get(application.jobId), dueDate: getDashboardDueDate(application, today) }))
      .filter((item) => item.job && item.dueDate)
      .slice(0, 4);
  }, [applications, jobById]);

  useEffect(() => {
    try {
      if (hasSeenFirstUseTour(window.localStorage)) return;
      const timeout = window.setTimeout(() => setFirstUseTourOpen(true), 450);
      return () => window.clearTimeout(timeout);
    } catch {
      const timeout = window.setTimeout(() => setFirstUseTourOpen(true), 450);
      return () => window.clearTimeout(timeout);
    }
  }, []);

  const finishFirstUseTour = useCallback((outcome: "completed" | "skipped") => {
    try {
      markFirstUseTourSeen(window.localStorage, outcome);
    } catch {
      // The guide remains usable when browser storage is unavailable.
    }
    setFirstUseTourOpen(false);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextActive = navKeyFromPathname(window.location.pathname);
      if (!nextActive) return;
      setActive(nextActive);
      setResumeMode(window.location.pathname === "/resume/edit" ? "editor" : "library");
      setResumeEditorVersionId(readResumeVersionIdFromLocation());
      const optimizedVersionId = readResumeOptimizationVersionIdFromLocation();
      setResumeOptimizationVersionId(optimizedVersionId);
      setResumeOptimizationResult(null);
      setResumeOptimizationStage(optimizedVersionId ? 2 : 1);
      setMatchVersionId(readMatchVersionIdFromLocation());
      setInterviewSessionId(readInterviewSessionIdFromLocation());
      setInterviewPreparationId(readInterviewPreparationIdFromLocation());
      setLibraryTarget(parseCareerLibraryTarget(window.location.pathname));
      setLibraryGroup(readCareerLibraryGroup(new URLSearchParams(window.location.search).get("group")));
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
    } else if (active === "resume") {
      void warmAiRoutes([
        AI_ROUTE_WARMUP_PATHS.analyze,
        AI_ROUTE_WARMUP_PATHS.optimize,
        AI_ROUTE_WARMUP_PATHS.applicationMessage,
      ]);
    } else if (active === "interview") {
      void warmAiRoutes([AI_ROUTE_WARMUP_PATHS.interview]);
    }
  }, [active]);

  const navigateTo = useCallback((key: NavKey) => {
    setToast("");
    setActive(key);
    setResumeMode("library");
    if (key !== "resume") setResumeEditorVersionId(undefined);
    setResumeOptimizationVersionId(undefined);
    setResumeOptimizationResult(null);
    setResumeOptimizationStage(1);
    setResumeDiagnosisDialogOpen(false);
    setMatchVersionId(undefined);
    setInterviewSessionId(undefined);
    setInterviewPreparationId(undefined);
    setLibraryTarget(null);
    setLibraryGroup("job");
    setPipelineAddOpen(false);
    const nextPath = pathnameForNavKey(key);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }, []);

  const libraryData = useMemo(() => ({
    versions,
    jobs,
    applications,
    interviews: interviewSessions,
    interviewPreparations,
  }), [applications, interviewPreparations, interviewSessions, jobs, versions]);

  const openLibraryTarget = useCallback((target: CareerLibraryTarget) => {
    setLibraryTarget(target);
    const groupQuery = libraryGroup === "type" ? "?group=type" : "";
    window.history.pushState(null, "", `${careerLibraryTargetPath(target)}${groupQuery}`);
  }, [libraryGroup]);

  const closeLibraryTarget = useCallback(() => {
    setLibraryTarget(null);
    window.history.pushState(null, "", libraryGroup === "type" ? "/library?group=type" : "/library");
  }, [libraryGroup]);

  const changeLibraryGroup = useCallback((group: CareerLibraryGroup) => {
    setLibraryGroup(group);
    window.history.pushState(null, "", group === "type" ? "/library?group=type" : "/library");
  }, []);

  const openResumeEditorFromMatch = useCallback((versionId?: string) => {
    setActive("resume");
    setResumeMode("editor");
    setResumeEditorVersionId(versionId);
    setResumeOptimizationVersionId(undefined);
    setResumeOptimizationResult(null);
    setResumeOptimizationStage(1);
    const nextPath = versionId ? `/resume/edit?version=${encodeURIComponent(versionId)}` : "/resume/edit";
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }, []);

  const upsertInterviewSession = useCallback((session: InterviewSessionRecord) => {
    setInterviewSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
    setInterviewPreparationId(undefined);
    setInterviewSessionId(session.id);
  }, []);

  const upsertInterviewPreparation = useCallback((record: InterviewPreparationRecord) => {
    setInterviewPreparations((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    setInterviewSessionId(undefined);
    setInterviewPreparationId(record.id);
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

  async function deleteInterviewPreparation(preparationId: string) {
    try {
      const response = await fetch(`/api/interviews/preparation/${preparationId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("删除面试复习资料失败。");
      setInterviewPreparations((current) => current.filter((record) => record.id !== preparationId));
      if (interviewPreparationId === preparationId) {
        setInterviewPreparationId(undefined);
        window.history.pushState(null, "", "/interview");
      }
      setToast("面试复习资料已删除。");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "删除面试复习资料失败。");
    }
  }

  function deleteCareerArtifact(artifact: CareerArtifact) {
    if (artifact.kind === "job-analysis") {
      const job = jobs.find((item) => item.id === artifact.id);
      if (!window.confirm(libraryT("deleteAnalysisConfirm", {
        name: `${job?.company ?? libraryT("unknownCompany")} · ${job?.title ?? libraryT("unknownJob")}`,
      }))) return;
      startTransition(async () => {
        try {
          const response = await fetch(`/api/jobs/${artifact.id}/analysis`, { method: "DELETE" });
          if (!response.ok) throw new Error(await response.text());
          setJobs((current) => current.map((item) => item.id === artifact.id
            ? { ...item, jd: "", analysis: null, updatedAt: new Date().toISOString() }
            : item));
          setToast(libraryT("analysisDeleted"));
        } catch (error) {
          setToast(libraryT("deleteFailed", { error: formatRequestError(error) }));
        }
      });
    } else if (artifact.kind === "general-resume" || artifact.kind === "tailored-resume") {
      deleteResumeVersion(artifact.id);
    } else if (artifact.kind === "interview-preparation") {
      if (!window.confirm(libraryT("deleteArtifactConfirm", { name: artifact.name }))) return;
      void deleteInterviewPreparation(artifact.id);
    } else if (artifact.kind === "interview-session") {
      if (!window.confirm(libraryT("deleteArtifactConfirm", { name: artifact.name }))) return;
      void deleteInterviewSession(artifact.id);
    }
  }

  function deleteJobArchive(jobId: string) {
    const job = jobs.find((item) => item.id === jobId);
    const name = `${job?.company ?? libraryT("unknownCompany")} · ${job?.title ?? libraryT("unknownJob")}`;
    if (!window.confirm(libraryT("deleteArchiveConfirm", {
      name,
      resumes: versions.filter((version) => version.jobId === jobId).length,
      preparations: interviewPreparations.filter((preparation) => preparation.jobId === jobId).length,
      interviews: interviewSessions.filter((session) => session.jobId === jobId).length,
      applications: applications.filter((application) => application.jobId === jobId).length,
    }))) return;
    startTransition(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
        if (!response.ok) throw new Error(await response.text());
        setJobs((current) => current.filter((item) => item.id !== jobId));
        setApplications((current) => current.filter((application) => application.jobId !== jobId));
        setVersions((current) => current.filter((version) => version.jobId !== jobId));
        setInterviewSessions((current) => current.filter((session) => session.jobId !== jobId));
        setInterviewPreparations((current) => current.filter((preparation) => preparation.jobId !== jobId));
        setToast(libraryT("archiveDeleted"));
        navigateTo("library");
      } catch (error) {
        setToast(libraryT("deleteFailed", { error: formatRequestError(error) }));
      }
    });
  }

  async function resetLocalDataToSample() {
    const result = (await postJson("/api/settings/reset-data", {})) as { data: InitialData };
    const nextData = result.data;
    setResume(nextData.resume?.content ?? emptyResume());
    setResumeUpdatedAt(nextData.resume?.updatedAt ?? new Date().toISOString());
    setMainResumeVersionId(nextData.resume?.id ?? "");
    setMainResumeRootId(nextData.resume?.resumeId ?? "");
    setJobs(nextData.jobs);
    setApplications(nextData.applications);
    setVersions(nextData.versions);
    setInterviewSessions(nextData.interviews);
    setInterviewPreparations(nextData.interviewPreparations);
    setAppSettings(nextData.settings);
    setAiSettings(nextData.settings?.ai ?? null);
    setResumeEditorVersionId(undefined);
    setResumeOptimizationVersionId(undefined);
    setResumeOptimizationResult(null);
    setMatchVersionId(undefined);
    setInterviewSessionId(undefined);
    setInterviewPreparationId(undefined);
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

  const isResumeOptimizationResult = active === "resume" && Boolean(currentResumeOptimizationResult);
  const isResumeEditor = active === "resume" && resumeMode === "editor" && !isResumeOptimizationResult;
  const pageTitle = isResumeOptimizationResult
    ? t("pages.resumeOptimizationTitle")
    : active === "match"
      ? t("nav.match")
      : t(`nav.${navItems.find((item) => item.key === active)?.labelKey ?? "dashboard"}`);
  const pageSubtitle =
    isResumeOptimizationResult
      ? t("pages.resumeOptimizationSubtitle")
      : active === "match"
      ? t("pages.matchSubtitle")
      : active === "pipeline"
        ? t("pages.pipelineSubtitle")
        : active === "interview"
          ? t("pages.interviewSubtitle")
          : t("pages.defaultSubtitle");

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

    if (!mainResumeVersionId) throw new Error("找不到正在编辑的基础简历。");
    setResume(nextContent);
    const result = (await postJson("/api/resume", { versionId: mainResumeVersionId, content: nextContent, name })) as {
      resume: { id: string; resumeId: string; updatedAt?: string };
    };
    setMainResumeVersionId(result.resume.id);
    setMainResumeRootId(result.resume.resumeId);
    setResumeUpdatedAt(result.resume.updatedAt ?? new Date().toISOString());
    setToast("原简历已保存到本地 SQLite。");
    return { kind: "main" as const };
  }

  async function renameCareerResumeArtifact(artifact: CareerArtifact, name: string) {
    if (artifact.source.type !== "resume-version") return;
    try {
      await saveResume(
        artifact.source.value.content,
        { kind: "version", id: artifact.source.value.id },
        name,
      );
    } catch (error) {
      setToast(`修改标题失败：${formatRequestError(error)}`);
      throw error;
    }
  }

  async function updateLibraryJobDescription(jobId: string, jd: string) {
    const result = await postJson(`/api/jobs/${jobId}/analysis`, { jd }, "PATCH") as { job: JobView };
    setJobs((current) => current.map((job) => job.id === jobId ? normalizeJob(result.job) : job));
    setToast(libraryT("edit.saved"));
  }

  async function updateLibraryJobIdentity(jobId: string, company: string, title: string) {
    try {
      const result = await postJson(`/api/jobs/${jobId}`, { company, title }, "PATCH") as { job: JobView };
      setJobs((current) => current.map((job) => job.id === jobId ? normalizeJob(result.job) : job));
      setToast(libraryT("editJob.saved"));
    } catch (error) {
      setToast(libraryT("editJob.failed", { error: formatRequestError(error) }));
      throw error;
    }
  }

  async function updateLibraryInterviewPreparation(id: string, content: InterviewPreparation) {
    const result = await postJson(`/api/interviews/preparation/${id}`, { content }, "PATCH") as { record: InterviewPreparationRecord };
    setInterviewPreparations((current) => current.map((record) => record.id === id ? result.record : record));
    setToast(libraryT("edit.saved"));
  }

  async function updateLibraryInterviewSession(id: string, input: Pick<InterviewSessionRecord, "context" | "questions" | "answers" | "feedback">) {
    const result = await postJson(`/api/interviews/${id}`, input, "PATCH") as { session: InterviewSessionRecord };
    setInterviewSessions((current) => current.map((session) => session.id === id ? result.session : session));
    setToast(libraryT("edit.saved"));
  }

  async function deleteLibraryInterviewSection(id: string, section: "questions" | "feedback") {
    if (!window.confirm(libraryT(section === "questions" ? "deleteQuestionsConfirm" : "deleteFeedbackConfirm"))) return;
    try {
      const response = await fetch(`/api/interviews/${id}?section=${section}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json() as { session: InterviewSessionRecord | null };
      setInterviewSessions((current) => result.session
        ? current.map((session) => session.id === id ? result.session! : session)
        : current.filter((session) => session.id !== id));
      setToast(libraryT(section === "questions" ? "questionsDeleted" : "feedbackDeleted"));
    } catch (error) {
      setToast(libraryT("deleteFailed", { error: formatRequestError(error) }));
    }
  }

  async function regenerateLibraryInterviewReport(id: string) {
    if (!window.confirm(libraryT("regenerateFeedbackConfirm"))) return;
    const result = await postJson(`/api/interviews/${id}/report`, { regenerate: true }) as { session: InterviewSessionRecord };
    setInterviewSessions((current) => current.map((session) => session.id === id ? result.session : session));
    setToast(libraryT("feedbackRegenerated"));
  }

  function deleteMainResume() {
    const confirmed = window.confirm("删除这份基础简历及由它生成的所有优化版本？投递记录和面试资料会保留，但不再关联这份简历。此操作会真正删除数据，且无法撤销。");
    if (!confirmed) return;
    const blank = emptyResume();
    startTransition(async () => {
      try {
        if (!mainResumeVersionId) return;
        const response = await fetch(`/api/resume-versions/${mainResumeVersionId}`, { method: "DELETE" });
        if (!response.ok) throw new Error(await response.text());
        const result = (await response.json()) as { deletedIds: string[] };
        const deletedIds = new Set(result.deletedIds);
        const remaining = versions.filter((version) => !deletedIds.has(version.id));
        const nextBase = remaining.find((version) => !version.jobId && !readStoredOptimizationBase(version.content));
        setVersions(nextBase ? remaining.filter((version) => version.id !== nextBase.id) : remaining);
        setResume(nextBase?.content ?? blank);
        setResumeUpdatedAt(nextBase?.updatedAt ?? new Date().toISOString());
        setMainResumeVersionId(nextBase?.id ?? "");
        setMainResumeRootId(nextBase?.resumeId ?? "");
        setApplications((current) => current.map((application) =>
          application.resumeVersionId && deletedIds.has(application.resumeVersionId)
            ? { ...application, resumeVersionId: null }
            : application,
        ));
        setInterviewSessions((current) => current.map((session) =>
          session.resumeVersionId && deletedIds.has(session.resumeVersionId)
            ? { ...session, resumeVersionId: null }
            : session,
        ));
        setInterviewPreparations((current) => current.map((preparation) =>
          preparation.resumeVersionId && deletedIds.has(preparation.resumeVersionId)
            ? { ...preparation, resumeVersionId: null }
            : preparation,
        ));
        resetMatchIfDeleted(deletedIds);
        setToast("原简历已删除。");
      } catch (error) {
        setToast(`删除失败：${formatRequestError(error)}`);
      }
    });
  }

  function deleteResumeVersion(versionId: string) {
    const version = versions.find((item) => item.id === versionId);
    const confirmed = window.confirm(`删除「${version?.name || "这份简历"}」？`);
    if (!confirmed) return;
    const deletedIds = new Set([versionId]);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/resume-versions/${versionId}`, { method: "DELETE" });
        if (!response.ok) throw new Error(await response.text());
        const result = (await response.json()) as { deletedIds: string[] };
        const serverDeletedIds = new Set(result.deletedIds);
        result.deletedIds.forEach((id) => deletedIds.add(id));
        setVersions((current) => current.filter((item) => !serverDeletedIds.has(item.id)));
        setApplications((current) =>
          current.map((application) =>
            application.resumeVersionId && serverDeletedIds.has(application.resumeVersionId)
              ? { ...application, resumeVersionId: null }
              : application,
          ),
        );
        setInterviewSessions((current) => current.map((session) =>
          session.resumeVersionId && serverDeletedIds.has(session.resumeVersionId)
            ? { ...session, resumeVersionId: null }
            : session,
        ));
        setInterviewPreparations((current) => current.map((preparation) =>
          preparation.resumeVersionId && serverDeletedIds.has(preparation.resumeVersionId)
            ? { ...preparation, resumeVersionId: null }
            : preparation,
        ));
        resetMatchIfDeleted(deletedIds);
        setToast("简历已删除。");
      } catch (error) {
        setToast(`删除失败：${formatRequestError(error)}`);
      }
    });
  }

  function addJob(event: FormEvent<HTMLFormElement>): Promise<boolean> {
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
      return Promise.resolve(false);
    }
    return new Promise((resolve) => startTransition(async () => {
      try {
        const jobResult = (await postJson("/api/jobs", {
          company,
          title,
          city: String(formData.get("city") ?? "").trim() || "待填写",
          source: String(formData.get("source") ?? "").trim() || "企业官网",
          deadline: String(formData.get("deadline") ?? "") || null,
          link: String(formData.get("link") ?? ""),
          jd: jd || notes || `${company} ${title}，暂未补充完整 JD。`,
        })) as { job: JobView };
        const job = normalizeJob(jobResult.job);
        const applicationResult = (await postJson("/api/applications", {
          jobId: job.id,
          status: applicationStatus,
          interviewRound,
          stageDate: String(formData.get("stageDate") ?? "") || null,
          nextFollowUpAt: String(formData.get("nextFollowUpAt") ?? "") || null,
          notes,
        })) as { application: ApplicationView };
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
        setApplications((current) => [
          normalizeApplication(applicationResult.application),
          ...current.filter((item) => item.id !== applicationResult.application.id),
        ]);
        setToast("投递岗位已加入跟进。");
        form.reset();
        resolve(true);
      } catch (error) {
        setToast(`岗位保存失败：${formatRequestError(error)}`);
        resolve(false);
      }
    }));
  }

  async function runMatchOptimization(input: MatchOptimizationRequest): Promise<MatchOptimizationResult> {
    const jd = input.jd.trim();
    if (!jd) throw new Error("请先粘贴职位描述 / 任职要求。");
    if (!isAiReady(aiSettings)) throw new Error(aiReadinessMessage(aiSettings));

    const result = (await postJson("/api/jobs", {
      company: "待填写公司",
      title: "待分析岗位",
      city: "待填写",
      source: "JD匹配优化",
      deadline: null,
      link: "",
      jd,
    })) as { job: JobView };
    const job = normalizeJob(result.job);

    setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);

    let tailored: {
      analysis: JobAnalysis;
      version: ResumeVersionView;
      optimization?: ResumeOptimizationMeta;
      source?: "ai" | "fallback";
      message?: string;
    };
    try {
      tailored = (await postJson("/api/ai/resume-tailor", {
        jobId: job.id,
        jd,
        resumeVersionId: input.resumeVersionId,
        resumeContent: input.resumeContent,
        preferences: input.preferences,
      })) as {
        analysis: JobAnalysis;
        version: ResumeVersionView;
        optimization?: ResumeOptimizationMeta;
        source?: "ai" | "fallback";
        message?: string;
      };
    } catch (error) {
      throw error;
    }
    const version = normalizeVersion(tailored.version);

    setJobs((current) =>
      current.map((item) =>
        item.id === job.id
          ? {
              ...item,
              company: cleanOptimizationLabel(tailored.analysis.company) || item.company,
              title: cleanOptimizationLabel(tailored.analysis.title) || item.title,
              analysis: tailored.analysis,
            }
          : item,
      ),
    );
    setVersions((current) => [version, ...current]);
    setToast(
      tailored.message ??
        `${cleanOptimizationLabel(tailored.analysis.title) || "目标岗位"}的优化后简历已生成。`,
    );

    return {
      job: {
        ...job,
        company: cleanOptimizationLabel(tailored.analysis.company) || job.company,
        title: cleanOptimizationLabel(tailored.analysis.title) || job.title,
        analysis: tailored.analysis,
      },
      analysis: tailored.analysis,
      version,
      optimization: tailored.optimization,
      message: tailored.message,
    };
  }

  async function trackMatchedJob(jobId: string, resumeVersionId: string) {
    if (applications.some((application) => application.jobId === jobId)) return;
    try {
      const result = (await postJson("/api/applications", {
        jobId,
        resumeVersionId,
        status: "APPLIED",
        appliedAt: new Date().toISOString().slice(0, 10),
        notes: "从 JD 匹配加入投递跟进。",
      })) as { application: ApplicationView };
      setApplications((current) => [normalizeApplication(result.application), ...current]);
      setToast("已加入投递岗位跟进。");
    } catch (error) {
      setToast(`加入投递跟进失败：${formatRequestError(error)}`);
    }
  }

  async function runResumeOptimization(input: ResumeOptimizationRequest): Promise<ResumeOptimizationResponse> {
    if (!isAiReady(aiSettings)) throw new Error(aiReadinessMessage(aiSettings));

    const result = (await postJson("/api/ai/resume-optimize", input)) as {
      draft: ResumeContent;
      message?: string;
      optimization?: ResumeOptimizationMeta;
    };
    return {
      draft: result.draft,
      message: result.message,
      optimization: result.optimization,
    };
  }

  function showResumeOptimizationResult(result: ResumeOptimizationView) {
    setResumeOptimizationVersionId(undefined);
    setResumeOptimizationResult(result);
    setResumeOptimizationStage(1);
    setResumeMode("library");
    setResumeEditorVersionId(undefined);
    setToast(result.message ?? optimizationT("review.draftReady"));
    const nextPath = "/resume";
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }

  async function saveReviewedResume(
    content: ResumeContent,
    reviewState: { acceptedIds: string[]; editedValues: Record<string, string> },
  ) {
    const result = currentResumeOptimizationResult;
    if (!result) return;
    const generatedOptimization = result.optimization ?? {
      company: "",
      title: "",
      keywords: [],
      summary: "",
      changes: [],
      versionName: "",
    };
    const optimization = {
      ...generatedOptimization,
      summary: optimizationT("review.versionSummary"),
      changes: buildResumeDiffSections(result.before, content).map((section) => section.title),
    };
    const persistedContent = attachGeneralResumeOptimizationState(
      content,
      result.before,
      optimization,
      {
        diagnosis: result.diagnosis,
        draft: result.after,
        selectedIssueIds: result.selectedIssueIds,
        additionalDirection: result.additionalDirection,
        acceptedChangeIds: reviewState.acceptedIds,
        editedValues: reviewState.editedValues,
      },
    );
    let version: ResumeVersionView;
    if (result.version) {
      const saved = await saveResume(
        persistedContent,
        { kind: "version", id: result.version.id },
        result.version.name,
      );
      if (saved.kind !== "version") throw new Error("通用优化版本保存失败。");
      version = normalizeVersion(saved.version);
    } else {
      const sourceResumeId = result.sourceVersionId
        ? result.sourceVersionId === mainResumeVersionId
          ? mainResumeRootId
          : versions.find((item) => item.id === result.sourceVersionId)?.resumeId
        : mainResumeRootId;
      if (!sourceResumeId) throw new Error("找不到通用优化的来源简历。");
      version = normalizeVersion(((await postJson("/api/resume-versions", {
          name: optimization.versionName || `AI优化-${buildResumeDisplayName(result.before, "未命名简历")}`,
          summary: optimization.summary,
          content: persistedContent,
          baseResume: result.before,
          optimizationMeta: optimization,
          sourceResumeId,
        })) as { version: ResumeVersionView }).version);
    }

    setVersions((current) => [version, ...current.filter((item) => item.id !== version.id)]);
    setResumeOptimizationVersionId(version.id);
    setResumeOptimizationResult({
      ...result,
      savedContent: version.content,
      version,
      optimization,
      acceptedChangeIds: reviewState.acceptedIds,
      editedValues: reviewState.editedValues,
    });
    setResumeOptimizationStage(2);
    setToast(optimizationT("review.saved"));
    window.history.pushState(null, "", `/resume?optimized=${encodeURIComponent(version.id)}`);
  }

  function cancelResumeReview() {
    const result = currentResumeOptimizationResult;
    if (!result) return;
    if (result.version) {
      setResumeOptimizationStage(2);
      return;
    }
    if (result.sourceVersionId === mainResumeVersionId) {
      setResume(result.before);
    } else if (result.sourceVersionId) {
      setVersions((current) => current.map((version) =>
        version.id === result.sourceVersionId ? { ...version, content: result.before } : version,
      ));
    } else {
      setResume(result.before);
    }
    openResumeEditorFromMatch(result.sourceVersionId === mainResumeVersionId ? undefined : result.sourceVersionId);
  }

  async function rerunResumeOptimization(input: ResumeDiagnosisSelection) {
    const result = currentResumeOptimizationResult;
    if (!result) return;
    const optimized = await runResumeOptimization({
      resumeContent: result.before,
      diagnosis: input.diagnosis,
      selectedIssueIds: input.selectedIssueIds,
      additionalDirection: input.additionalDirection,
      locale: document.documentElement.lang === "en" ? "en" : "zh-CN",
    });
    setResumeOptimizationResult({
      ...result,
      after: optimized.draft,
      diagnosis: input.diagnosis,
      selectedIssueIds: input.selectedIssueIds,
      selectedIssues: input.diagnosis.issues.filter((issue) => input.selectedIssueIds.includes(issue.id)),
      additionalDirection: input.additionalDirection,
      acceptedChangeIds: undefined,
      editedValues: undefined,
      message: optimized.message,
      optimization: optimized.optimization,
    });
    setResumeOptimizationStage(1);
    setToast(optimized.message ?? optimizationT("review.draftReady"));
  }

  function openResumeOptimizationVersion() {
    if (!currentResumeOptimizationResult?.version) return;
    openResumeEditorFromMatch(currentResumeOptimizationResult.version.id);
  }

  function updatePipelineEntry(event: FormEvent<HTMLFormElement>): Promise<boolean> {
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
      return Promise.resolve(false);
    }

    return new Promise((resolve) => startTransition(async () => {
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
        resolve(true);
      } catch (error) {
        setToast(`投递信息保存失败：${formatRequestError(error)}`);
        resolve(false);
      }
    }));
  }

  function deletePipelineEntry(applicationId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/applications/${applicationId}`, { method: "DELETE" });
        if (!response.ok) {
          const message = (await response.text()) || response.statusText || `HTTP ${response.status}`;
          throw new Error(message);
        }
        setApplications((current) => current.filter((application) => application.id !== applicationId));
        setToast("已从投递跟进移除，岗位档案和资料仍保留。");
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

  const handleAgentApplicationChanged = useCallback((result: {
    job: JobView;
    application: ApplicationView;
  }) => {
    const job = normalizeJob(result.job);
    const application = normalizeApplication(result.application);
    setJobs((current) => current.some((item) => item.id === job.id)
      ? current.map((item) => item.id === job.id ? job : item)
      : [job, ...current]);
    setApplications((current) => current.some((item) => item.id === application.id)
      ? current.map((item) => item.id === application.id ? application : item)
      : [application, ...current]);
  }, []);

  const agentAssistant = (
    <AgentAssistant
      aiReady={isAiReady(aiSettings)}
      onOpenSettings={() => navigateTo("settings")}
      onApplicationChanged={handleAgentApplicationChanged}
    />
  );

  if (active === "library" && libraryTarget) {
    return (
      <>
          <CareerLibraryWorkspace
            data={libraryData}
            target={libraryTarget}
            onClose={closeLibraryTarget}
            onOpenResume={openResumeEditorFromMatch}
            onDeleteArtifact={deleteCareerArtifact}
            onRenameResumeArtifact={renameCareerResumeArtifact}
            onUpdateJobDescription={updateLibraryJobDescription}
            onUpdateInterviewPreparation={updateLibraryInterviewPreparation}
            onUpdateInterviewSession={updateLibraryInterviewSession}
            onDeleteInterviewSection={deleteLibraryInterviewSection}
            onRegenerateInterviewReport={regenerateLibraryInterviewReport}
          />
        {agentAssistant}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar active={active} hidden={isResumeEditor} onNavigate={navigateTo} />
      <AppTopbar
        active={active}
        hidden={isResumeEditor}
        headerMenu={headerMenu}
        setHeaderMenu={setHeaderMenu}
        followUpReminders={followUpReminders}
        dashboard={dashboard}
        resumeVersionCount={versions.length + (hasResumeContent(resume) ? 1 : 0)}
        provider={aiSettings?.aiProvider ?? "openai"}
        onNavigate={navigateTo}
        onStartTour={() => {
          setHeaderMenu(null);
          setFirstUseTourOpen(true);
        }}
      />

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
          {active !== "library" ? <AppPageHeader
            active={active}
            pageTitle={pageTitle}
            pageSubtitle={pageSubtitle}
            showResumeHeader={isResumeOptimizationResult}
            isPending={isPending}
            toast={toast}
            onAddApplication={() => setPipelineAddOpen(true)}
          /> : null}

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
            currentResumeOptimizationResult ? (
              <>
                <ResumeOptimizationResult
                  key={`${currentResumeOptimizationResult.version?.id ?? "new"}:${resumeOptimizationStage}`}
                  workflowLabels={[
                    optimizationT("review.workflowAnalyze"),
                    optimizationT("review.workflowReview"),
                    optimizationT("review.workflowSave"),
                  ]}
                  currentStep={resumeOptimizationStage}
                  onStepChange={(index) => {
                    if (index === 0) {
                      setResumeOptimizationPreviousStage(resumeOptimizationStage);
                      setResumeOptimizationStage(0);
                      setResumeDiagnosisDialogOpen(true);
                    } else if (index === 1) {
                      setResumeOptimizationStage(1);
                    } else if (resumeOptimizationStage !== 1) {
                      setResumeOptimizationStage(2);
                    }
                  }}
                  title={resumeOptimizationStage === 1
                    ? optimizationT("review.pageTitle")
                    : "AI优化简历完成"}
                  description={resumeOptimizationStage === 1
                    ? optimizationT("review.pageDescription")
                    : buildOptimizationDescription(
                        currentResumeOptimizationResult.before,
                        currentResumeOptimizationResult.savedContent ?? currentResumeOptimizationResult.after,
                        {
                          mode: "general",
                          meta: currentResumeOptimizationResult.optimization,
                        },
                      )}
                  before={currentResumeOptimizationResult.before}
                  after={resumeOptimizationStage === 2
                    ? currentResumeOptimizationResult.savedContent ?? currentResumeOptimizationResult.after
                    : currentResumeOptimizationResult.after}
                  summaryItems={buildOptimizationSummary(
                    currentResumeOptimizationResult.before,
                    resumeOptimizationStage === 2
                      ? currentResumeOptimizationResult.savedContent ?? currentResumeOptimizationResult.after
                      : currentResumeOptimizationResult.after,
                    {
                      mode: "general",
                      meta: currentResumeOptimizationResult.optimization,
                    },
                  )}
                  openEditorLabel="进入编辑器修改"
                  onOpenEditor={resumeOptimizationStage === 2 && currentResumeOptimizationResult.version
                    ? openResumeOptimizationVersion
                    : undefined}
                  review={resumeOptimizationStage === 1 ? {
                    issues: currentResumeOptimizationResult.selectedIssues ?? [],
                    initialAcceptedIds: currentResumeOptimizationResult.acceptedChangeIds,
                    initialEditedValues: currentResumeOptimizationResult.editedValues,
                    onSave: saveReviewedResume,
                    onCancel: cancelResumeReview,
                  } : undefined}
                />
                {resumeDiagnosisDialogOpen ? (
                  <ResumeDiagnosisDialog
                    open
                    resume={currentResumeOptimizationResult.before}
                    initialSelection={currentResumeOptimizationResult.diagnosis ? {
                      diagnosis: currentResumeOptimizationResult.diagnosis,
                      selectedIssueIds: currentResumeOptimizationResult.selectedIssueIds ?? [],
                      additionalDirection: currentResumeOptimizationResult.additionalDirection ?? "",
                    } : undefined}
                    onOpenChange={(open) => {
                      setResumeDiagnosisDialogOpen(open);
                      if (!open) {
                        setResumeOptimizationStage((current) =>
                          current === 0 ? resumeOptimizationPreviousStage : current,
                        );
                      }
                    }}
                    onOptimize={rerunResumeOptimization}
                  />
                ) : null}
              </>
            ) : (
              <ResumeWorkbench
                key={resumeEditorVersionId ?? "main-resume"}
                 resume={resume}
                 resumeUpdatedAt={resumeUpdatedAt}
                 mainResumeVersionId={mainResumeVersionId}
                setResume={setResume}
                saveResume={saveResume}
                versions={versions}
                initialResumeVersionId={resumeEditorVersionId}
                mode={resumeMode}
                onModeChange={setResumeMode}
                onEditorTargetChange={setResumeEditorVersionId}
                aiReady={isResumeImportAiReady(aiSettings)}
                optimizeAiReady={isAiReady(aiSettings)}
                optimizeResume={runResumeOptimization}
                onResumeOptimized={showResumeOptimizationResult}
                onOpenSettings={() => navigateTo("settings")}
                onDeleteMainResume={deleteMainResume}
                onDeleteVersion={deleteResumeVersion}
              />
            )
          )}
          {active === "match" && (
            <MatchView
              key={`${matchResetKey}:${matchVersionId ?? "input"}`}
               resume={resume}
               versions={versions}
               mainResumeVersionId={mainResumeVersionId}
              jobs={jobs}
              trackedJobIds={applications.map((application) => application.jobId)}
              targetVersionId={matchVersionId}
              runMatchOptimization={runMatchOptimization}
              onTrackJob={trackMatchedJob}
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
              key={interviewSessionId ?? interviewPreparationId ?? "setup"}
              versions={versions}
              resume={resume}
               mainResumeName={initialData.resume?.name ?? buildResumeDisplayName(resume, "原简历")}
               mainResumeVersionId={mainResumeVersionId}
              targetSessionId={interviewSessionId}
              targetPreparationId={interviewPreparationId}
              onSessionUpsert={upsertInterviewSession}
              onPreparationUpsert={upsertInterviewPreparation}
              onOpenResume={openResumeEditorFromMatch}
              aiReady={isAiReady(aiSettings)}
              aiMessage={aiReadinessMessage(aiSettings)}
              resumeImportAiReady={isResumeImportAiReady(aiSettings)}
              onOpenSettings={() => navigateTo("settings")}
              onStatus={setToast}
            />
          )}
          {active === "library" && (
            <CareerLibraryView
              data={libraryData}
              group={libraryGroup}
              onGroupChange={changeLibraryGroup}
              onOpenJob={(id) => openLibraryTarget({ type: "job", id })}
              onUpdateJob={updateLibraryJobIdentity}
              onDeleteJob={deleteJobArchive}
              onOpenArtifact={(artifact) => openLibraryTarget({ type: "artifact", kind: artifact.kind, id: artifact.id })}
              onDeleteArtifact={deleteCareerArtifact}
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
      {agentAssistant}
      {firstUseTourOpen ? (
        <FirstUseTour
          active={active}
          aiReady={isAiReady(aiSettings)}
          onNavigate={navigateTo}
          onFinish={finishFirstUseTour}
        />
      ) : null}
    </div>
  );
}








function normalizeJob(job: JobView): JobView {
  return {
    ...job,
    deadline: job.deadline ? String(job.deadline).slice(0, 10) : null,
  };
}

function normalizeApplication(application: ApplicationView): ApplicationView {
  return {
    ...application,
    interviewRound: normalizeInterviewRound(application.interviewRound ?? ""),
    appliedAt: application.appliedAt ? String(application.appliedAt).slice(0, 10) : null,
    stageDate: application.stageDate ? String(application.stageDate).slice(0, 10) : null,
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

function readResumeVersionIdFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/resume/edit") return undefined;
  return new URLSearchParams(window.location.search).get("version") ?? undefined;
}

function readResumeOptimizationVersionIdFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/resume") return undefined;
  return new URLSearchParams(window.location.search).get("optimized") ?? undefined;
}

function readMatchVersionIdFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/match") return undefined;
  return new URLSearchParams(window.location.search).get("version") ?? undefined;
}

function readInterviewSessionIdFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/interview") return undefined;
  return new URLSearchParams(window.location.search).get("session") ?? undefined;
}

function readInterviewPreparationIdFromLocation() {
  if (typeof window === "undefined" || window.location.pathname !== "/interview") return undefined;
  return new URLSearchParams(window.location.search).get("preparation") ?? undefined;
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

function readStoredOptimizationBase(content: ResumeContent) {
  const base = (content as ResumeContent & { _tailoringBaseResume?: unknown })._tailoringBaseResume;
  return isResumeContentRecord(base) ? base : null;
}

function readStoredOptimizationMeta(content: ResumeContent): ResumeOptimizationMeta | undefined {
  const value = (content as ResumeContent & { _optimizationMeta?: unknown })._optimizationMeta;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Partial<ResumeOptimizationMeta>;
  return {
    company: typeof record.company === "string" ? record.company : "",
    title: typeof record.title === "string" ? record.title : "",
    keywords: Array.isArray(record.keywords) ? record.keywords.filter((item): item is string => typeof item === "string") : [],
    summary: typeof record.summary === "string" ? record.summary : "",
    changes: Array.isArray(record.changes) ? record.changes.filter((item): item is string => typeof item === "string") : [],
    versionName: typeof record.versionName === "string" ? record.versionName : "",
  };
}

function isResumeContentRecord(value: unknown): value is ResumeContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<ResumeContent>;
  return Boolean(record.basics && record.profile && Array.isArray(record.projects) && Array.isArray(record.skills));
}

function cleanOptimizationLabel(value?: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (/待|未知|未识别|目标公司|目标岗位/.test(text)) return "";
  return text.length > 100 ? "" : text;
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
