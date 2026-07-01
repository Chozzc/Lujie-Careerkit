"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Edit3, FileCheck2, FileText, ListChecks, Target, WandSparkles } from "lucide-react";

import type { RedactedAiSettings } from "@/lib/ai/settings";
import { aiReadinessMessage, isAiReady, isResumeImportAiReady } from "@/lib/ai/readiness";
import { contentToJadeResume } from "@/lib/resume-adapter";
import { hasResumeContent } from "@/lib/resume-library";
import {
  buildUploadedResumeDraft,
  isResumeContentLike,
  type UploadedResumeDraft,
} from "@/lib/resume-upload";
import { buildOptimizedResumeVersionName, normalizeOptimizedResumeVersionName } from "@/lib/resume-versioning";
import type { ApplicationPriority, ApplicationStatus, InterviewRound, JobAnalysis, ResumeContent } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AiSetupRequiredDialog,
  PreparationOptionCard,
  RESUME_IMPORT_AI_SETUP_MESSAGE,
  ResumeJdPreparation,
} from "@/components/resume/resume-jd-preparation";
import { ZoomableResumeCanvas } from "@/components/preview/zoomable-resume-canvas";
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
  message?: string;
};

type ResumeDiffSection = {
  key: string;
  title: string;
  previewTitles: string[];
  detail: string;
};

const defaultMatchPreferences: MatchOptimizationPreferences = {
  emphasizeImpact: true,
  quantifyResults: true,
  atsFriendly: true,
  highlightMatchedSkills: true,
};

export function resumeVersionDisplayName(version: MatchResumeVersionView, job?: MatchJobView) {
  if (!version.jobId) return version.name;
  const baseResume = readTailoringBaseResume(version.content);
  return job && baseResume
    ? buildOptimizedResumeVersionName(baseResume, job.title)
    : normalizeOptimizedResumeVersionName(version.name);
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

function buildSyntheticJobForVersion(version: MatchResumeVersionView): MatchJobView {
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
