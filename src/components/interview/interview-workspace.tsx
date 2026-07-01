"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  LoaderCircle,
  MessagesSquare,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";

import type { ResumePickerOption } from "@/components/resume-source-picker";
import {
  AiSetupRequiredDialog,
  PreparationOptionCard,
  RESUME_IMPORT_AI_SETUP_MESSAGE,
  ResumeJdPreparation,
} from "@/components/resume-jd-preparation";
import { SpeechTextarea } from "@/components/speech-textarea";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  createInterviewRetryInput,
  interviewQuestionNavTitle,
  screenForInterviewSession,
  type InterviewAnswer,
  type InterviewMode,
  type InterviewReport,
} from "@/lib/interview";
import type { InterviewSessionRecord } from "@/lib/interview-service";
import { inferJobIdentity } from "@/lib/job-identity";
import { buildUploadedResumeDraft, isResumeContentLike, type UploadedResumeDraft } from "@/lib/resume-upload";
import type { ResumeContent } from "@/lib/types";
import { cn } from "@/lib/utils";

type InterviewResumeVersion = {
  id: string;
  jobId: string | null;
  name: string;
  content: ResumeContent;
  updatedAt: string;
};

type InterviewScreen = "setup" | "session" | "report";
type SaveState = "idle" | "saving" | "saved" | "error";

const MODE_OPTIONS = [
  { value: "comprehensive", label: "综合模拟", description: "8 题，覆盖完整校招流程", icon: ListChecks },
  { value: "project", label: "项目深挖", description: "6 题，验证项目真实性与取舍", icon: BriefcaseBusiness },
  { value: "behavioral", label: "行为面试", description: "6 题，集中练习 STAR 表达", icon: MessagesSquare },
  { value: "hr", label: "HR 面", description: "6 题，练习动机、规划与反问", icon: UserRound },
];

const CATEGORY_LABELS: Record<string, string> = {
  general: "历史题目",
  "self-introduction": "自我介绍",
  motivation: "岗位动机",
  project: "项目深挖",
  professional: "专业能力",
  behavioral: "行为面试",
  failure: "失败复盘",
  "reverse-question": "反问",
  hr: "HR 面",
};

export function InterviewWorkspace({
  versions,
  resume,
  mainResumeName,
  targetSessionId,
  onSessionUpsert,
  onOpenResume,
  aiReady,
  aiMessage,
  resumeImportAiReady,
  onOpenSettings,
  onStatus,
}: {
  versions: InterviewResumeVersion[];
  resume: ResumeContent;
  mainResumeName: string;
  targetSessionId?: string;
  onSessionUpsert: (session: InterviewSessionRecord) => void;
  onOpenResume: (versionId?: string) => void;
  aiReady: boolean;
  aiMessage: string;
  resumeImportAiReady: boolean;
  onOpenSettings: () => void;
  onStatus: (message: string) => void;
}) {
  const [screen, setScreen] = useState<InterviewScreen>("setup");
  const [activeSession, setActiveSession] = useState<InterviewSessionRecord | null>(null);
  const [resumeSource, setResumeSource] = useState<"library" | "upload">("library");
  const [selectedResumeId, setSelectedResumeId] = useState("main");
  const [uploadedResume, setUploadedResume] = useState<UploadedResumeDraft | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [jdDraft, setJdDraft] = useState("");
  const [mode, setMode] = useState<InterviewMode>("comprehensive");
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [aiSetupDialogOpen, setAiSetupDialogOpen] = useState(false);
  const [aiSetupDialogMode, setAiSetupDialogMode] = useState<"ai" | "resumeImport">("ai");
  const pendingResumeUploadRef = useRef<File | null>(null);
  const resumeUploadOpenerRef = useRef<(() => void) | null>(null);
  const localResumeImportFallbackRef = useRef(false);

  const resumeOptions = useMemo<ResumePickerOption[]>(() => {
    const options: ResumePickerOption[] = [];
    if (hasResumeContent(resume)) {
      options.push({
        id: "main",
        name: mainResumeName,
        detail: `原简历 · ${resume.skills.length} 项技能 · ${resume.projects.length} 个项目`,
      });
    }
    for (const version of versions) {
      options.push({
        id: version.id,
        name: version.name,
        detail: `${version.jobId ? "优化后简历" : "原简历"} · ${formatDate(version.updatedAt)}`,
      });
    }
    return options;
  }, [mainResumeName, resume, versions]);
  const selectedResumeOption = resumeOptions.find((option) => option.id === selectedResumeId) ?? resumeOptions[0];
  const selectedLibraryId = selectedResumeOption?.id;
  const selectedVersion = versions.find((version) => version.id === selectedLibraryId);
  const selectedResume =
    resumeSource === "upload" ? uploadedResume?.content : selectedLibraryId === "main" ? resume : selectedVersion?.content;
  const selectedResumeName =
    resumeSource === "upload"
      ? uploadedResume?.fileName ?? "上传简历"
      : selectedResumeOption?.name ?? mainResumeName;
  const canStart = Boolean(selectedResume && hasResumeContent(selectedResume) && jdDraft.trim().length >= 10 && !isWorking && !isUploadingResume);
  const activeQuestion = activeSession?.questions[activeSession.currentQuestionIndex];
  const report = activeSession?.feedback ?? null;

  useEffect(() => {
    if (resumeSource !== "library") return undefined;
    if (!resumeOptions.length) return undefined;
    if (resumeOptions.some((option) => option.id === selectedResumeId)) return undefined;

    const frame = window.requestAnimationFrame(() => {
      setSelectedResumeId(resumeOptions[0].id);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resumeOptions, resumeSource, selectedResumeId]);

  const fetchSession = useCallback(async (sessionId: string) => {
    setIsWorking(true);
    setMessage("正在恢复面试记录...");
    try {
      const result = await requestJson<{ session: InterviewSessionRecord }>(`/api/interviews/${sessionId}`);
      setActiveSession(result.session);
      onSessionUpsert(result.session);
      setScreen(screenForInterviewSession(result.session));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "面试记录恢复失败。");
      setScreen("setup");
    } finally {
      setIsWorking(false);
    }
  }, [onSessionUpsert]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = targetSessionId ?? new URLSearchParams(window.location.search).get("session");
    if (!sessionId) return;
    const timeout = window.setTimeout(() => void fetchSession(sessionId), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchSession, targetSessionId]);

  const persistProgress = useCallback(async (sessionId: string, input: { answer?: InterviewAnswer; currentQuestionIndex?: number }) => {
    const result = await requestJson<{ session: InterviewSessionRecord }>(`/api/interviews/${sessionId}`, input, "PATCH");
    setActiveSession(result.session);
    onSessionUpsert(result.session);
    return result.session;
  }, [onSessionUpsert]);

  useEffect(() => {
    if (!activeSession || activeSession.status === "COMPLETED" || !activeQuestion) return;
    const draft = draftAnswers[activeQuestion.id];
    const stored = activeSession.answers[activeQuestion.id]?.content ?? "";
    if (draft === undefined || draft === stored) return;
    const timeout = window.setTimeout(() => {
      const answer = buildAnswer(activeQuestion.id, draft, false);
      void persistProgress(activeSession.id, {
        answer,
      })
        .then(() => setSaveState("saved"))
        .catch((error) => {
          setSaveState("error");
          setMessage(error instanceof Error ? error.message : "回答保存失败，请重试。");
        });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [activeQuestion, activeSession, draftAnswers, persistProgress]);

  async function uploadResume(file: File, options: { preferLocalFallback?: boolean } = {}) {
    setUploadError("");
    const preferLocalFallback = options.preferLocalFallback || localResumeImportFallbackRef.current;
    if (!resumeImportAiReady && !preferLocalFallback) {
      pendingResumeUploadRef.current = file;
      setAiSetupDialogMode("resumeImport");
      setAiSetupDialogOpen(true);
      return;
    }

    setIsUploadingResume(true);
    setMessage(preferLocalFallback ? "正在使用本地解析，效果可能不佳..." : "正在解析简历，可能需要一些时间...");
    try {
      const draft = await buildUploadedResumeDraft(file, { ...options, preferLocalFallback });
      setUploadedResume(draft);
      setResumeSource("upload");
      setMessage(`简历解析已完成，已导入 ${draft.fileName}。`);
    } catch (error) {
      setUploadedResume(null);
      setUploadError(error instanceof Error ? error.message : "文件读取失败。");
      setMessage("");
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
      void uploadResume(file, { preferLocalFallback: true });
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

  async function createSession(input: ReturnType<typeof createInterviewRetryInput>, loadingMessage: string) {
    setIsWorking(true);
    setMessage(loadingMessage);
    try {
      const result = await requestJson<{ session: InterviewSessionRecord }>("/api/interviews", input);
      onSessionUpsert(result.session);
      setActiveSession(result.session);
      setDraftAnswers({});
      setSaveState("idle");
      setScreen("session");
      setMessage("");
      onStatus("模拟面试题已生成，回答会自动保存。");
      window.history.pushState(null, "", `/interview?session=${encodeURIComponent(result.session.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "问题生成失败，请稍后重试。");
    } finally {
      setIsWorking(false);
    }
  }

  async function startInterview() {
    if (!selectedResume) return;
    if (!aiReady) {
      setAiSetupDialogMode("ai");
      setAiSetupDialogOpen(true);
      return;
    }
    const identity = inferJobIdentity(jdDraft);
    await createSession(
      {
        jobId: "",
        resumeVersionId:
          resumeSource === "library" && selectedResumeId !== "main" ? selectedResumeId : null,
        mode,
        context: {
          company: identity.company,
          title: identity.title,
          jd: jdDraft.trim(),
          resumeName: selectedResumeName,
          resume: selectedResume,
        },
      },
      "正在结合 JD 和简历生成本轮问题...",
    );
  }

  async function moveToQuestion(index: number, skipped = false) {
    if (!activeSession || !activeQuestion) return;
    const draft = draftAnswers[activeQuestion.id] ?? activeSession.answers[activeQuestion.id]?.content ?? "";
    setIsWorking(true);
    try {
      const next = await persistProgress(activeSession.id, {
        answer: buildAnswer(activeQuestion.id, skipped ? "" : draft, skipped),
        currentQuestionIndex: index,
      });
      setActiveSession(next);
      setSaveState("saved");
      setMessage("");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "回答保存失败，请重试。");
    } finally {
      setIsWorking(false);
    }
  }

  async function finishInterview() {
    if (!activeSession || !activeQuestion) return;
    const draft = draftAnswers[activeQuestion.id] ?? activeSession.answers[activeQuestion.id]?.content ?? "";
    setIsWorking(true);
    setMessage("正在保存最后一个回答...");
    try {
      await persistProgress(activeSession.id, {
        answer: buildAnswer(activeQuestion.id, draft, false),
        currentQuestionIndex: activeSession.currentQuestionIndex,
      });
      setMessage("AI 正在综合本轮回答生成复盘报告...");
      const result = await requestJson<{ session: InterviewSessionRecord }>(
        `/api/interviews/${activeSession.id}/report`,
        {},
      );
      setActiveSession(result.session);
      onSessionUpsert(result.session);
      setScreen("report");
      setMessage("");
      onStatus("面试复盘报告已生成并保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "报告生成失败，回答已保留，可以重试。");
    } finally {
      setIsWorking(false);
    }
  }

  async function saveAndReturnToSetup() {
    if (!activeSession || !activeQuestion) {
      returnToSetup();
      return;
    }
    const draft = draftAnswers[activeQuestion.id] ?? activeSession.answers[activeQuestion.id]?.content ?? "";
    setIsWorking(true);
    try {
      await persistProgress(activeSession.id, {
        answer: buildAnswer(activeQuestion.id, draft, false),
        currentQuestionIndex: activeSession.currentQuestionIndex,
      });
      openSetupFromSession(activeSession);
      onStatus("本题回答已保存，可以稍后继续。");
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "回答保存失败，请重试。");
    } finally {
      setIsWorking(false);
    }
  }

  function returnToSetup() {
    setScreen("setup");
    setActiveSession(null);
    setDraftAnswers({});
    setMessage("");
    window.history.pushState(null, "", "/interview");
  }

  function openSetupFromSession(session: InterviewSessionRecord) {
    setJdDraft(session.context.jd);
    setMode(session.mode);
    const storedVersion = session.resumeVersionId ? versions.find((version) => version.id === session.resumeVersionId) : null;
    const libraryResume = storedVersion?.content ?? (session.resumeVersionId ? null : resume);
    if (libraryResume && JSON.stringify(libraryResume) === JSON.stringify(session.context.resume)) {
      setResumeSource("library");
      setSelectedResumeId(storedVersion?.id ?? "main");
    } else if (isResumeContentLike(session.context.resume)) {
      setUploadedResume({
        fileName: `${session.context.resumeName}（历史快照）`,
        content: session.context.resume,
        characterCount: JSON.stringify(session.context.resume).length,
      });
      setResumeSource("upload");
    } else {
      setResumeSource("library");
      setSelectedResumeId("main");
    }
    returnToSetup();
  }

  async function practiceAgain() {
    if (!activeSession) return;
    if (!aiReady) {
      setAiSetupDialogMode("ai");
      setAiSetupDialogOpen(true);
      return;
    }
    await createSession(
      createInterviewRetryInput(activeSession),
      "正在沿用本轮素材生成一组新问题...",
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkflowStepper
        labels={["选择面试素材", "模拟提问与回答", "AI 反馈复盘"]}
        current={{ setup: 0, session: 1, report: 2 }[screen]}
      />
      {screen === "setup" ? (
        <SetupScreen
          resumeSource={resumeSource}
          selectedResumeId={selectedLibraryId}
          resumeOptions={resumeOptions}
          uploadedResume={uploadedResume}
          uploadError={uploadError}
          isUploadingResume={isUploadingResume}
          onResumeSourceChange={setResumeSource}
          onResumeSelect={setSelectedResumeId}
          onResumeUploadRequest={requestResumeUpload}
          onUploadResume={(file) => void uploadResume(file)}
          onOpenResume={onOpenResume}
          jdDraft={jdDraft}
          onJdChange={setJdDraft}
          mode={mode}
          onModeChange={setMode}
          canStart={canStart}
          isWorking={isWorking}
          message={message}
          onStart={() => void startInterview()}
          onMessage={setMessage}
        />
      ) : null}
      {screen === "session" && activeSession ? (
        <SessionScreen
          session={activeSession}
          activeQuestion={activeQuestion}
          draftAnswers={draftAnswers}
          onDraftChange={(questionId, value) => {
            setDraftAnswers((current) => ({ ...current, [questionId]: value }));
            setSaveState("saving");
          }}
          saveState={saveState}
          isWorking={isWorking}
          message={message}
          onMove={(index, skipped) => void moveToQuestion(index, skipped)}
          onFinish={() => void finishInterview()}
          onBack={() => void saveAndReturnToSetup()}
        />
      ) : null}
      {screen === "report" && activeSession ? (
        <ReportScreen
          session={activeSession}
          report={report}
          isWorking={isWorking}
          message={message}
          onPracticeAgain={() => void practiceAgain()}
          onReturn={() => openSetupFromSession(activeSession)}
        />
      ) : null}
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

function SetupScreen(props: {
  resumeSource: "library" | "upload";
  selectedResumeId?: string;
  resumeOptions: ResumePickerOption[];
  uploadedResume: UploadedResumeDraft | null;
  uploadError: string;
  isUploadingResume: boolean;
  onResumeSourceChange: (source: "library" | "upload") => void;
  onResumeSelect: (id: string) => void;
  onResumeUploadRequest: (openFileDialog: () => void) => void;
  onUploadResume: (file: File) => void;
  onOpenResume: (versionId?: string) => void;
  jdDraft: string;
  onJdChange: (value: string) => void;
  mode: InterviewMode;
  onModeChange: (mode: InterviewMode) => void;
  canStart: boolean;
  isWorking: boolean;
  message: string;
  onStart: () => void;
  onMessage: (message: string) => void;
}) {
  return (
    <ResumeJdPreparation
      resumePicker={{
        description: `选择本轮回答所依据的简历 · 共 ${props.resumeOptions.length} 份`,
        source: props.resumeSource,
        selectedId: props.selectedResumeId,
        options: props.resumeOptions,
        uploadedResume: props.uploadedResume,
        uploadError: props.uploadError,
        isUploading: props.isUploadingResume,
        onSourceChange: props.onResumeSourceChange,
        onSelect: props.onResumeSelect,
        onUploadRequest: props.onResumeUploadRequest,
        onUploadFile: props.onUploadResume,
        onOpenResume: (id) => props.onOpenResume(id === "main" ? undefined : id),
      }}
      title="填写目标 JD"
      description="粘贴完整的岗位职责、任职要求与能力要求，录阶会结合所选简历生成本轮模拟问题。"
      jdLabel="职位描述 / 任职要求 / 加分项 *"
      jdValue={props.jdDraft}
      onJdChange={props.onJdChange}
      jdPlaceholder="粘贴目标 JD，或描述岗位方向、主要职责、能力要求与业务场景..."
      settingsTitle="面试设置"
      settingsDescription="选择本轮面试侧重点；问题生成后保持固定，不会在作答过程中改变。"
      onJdImportStatus={props.onMessage}
      settings={
        <div className="grid w-full gap-4 md:grid-cols-2">
          {MODE_OPTIONS.map((option) => (
            <PreparationOptionCard
              key={option.value}
              checked={props.mode === option.value}
              icon={option.icon}
              label={option.label}
              description={option.description}
              onChange={() => props.onModeChange(option.value as InterviewMode)}
            />
          ))}
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">{props.message || "AI 将结合所选简历与这段岗位描述生成本轮问题。"}</p>
          <Button size="lg" disabled={!props.canStart} onClick={props.onStart} title={props.canStart ? undefined : "请先选择简历并填写至少 10 个字的 JD。"}>
            {props.isWorking ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
            {props.isWorking ? "正在生成问题" : "生成题目并开始"}
          </Button>
        </div>
      }
      notice={null}
    />
  );
}

function SessionScreen({
  session,
  activeQuestion,
  draftAnswers,
  onDraftChange,
  saveState,
  isWorking,
  message,
  onMove,
  onFinish,
  onBack,
}: {
  session: InterviewSessionRecord;
  activeQuestion?: InterviewSessionRecord["questions"][number];
  draftAnswers: Record<string, string>;
  onDraftChange: (questionId: string, value: string) => void;
  saveState: SaveState;
  isWorking: boolean;
  message: string;
  onMove: (index: number, skipped?: boolean) => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  if (!activeQuestion) return <div className="rounded-lg border border-line bg-surface p-6">这次练习没有可用题目。</div>;
  const index = session.currentQuestionIndex;
  const value = draftAnswers[activeQuestion.id] ?? session.answers[activeQuestion.id]?.content ?? "";
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_18px_50px_rgba(49,48,48,0.05)]">
      <div className="grid min-h-[650px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-line bg-surface-low p-5 lg:border-r lg:border-b-0">
          <div className="flex flex-col gap-1">
            <Badge variant="outline">{MODE_OPTIONS.find((item) => item.value === session.mode)?.label}</Badge>
            <h2 className="mt-2 text-sm font-semibold">{session.context.company} · {session.context.title}</h2>
            <p className="text-xs text-muted-foreground">{session.context.resumeName}</p>
          </div>
          <Separator className="my-4" />
          <nav className="flex flex-col gap-2" aria-label="面试问题列表">
            {session.questions.map((question, questionIndex) => {
              const answer = session.answers[question.id];
              return (
                <button
                  type="button"
                  key={question.id}
                  onClick={() => onMove(questionIndex)}
                  disabled={isWorking}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition",
                    questionIndex === index ? "border-brand bg-brand-muted text-brand" : "border-line bg-background hover:border-brand/40",
                  )}
                >
                  <span className="min-w-0 font-serif text-base leading-6 font-semibold" title={question.prompt}>
                    {questionIndex + 1}. {interviewQuestionNavTitle(question)}
                  </span>
                  {answer?.skipped ? <Badge variant="secondary">跳过</Badge> : answer?.content.trim() ? <CheckCircle2 className="shrink-0 text-brand" /> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 lg:px-7">
            <div className="text-sm text-muted-foreground">问题 {index + 1} / {session.questions.length} · {CATEGORY_LABELS[activeQuestion.category]}</div>
            <div className={cn("text-xs", saveState === "error" ? "text-destructive" : "text-muted-foreground")}>{saveStateLabel(saveState)}</div>
          </header>
          <div className="flex flex-1 flex-col gap-5 p-5 lg:p-7">
            <div>
              <h2 className="max-w-4xl font-serif text-2xl leading-10 font-semibold">{activeQuestion.prompt}</h2>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-low px-4 py-3 text-sm leading-6 text-muted-foreground">
                <Target className="mt-1 size-4 shrink-0 text-brand" />
                <span>面试官关注：{activeQuestion.focus}</span>
              </div>
            </div>
            <label className="flex flex-1 flex-col gap-2 text-xs font-medium text-muted-foreground">
              <span>你的回答</span>
              <SpeechTextarea
                value={value}
                onValueChange={(nextValue) => onDraftChange(activeQuestion.id, nextValue)}
                speechSeparator=" "
                placeholder="输入你的回答。本阶段不展示 AI 评分，避免打断模拟节奏。"
                maxLength={6000}
                wrapperClassName="flex flex-1 flex-col"
                className="min-h-64 flex-1 resize-y bg-surface-low text-sm leading-7"
              />
              <span className="self-end font-normal">{value.length} / 6000</span>
            </label>
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
          </div>
          <footer className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7">
            <Button variant="outline" disabled={index === 0 || isWorking} onClick={() => onMove(index - 1)}>
              <ArrowLeft data-icon="inline-start" />上一题
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" disabled={isWorking} onClick={onBack}>保存并退出</Button>
              <Button variant="outline" disabled={isWorking} onClick={() => onMove(Math.min(index + 1, session.questions.length - 1), true)}>稍后回答</Button>
              {index < session.questions.length - 1 ? (
                <Button disabled={isWorking} onClick={() => onMove(index + 1)}>
                  保存并下一题<ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <Button disabled={isWorking} onClick={onFinish}>
                  {isWorking ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <ClipboardCheck data-icon="inline-start" />}
                  结束本轮并生成复盘
                </Button>
              )}
            </div>
          </footer>
        </main>
      </div>
    </section>
  );
}

function ReportScreen({
  session,
  report,
  isWorking,
  message,
  onPracticeAgain,
  onReturn,
}: {
  session: InterviewSessionRecord;
  report: InterviewReport | null;
  isWorking: boolean;
  message: string;
  onPracticeAgain: () => void;
  onReturn: () => void;
}) {
  if (!report) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="font-serif text-xl font-semibold">历史面试反馈</h2>
        <div className="mt-4 flex flex-col gap-3">
          {Object.entries(session.legacyFeedback ?? {}).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-surface-low p-4">
              <p className="text-sm font-semibold">{key}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{value}</p>
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-5" onClick={onReturn}>调整素材</Button>
      </section>
    );
  }
  const dimensions = [
    ["岗位匹配", report.dimensions.jobFit],
    ["表达结构", report.dimensions.structure],
    ["事实证据", report.dimensions.evidence],
    ["STAR 完整", report.dimensions.star],
  ] as const;
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(49,48,48,0.05)] lg:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <Badge variant="outline">报告已自动保存</Badge>
            <h2 className="mt-3 font-serif text-2xl font-semibold">{session.context.company} · {session.context.title} 模拟面试复盘</h2>
            <p className="mt-2 text-sm text-muted-foreground">基于岗位 JD、{session.context.resumeName} 和本轮回答生成</p>
          </div>
          <div className="flex items-end gap-2"><span className="font-serif text-5xl font-semibold text-brand">{report.overallScore}</span><span className="pb-1 text-sm text-muted-foreground">/ 100</span></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dimensions.map(([label, score]) => (
            <div key={label} className="rounded-lg bg-surface-low px-4 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{score}</p></div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-5"><h3 className="text-base font-semibold">本轮优势</h3><ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">{report.strengths.map((item) => <li key={item}>· {item}</li>)}</ul></div>
        <div className="rounded-lg border border-line bg-surface p-5"><h3 className="text-base font-semibold">优先改进</h3><ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">{report.improvements.map((item) => <li key={item}>· {item}</li>)}</ul></div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5 lg:p-6">
        <h3 className="text-base font-semibold">逐题复盘</h3>
        <div className="mt-4 flex flex-col gap-3">
          {session.questions.map((question, index) => {
            const review = report.questionReviews.find((item) => item.questionId === question.id);
            const answer = session.answers[question.id];
            if (!review) return null;
            return (
              <details key={question.id} className="group rounded-lg border border-line bg-background p-4" open={index === 0}>
                <summary className="cursor-pointer list-none text-sm font-semibold">{index + 1}. {question.prompt}</summary>
                <div className="mt-4 grid gap-4 text-sm leading-6">
                  <ReportBlock label="你的回答" value={answer?.content.trim() || "未回答 / 跳过"} />
                  <ReportBlock label="问题诊断" value={review.diagnosis} />
                  <ReportBlock label="改进建议" value={review.suggestion} />
                  <ReportBlock label="参考表达" value={review.improvedAnswer} emphasized />
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div><h3 className="text-sm font-semibold">下一轮建议</h3><p className="mt-1 text-sm text-muted-foreground">{report.nextActions.join("；")}</p>{message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}</div>
        <div className="flex gap-2"><Button variant="outline" disabled={isWorking} onClick={onReturn}>调整素材</Button><Button disabled={isWorking} onClick={onPracticeAgain}>{isWorking ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}{isWorking ? "正在生成" : "再练一轮"}</Button></div>
      </section>
    </div>
  );
}

function ReportBlock({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return <div className={cn("rounded-lg bg-surface-low p-4", emphasized && "bg-brand-muted")}><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-foreground">{value}</p></div>;
}

function buildAnswer(questionId: string, content: string, skipped: boolean): InterviewAnswer {
  return { questionId, content, skipped, updatedAt: new Date().toISOString() };
}

function hasResumeContent(resume: ResumeContent) {
  return Boolean(resume.basics.name.trim() || resume.basics.email.trim() || resume.projects.length || resume.experiences.length || resume.internships.length);
}

function saveStateLabel(state: SaveState) {
  return { idle: "回答将在输入后自动保存", saving: "正在保存...", saved: "已自动保存", error: "保存失败，请重试" }[state];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN");
}

async function requestJson<T>(url: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!response.ok) throw new Error(payload?.message || `请求失败（${response.status}）`);
  if (!payload) throw new Error("服务未返回有效结果。");
  return payload;
}
