"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Edit3, FileCheck2, ListChecks, Target, WandSparkles } from "lucide-react";

import type { RedactedAiSettings } from "@/lib/ai/settings";
import { aiReadinessMessage, isAiReady, isResumeImportAiReady } from "@/lib/ai/readiness";
import { hasResumeContent } from "@/lib/resume-library";
import { buildResumeDisplayName } from "@/lib/resume-naming";
import {
  buildUploadedResumeDraft,
  isResumeContentLike,
  type UploadedResumeDraft,
} from "@/lib/resume-upload";
import { normalizeOptimizedResumeVersionName } from "@/lib/resume-versioning";
import type {
  ApplicationPriority,
  ApplicationStatus,
  InterviewRound,
  JobAnalysis,
  ResumeContent,
  ResumeOptimizationMeta,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AiSetupRequiredDialog,
  PreparationOptionCard,
  RESUME_IMPORT_AI_SETUP_MESSAGE,
  ResumeJdPreparation,
} from "@/components/resume/resume-jd-preparation";
import {
  ResumeOptimizationResult,
  buildOptimizationDescription,
  buildOptimizationSummary,
} from "@/components/resume/resume-optimization-result";
import { WorkflowStepper } from "@/components/shared/workflow-stepper";

export type MatchJobView = {
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

export type MatchApplicationView = {
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

export type MatchResumeVersionView = {
  id: string;
  jobId: string | null;
  name: string;
  summary: string;
  content: ResumeContent;
  createdAt: string;
  updatedAt: string;
};

export type MatchOptimizationRequest = {
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

export type MatchOptimizationResult = {
  job: MatchJobView;
  application: MatchApplicationView;
  analysis?: JobAnalysis;
  version?: MatchResumeVersionView;
  optimization?: ResumeOptimizationMeta;
  message?: string;
};

const defaultMatchPreferences: MatchOptimizationPreferences = {
  emphasizeImpact: true,
  quantifyResults: true,
  atsFriendly: true,
  highlightMatchedSkills: true,
};

export function resumeVersionDisplayName(version: MatchResumeVersionView) {
  if (!version.jobId) return version.name;
  return normalizeOptimizedResumeVersionName(version.name);
}

export function MatchView({
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
  versions: MatchResumeVersionView[];
  jobs: MatchJobView[];
  applications: MatchApplicationView[];
  targetVersionId?: string;
  runMatchOptimization: (input: MatchOptimizationRequest) => Promise<MatchOptimizationResult>;
  onOpenResume: (versionId?: string) => void;
  aiSettings: RedactedAiSettings | null;
  onOpenSettings: () => void;
}) {
  const aiReady = isAiReady(aiSettings);
  const aiMessage = aiReadinessMessage(aiSettings);
  const resumeImportAiReady = isResumeImportAiReady(aiSettings);
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
  const [aiSetupDialogMode, setAiSetupDialogMode] = useState<"ai" | "resumeImport">("ai");
  const [preferences, setPreferences] = useState<MatchOptimizationPreferences>(defaultMatchPreferences);
  const pendingResumeUploadRef = useRef<File | null>(null);
  const resumeUploadOpenerRef = useRef<(() => void) | null>(null);
  const localResumeImportFallbackRef = useRef(false);

  const resumeOptions = useMemo(() => {
    const options: Array<{ id: string; name: string; detail: string }> = [];
    if (hasResumeContent(resume)) {
      options.push({
        id: "main",
        name: buildResumeDisplayName(resume, "原简历"),
        detail: `原简历 · ${resume.skills.length} 项技能 · ${resume.projects.length} 个项目`,
      });
    }

    for (const version of versions) {
      const isOptimizedVersion = Boolean(version.jobId || readTailoringBaseResume(version.content));
      options.push({
        id: version.id,
        name: resumeVersionDisplayName(version),
        detail: `${isOptimizedVersion ? "优化后简历" : "原简历"} · ${new Date(version.updatedAt).toLocaleDateString("zh-CN")}`,
      });
    }

    return options;
  }, [resume, versions]);
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

  async function handleUploadFile(file: File, options: { preferLocalFallback?: boolean } = {}) {
    setUploadError("");
    const preferLocalFallback = options.preferLocalFallback || localResumeImportFallbackRef.current;
    if (!resumeImportAiReady && !preferLocalFallback) {
      pendingResumeUploadRef.current = file;
      setAiSetupDialogMode("resumeImport");
      setAiSetupDialogOpen(true);
      return;
    }

    setIsUploadingResume(true);
    setSaveStatus(preferLocalFallback ? "正在使用本地解析，效果可能不佳..." : "正在解析简历，可能需要一些时间...");
    try {
      const draft = await buildUploadedResumeDraft(file, { ...options, preferLocalFallback });
      setUploadedResume(draft);
      setResumeSource("upload");
      setSaveStatus(`简历解析已完成，已导入 ${draft.fileName}。`);
    } catch (error) {
      setUploadedResume(null);
      setUploadError(error instanceof Error ? error.message : "文件读取失败。");
      setSaveStatus("");
    } finally {
      localResumeImportFallbackRef.current = false;
      setIsUploadingResume(false);
    }
  }

  function requestResumeUpload(openFileDialog: () => void) {
    if (!resumeImportAiReady && !localResumeImportFallbackRef.current) {
      resumeUploadOpenerRef.current = openFileDialog;
      setAiSetupDialogMode("resumeImport");
      setAiSetupDialogOpen(true);
      return;
    }
    openFileDialog();
  }

  function continueResumeUploadWithLocalFallback() {
    const file = pendingResumeUploadRef.current;
    const openFileDialog = resumeUploadOpenerRef.current;
    pendingResumeUploadRef.current = null;
    resumeUploadOpenerRef.current = null;
    localResumeImportFallbackRef.current = true;
    if (file) {
      void handleUploadFile(file, { preferLocalFallback: true });
      return;
    }
    openFileDialog?.();
  }

  function openSettingsFromAiDialog() {
    pendingResumeUploadRef.current = null;
    resumeUploadOpenerRef.current = null;
    localResumeImportFallbackRef.current = false;
    onOpenSettings();
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
        optimization: readOptimizationMeta(version.content),
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
      setAiSetupDialogMode("ai");
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
    const resultMode = getMatchOptimizationMode(result);
    const isJdResult = resultMode === "jd";
    const resultMeta = result.optimization ?? readOptimizationMeta(result.version.content);

    return (
      <ResumeOptimizationResult
        workflowLabels={isJdResult ? ["选择简历与 JD", "AI 匹配优化", "预览并编辑"] : ["当前简历", "AI 简历优化", "预览并编辑"]}
        title={buildMatchResultTitle(result)}
        description={buildOptimizationDescription(resultBaseResume, optimizedDraft, {
          mode: resultMode,
          meta: resultMeta,
        })}
        before={resultBaseResume}
        after={optimizedDraft}
        summaryItems={buildOptimizationSummary(resultBaseResume, optimizedDraft, {
          mode: resultMode,
          analysis: result.analysis,
          meta: resultMeta,
        })}
        backLabel={isJdResult ? "返回修改 JD" : undefined}
        onBack={
          isJdResult
            ? () => {
                setScreen("input");
                setResult(null);
                setResultBaseResume(null);
                setOptimizedDraft(null);
                setSaveStatus("");
                window.history.pushState(null, "", "/match");
              }
            : undefined
        }
        onOpenEditor={() => onOpenResume(result.version?.id)}
      />
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
            onUploadRequest: requestResumeUpload,
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
        title={aiSetupDialogMode === "resumeImport" ? "需要配置阿里百炼" : undefined}
        message={aiSetupDialogMode === "resumeImport" ? RESUME_IMPORT_AI_SETUP_MESSAGE : aiMessage}
        secondaryLabel="稍后再说"
        onOpenChange={setAiSetupDialogOpen}
        onOpenSettings={aiSetupDialogMode === "resumeImport" ? openSettingsFromAiDialog : onOpenSettings}
        onSecondary={aiSetupDialogMode === "resumeImport" ? continueResumeUploadWithLocalFallback : undefined}
      />
    </div>
  );
}

function readTailoringBaseResume(content: ResumeContent) {
  const maybeBase = (content as ResumeContent & { _tailoringBaseResume?: unknown })._tailoringBaseResume;
  return isResumeContentLike(maybeBase) ? maybeBase : null;
}

function readOptimizationMeta(content: ResumeContent): ResumeOptimizationMeta | undefined {
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

function getMatchOptimizationMode(result: MatchOptimizationResult): "jd" | "general" {
  return result.version && !result.version.jobId && result.optimization ? "general" : "jd";
}

export function buildMatchResultTitle(result: MatchOptimizationResult) {
  if (getMatchOptimizationMode(result) === "general") return "AI优化简历完成";

  const company =
    cleanResultTitlePart(result.optimization?.company) ||
    cleanResultTitlePart(result.analysis?.company) ||
    cleanResultTitlePart(result.job.company);
  const title =
    cleanResultTitlePart(result.optimization?.title) ||
    cleanResultTitlePart(result.analysis?.title) ||
    cleanResultTitlePart(result.job.title);
  if (company && title) return `${company} · ${title}`;
  if (title) return `JD匹配优化 · ${title}`;
  return "JD匹配优化完成";
}

function cleanResultTitlePart(value?: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (/待|未知|未识别|目标公司|目标岗位/.test(text)) return "";
  return text.length > 32 ? "" : text;
}

function buildSyntheticJobForVersion(version: MatchResumeVersionView): MatchJobView {
  const isGeneralAiVersion = !version.jobId;
  return {
    id: version.jobId ?? `version-${version.id}`,
    company: isGeneralAiVersion ? "" : "本地优化版本",
    title: isGeneralAiVersion ? "" : version.name,
    city: "待填写",
    source: isGeneralAiVersion ? "AI简历优化" : "JD匹配优化",
    jd: version.summary || version.name,
    link: "",
    deadline: null,
    tags: [],
    analysis: null,
    createdAt: version.createdAt,
  };
}

function buildSyntheticApplicationForVersion(version: MatchResumeVersionView, jobId: string): MatchApplicationView {
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
