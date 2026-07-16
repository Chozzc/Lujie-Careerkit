"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ListChecks,
  LoaderCircle,
  MessagesSquare,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

import type { ResumePickerOption } from "@/components/resume/resume-source-picker";
import {
  AiSetupRequiredDialog,
  PreparationOptionCard,
  RESUME_IMPORT_AI_SETUP_MESSAGE,
  ResumeJdPreparation,
} from "@/components/resume/resume-jd-preparation";
import { SpeechTextarea } from "@/components/shared/speech-textarea";
import { WorkflowStepper } from "@/components/shared/workflow-stepper";
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
import type { InterviewPreparation, InterviewPreparationRecord } from "@/lib/interview-preparation";
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

type InterviewScreen = "setup" | "preparation" | "session" | "report";
type SaveState = "idle" | "saving" | "saved" | "error";

const MODE_OPTIONS = [
  { value: "comprehensive", labelKey: "modes.comprehensive.label", descriptionKey: "modes.comprehensive.description", icon: ListChecks },
  { value: "project", labelKey: "modes.project.label", descriptionKey: "modes.project.description", icon: BriefcaseBusiness },
  { value: "behavioral", labelKey: "modes.behavioral.label", descriptionKey: "modes.behavioral.description", icon: MessagesSquare },
  { value: "hr", labelKey: "modes.hr.label", descriptionKey: "modes.hr.description", icon: UserRound },
];

const CATEGORY_KEYS: Record<string, string> = {
  general: "categories.general",
  "self-introduction": "categories.selfIntroduction",
  motivation: "categories.motivation",
  project: "categories.project",
  professional: "categories.professional",
  behavioral: "categories.behavioral",
  failure: "categories.failure",
  "reverse-question": "categories.reverseQuestion",
  hr: "categories.hr",
};

const REQUIREMENT_LEVEL_VALUE = { core: 100, important: 70, bonus: 40 } as const;
const EVIDENCE_LEVEL_VALUE = { strong: 100, partial: 70, limited: 40, unknown: 15 } as const;
const PREPARATION_SECTION_IDS = [
  "prep-overview",
  "prep-capability",
  "prep-evidence",
  "prep-knowledge",
  "prep-deep-dives",
  "prep-questions",
  "prep-plan",
] as const;

export function InterviewWorkspace({
  versions,
  resume,
  mainResumeName,
  targetSessionId,
  targetPreparationId,
  onSessionUpsert,
  onPreparationUpsert,
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
  targetPreparationId?: string;
  onSessionUpsert: (session: InterviewSessionRecord) => void;
  onPreparationUpsert: (record: InterviewPreparationRecord) => void;
  onOpenResume: (versionId?: string) => void;
  aiReady: boolean;
  aiMessage: string;
  resumeImportAiReady: boolean;
  onOpenSettings: () => void;
  onStatus: (message: string) => void;
}) {
  const t = useTranslations("interview");
  const locale = useLocale();
  const [screen, setScreen] = useState<InterviewScreen>("setup");
  const [activeSession, setActiveSession] = useState<InterviewSessionRecord | null>(null);
  const [activePreparation, setActivePreparation] = useState<InterviewPreparationRecord | null>(null);
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
  const [setupTask, setSetupTask] = useState<"preparation" | "questions" | null>(null);
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
        detail: t("resume.mainDetail", { skills: resume.skills.length, projects: resume.projects.length }),
      });
    }
    for (const version of versions) {
      options.push({
        id: version.id,
        name: version.name,
        detail: t(version.jobId ? "resume.optimizedDetail" : "resume.originalDetail", {
          date: new Date(version.updatedAt).toLocaleDateString(locale),
        }),
      });
    }
    return options;
  }, [locale, mainResumeName, resume, t, versions]);
  const selectedResumeOption = resumeOptions.find((option) => option.id === selectedResumeId) ?? resumeOptions[0];
  const selectedLibraryId = selectedResumeOption?.id;
  const selectedVersion = versions.find((version) => version.id === selectedLibraryId);
  const selectedResume =
    resumeSource === "upload" ? uploadedResume?.content : selectedLibraryId === "main" ? resume : selectedVersion?.content;
  const selectedResumeName =
    resumeSource === "upload"
      ? uploadedResume?.fileName ?? t("resume.uploaded")
      : selectedResumeOption?.name ?? mainResumeName;
  const selectedResumeKey = resumeSource === "upload"
    ? `upload:${uploadedResume?.fileName ?? "resume"}`
    : selectedLibraryId ?? "main";
  const resumeReady = Boolean(selectedResume && hasResumeContent(selectedResume));
  const setupDisabledReason = !resumeReady
    ? t("setup.needResume")
    : !jdDraft.trim()
      ? t("setup.needJd")
      : "";
  const canStart = !setupDisabledReason && !isWorking && !isUploadingResume;
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
    setMessage(t("status.restoring"));
    try {
      const result = await requestJson<{ session: InterviewSessionRecord }>(`/api/interviews/${sessionId}`);
      setActiveSession(result.session);
      onSessionUpsert(result.session);
      setScreen(screenForInterviewSession(result.session));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("status.restoreFailed"));
      setScreen("setup");
    } finally {
      setIsWorking(false);
    }
  }, [onSessionUpsert, t]);

  const fetchPreparation = useCallback(async (preparationId: string) => {
    setIsWorking(true);
    setMessage(t("status.restoringPreparation"));
    try {
      const result = await requestJson<{ record: InterviewPreparationRecord }>(
        `/api/interviews/preparation/${preparationId}`,
      );
      setActivePreparation(result.record);
      onPreparationUpsert(result.record);
      setScreen("preparation");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("status.restorePreparationFailed"));
      setScreen("setup");
    } finally {
      setIsWorking(false);
    }
  }, [onPreparationUpsert, t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = targetSessionId ?? new URLSearchParams(window.location.search).get("session");
    if (!sessionId) return;
    const timeout = window.setTimeout(() => void fetchSession(sessionId), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchSession, targetSessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preparationId = targetPreparationId ?? new URLSearchParams(window.location.search).get("preparation");
    if (!preparationId) return;
    const timeout = window.setTimeout(() => void fetchPreparation(preparationId), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchPreparation, targetPreparationId]);

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
          setMessage(error instanceof Error ? error.message : t("status.answerSaveFailed"));
        });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [activeQuestion, activeSession, draftAnswers, persistProgress, t]);

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
    setMessage(preferLocalFallback ? t("status.localParsing") : t("status.parsing"));
    try {
      const draft = await buildUploadedResumeDraft(file, { ...options, preferLocalFallback });
      setUploadedResume(draft);
      setResumeSource("upload");
      setMessage(t("status.imported", { fileName: draft.fileName }));
    } catch (error) {
      setUploadedResume(null);
      setUploadError(error instanceof Error ? error.message : t("status.fileReadFailed"));
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
      onStatus(t("status.questionsGenerated"));
      window.history.pushState(null, "", `/interview?session=${encodeURIComponent(result.session.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("status.questionFailed"));
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
    setSetupTask("questions");
    try {
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
            resumeKey: selectedResumeKey,
            resume: selectedResume,
          },
        },
        t("status.generatingQuestions"),
      );
    } finally {
      setSetupTask(null);
    }
  }

  async function generatePreparation() {
    if (!selectedResume) return;
    if (!aiReady) {
      setAiSetupDialogMode("ai");
      setAiSetupDialogOpen(true);
      return;
    }
    const identity = inferJobIdentity(jdDraft);
    setSetupTask("preparation");
    setIsWorking(true);
    setMessage(t("status.generatingPreparation"));
    try {
      const result = await requestJson<{ record: InterviewPreparationRecord; message: string }>(
        "/api/interviews/preparation",
        {
          jobId: "",
          company: identity.company,
          title: identity.title,
          jd: jdDraft.trim(),
          resumeName: selectedResumeName,
          resumeKey: selectedResumeKey,
          resumeVersionId:
            resumeSource === "library" && selectedResumeId !== "main" ? selectedResumeId : null,
          resume: selectedResume,
          focus: mode,
          locale: locale === "en" ? "en" : "zh-CN",
        },
      );
      setActivePreparation(result.record);
      onPreparationUpsert(result.record);
      setScreen("preparation");
      setMessage("");
      onStatus(t("status.preparationGenerated"));
      window.history.pushState(null, "", `/interview?preparation=${encodeURIComponent(result.record.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("status.preparationFailed"));
    } finally {
      setSetupTask(null);
      setIsWorking(false);
    }
  }

  async function startInterviewFromPreparation() {
    if (!activePreparation) return;
    if (!aiReady) {
      setAiSetupDialogMode("ai");
      setAiSetupDialogOpen(true);
      return;
    }
    setSetupTask("questions");
    try {
      await createSession(
        {
          jobId: activePreparation.jobId,
          resumeVersionId: activePreparation.resumeVersionId,
          mode: activePreparation.mode,
          context: {
            company: activePreparation.context.company,
            title: activePreparation.context.title,
            jd: activePreparation.context.jd,
            resumeName: activePreparation.context.resumeName,
            resumeKey: activePreparation.resumeKey,
            resume: activePreparation.context.resume,
          },
        },
        t("status.generatingQuestions"),
      );
    } finally {
      setSetupTask(null);
    }
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
      setMessage(error instanceof Error ? error.message : t("status.answerSaveFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function finishInterview() {
    if (!activeSession || !activeQuestion) return;
    const draft = draftAnswers[activeQuestion.id] ?? activeSession.answers[activeQuestion.id]?.content ?? "";
    setIsWorking(true);
    setMessage(t("status.savingLastAnswer"));
    try {
      await persistProgress(activeSession.id, {
        answer: buildAnswer(activeQuestion.id, draft, false),
        currentQuestionIndex: activeSession.currentQuestionIndex,
      });
      setMessage(t("status.generatingReport"));
      const result = await requestJson<{ session: InterviewSessionRecord }>(
        `/api/interviews/${activeSession.id}/report`,
        {},
      );
      setActiveSession(result.session);
      onSessionUpsert(result.session);
      setScreen("report");
      setMessage("");
      onStatus(t("status.reportSaved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("status.reportFailed"));
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
      onStatus(t("status.answerSavedExit"));
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : t("status.answerSaveFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  function returnToSetup() {
    setScreen("setup");
    setActiveSession(null);
    setActivePreparation(null);
    setDraftAnswers({});
    setMessage("");
    window.history.pushState(null, "", "/interview");
  }

  function restoreSetupInputs(
    context: { jd: string; resumeName: string; resume: unknown },
    resumeVersionId: string | null,
    nextMode: InterviewMode,
  ) {
    setJdDraft(context.jd);
    setMode(nextMode);
    const storedVersion = resumeVersionId ? versions.find((version) => version.id === resumeVersionId) : null;
    const libraryResume = storedVersion?.content ?? (resumeVersionId ? null : resume);
    if (libraryResume && JSON.stringify(libraryResume) === JSON.stringify(context.resume)) {
      setResumeSource("library");
      setSelectedResumeId(storedVersion?.id ?? "main");
    } else if (isResumeContentLike(context.resume)) {
      setUploadedResume({
        fileName: t("resume.historySnapshot", { name: context.resumeName }),
        content: context.resume,
        characterCount: JSON.stringify(context.resume).length,
      });
      setResumeSource("upload");
    } else {
      setResumeSource("library");
      setSelectedResumeId("main");
    }
    returnToSetup();
  }

  function openSetupFromSession(session: InterviewSessionRecord) {
    restoreSetupInputs(session.context, session.resumeVersionId, session.mode);
  }

  function openSetupFromPreparation(preparation: InterviewPreparationRecord) {
    restoreSetupInputs(preparation.context, preparation.resumeVersionId, preparation.mode);
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
      t("status.retrying"),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkflowStepper
        labels={[t("steps.setup"), t("steps.preparation"), t("steps.session"), t("steps.report")]}
        current={{ setup: 0, preparation: 1, session: 2, report: 3 }[screen]}
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
          disabledReason={setupDisabledReason}
          setupTask={setupTask}
          message={message}
          onPrepare={() => void generatePreparation()}
          onStart={() => void startInterview()}
          onMessage={setMessage}
        />
      ) : null}
      {screen === "preparation" && activePreparation ? (
        <PreparationScreen
          preparation={activePreparation.content}
          resumeName={activePreparation.context.resumeName}
          isWorking={isWorking}
          message={message}
          onBack={() => openSetupFromPreparation(activePreparation)}
          onStart={() => void startInterviewFromPreparation()}
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
        title={aiSetupDialogMode === "resumeImport" ? t("aiSetup.title") : undefined}
        message={aiSetupDialogMode === "resumeImport" ? RESUME_IMPORT_AI_SETUP_MESSAGE : aiMessage}
        secondaryLabel={t("aiSetup.later")}
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
  disabledReason: string;
  setupTask: "preparation" | "questions" | null;
  message: string;
  onPrepare: () => void;
  onStart: () => void;
  onMessage: (message: string) => void;
}) {
  const t = useTranslations("interview");
  return (
    <ResumeJdPreparation
      resumePicker={{
        description: t("setup.resumePickerDescription", { count: props.resumeOptions.length }),
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
      title={t("setup.title")}
      description={t("setup.description")}
      jdLabel={t("setup.jdLabel")}
      jdValue={props.jdDraft}
      onJdChange={props.onJdChange}
      jdPlaceholder={t("setup.jdPlaceholder")}
      settingsTitle={t("setup.settingsTitle")}
      settingsDescription={t("setup.settingsDescription")}
      onJdImportStatus={props.onMessage}
      settings={
        <div className="grid w-full gap-4 md:grid-cols-2">
          {MODE_OPTIONS.map((option) => (
            <PreparationOptionCard
              key={option.value}
              checked={props.mode === option.value}
              icon={option.icon}
              label={t(option.labelKey)}
              description={t(option.descriptionKey)}
              onChange={() => props.onModeChange(option.value as InterviewMode)}
            />
          ))}
        </div>
      }
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">{props.message || props.disabledReason || t("setup.hint")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="lg" disabled={!props.canStart} onClick={props.onPrepare} title={props.disabledReason || undefined}>
              {props.setupTask === "preparation" ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <BookOpenCheck data-icon="inline-start" />}
              {props.setupTask === "preparation" ? t("setup.generatingPreparation") : t("setup.prepare")}
            </Button>
            <Button size="lg" disabled={!props.canStart} onClick={props.onStart} title={props.disabledReason || undefined}>
              {props.setupTask === "questions" ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
              {props.setupTask === "questions" ? t("setup.generating") : t("setup.start")}
            </Button>
          </div>
        </div>
      }
      notice={null}
    />
  );
}

function PreparationScreen({
  preparation,
  resumeName,
  isWorking,
  message,
  onBack,
  onStart,
}: {
  preparation: InterviewPreparation;
  resumeName: string;
  isWorking: boolean;
  message: string;
  onBack: () => void;
  onStart: () => void;
}) {
  const t = useTranslations("interview");
  const [activeSection, setActiveSection] = useState<(typeof PREPARATION_SECTION_IDS)[number]>(PREPARATION_SECTION_IDS[0]);

  useEffect(() => {
    const updateActiveSection = () => {
      const anchorOffset = 180;
      let current: (typeof PREPARATION_SECTION_IDS)[number] = PREPARATION_SECTION_IDS[0];

      for (const id of PREPARATION_SECTION_IDS) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= anchorOffset) current = id;
      }

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24) {
        current = PREPARATION_SECTION_IDS[PREPARATION_SECTION_IDS.length - 1];
      }
      setActiveSection(current);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, []);

  const stateLabels: Record<InterviewPreparation["evidenceMatrix"][number]["state"], string> = {
    direct: t("preparation.states.direct"),
    transferable: t("preparation.states.transferable"),
    "not-shown": t("preparation.states.notShown"),
    gap: t("preparation.states.gap"),
    confirm: t("preparation.states.confirm"),
  };
  const priorityLabels = {
    must: t("preparation.priorities.must"),
    should: t("preparation.priorities.should"),
    optional: t("preparation.priorities.optional"),
  };
  const requirementLabels = {
    core: t("preparation.requirementLevels.core"),
    important: t("preparation.requirementLevels.important"),
    bonus: t("preparation.requirementLevels.bonus"),
  };
  const evidenceLabels = {
    strong: t("preparation.evidenceLevels.strong"),
    partial: t("preparation.evidenceLevels.partial"),
    limited: t("preparation.evidenceLevels.limited"),
    unknown: t("preparation.evidenceLevels.unknown"),
  };
  const capabilityData = preparation.capabilityProfile.dimensions.map((dimension) => ({
    label: dimension.label,
    requirement: REQUIREMENT_LEVEL_VALUE[dimension.requirementLevel],
    evidence: EVIDENCE_LEVEL_VALUE[dimension.evidenceLevel],
  }));
  const tableOfContents = [
    ["prep-overview", t("preparation.sections.overview")],
    ["prep-capability", t("preparation.sections.capability")],
    ["prep-evidence", t("preparation.sections.evidence")],
    ["prep-knowledge", t("preparation.sections.knowledge")],
    ["prep-deep-dives", t("preparation.sections.deepDives")],
    ["prep-questions", t("preparation.sections.questions")],
    ["prep-plan", t("preparation.sections.plan")],
  ] as const;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="px-2 py-3 lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{t("preparation.tocTitle")}</p>
        <nav className="mt-3" aria-label={t("preparation.tocTitle")}>
          <ol className="space-y-1">
            {tableOfContents.map(([id, label], index) => (
              <li key={id}>
                <a
                  className={cn(
                    "flex gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
                    activeSection === id
                      ? "border-brand bg-brand-muted font-medium text-brand"
                      : "border-transparent text-muted-foreground hover:bg-surface-low hover:text-foreground",
                  )}
                  href={`#${id}`}
                  aria-current={activeSection === id ? "location" : undefined}
                  onClick={() => setActiveSection(id)}
                >
                  <span className="font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span>
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <main className="min-w-0 space-y-6">
        <section id="prep-overview" className="scroll-mt-24 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_18px_50px_rgba(49,48,48,0.05)]">
          <div className="border-b border-line bg-brand-muted/55 px-5 py-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <Badge variant="outline">{t("preparation.badge")}</Badge>
                <h2 className="mt-3 font-serif text-2xl font-semibold lg:text-3xl">
                  {preparation.meta.company} · {preparation.meta.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("preparation.basedOn", { resumeName })}</p>
              </div>
              <Badge variant="secondary">{preparation.meta.roleFamily}</Badge>
            </div>
          </div>
          <div className="px-5 py-6 lg:px-8">
            <PreparationSectionHeading number="01" title={t("preparation.sections.overview")} />
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{preparation.meta.roleSummary}</p>
            {preparation.meta.assumptions.length ? (
              <div className="mt-5 flex items-start gap-2 rounded-lg bg-surface-low px-4 py-3 text-sm leading-6 text-muted-foreground">
                <CircleAlert className="mt-1 size-4 shrink-0 text-brand" />
                <span>{preparation.meta.assumptions.join(t("report.separator"))}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section id="prep-capability" className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 lg:p-8">
          <PreparationSectionHeading number="02" title={t("preparation.capabilityTitle")} description={t("preparation.capabilityDescription")} />
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{preparation.capabilityProfile.overview}</p>
          <div className="mt-5 rounded-lg border border-line bg-background px-2 py-5 sm:px-5">
            <div className="h-[22rem] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={220}>
                <RadarChart data={capabilityData} margin={{ top: 24, right: 40, bottom: 24, left: 40 }}>
                  <PolarGrid stroke="#D8DDE5" />
                  <PolarAngleAxis dataKey="label" tick={{ fill: "#4B5563", fontSize: 12 }} />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: "1px solid #D8DDE5", fontSize: 12 }} />
                  <Radar name={t("preparation.jdRequirement")} dataKey="requirement" stroke="#315F92" fill="#315F92" fillOpacity={0.18} strokeWidth={2} />
                  <Radar name={t("preparation.resumeEvidenceLevel")} dataKey="evidence" stroke="#7A9B7A" fill="#9CB69C" fillOpacity={0.28} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#315F92]" />{t("preparation.jdRequirement")}</span>
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#9CB69C]" />{t("preparation.resumeEvidenceLevel")}</span>
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-5 text-muted-foreground">{t("preparation.capabilityNote")}</p>
          </div>
          <div className="mt-5 divide-y divide-line rounded-lg border border-line">
            {preparation.capabilityProfile.dimensions.map((dimension) => (
              <div key={dimension.label} className="grid gap-3 px-4 py-4 md:grid-cols-[9rem_minmax(0,1fr)] md:px-5">
                <div>
                  <p className="font-semibold">{dimension.label}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{requirementLabels[dimension.requirementLevel]}</Badge>
                    <Badge variant="secondary">{evidenceLabels[dimension.evidenceLevel]}</Badge>
                  </div>
                </div>
                <div className="text-sm leading-6 text-muted-foreground">
                  <p>{dimension.evidenceSummary}</p>
                  <p className="mt-1"><span className="font-medium text-foreground">{t("preparation.nextStep")}: </span>{dimension.nextStep}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="prep-evidence" className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 lg:p-8">
          <PreparationSectionHeading number="03" title={t("preparation.evidenceTitle")} description={t("preparation.evidenceDescription")} />
          <div className="mt-5 divide-y divide-line border-y border-line">
            {preparation.evidenceMatrix.map((item, index) => (
              <article key={`${item.requirement}-${index}`} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span>
                    <p className="font-semibold">{item.requirement}</p>
                  </div>
                  <Badge variant={item.state === "direct" ? "default" : "secondary"}>{stateLabels[item.state]}</Badge>
                </div>
                <div className="mt-3 space-y-2 pl-8 text-sm leading-6 text-muted-foreground">
                  <p>{item.assessment}</p>
                  {item.resumeEvidence.length ? <p><span className="font-medium text-foreground">{t("preparation.resumeEvidence")}: </span>{item.resumeEvidence.join(t("report.separator"))}</p> : null}
                  <p><span className="font-medium text-foreground">{t("preparation.action")}: </span>{item.action}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="prep-knowledge" className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 lg:p-8">
          <PreparationSectionHeading number="04" title={t("preparation.knowledgeTitle")} />
          <div className="mt-5 divide-y divide-line border-y border-line">
            {preparation.knowledgeTopics.map((item, index) => (
              <details key={`${item.topic}-${index}`} className="py-4" open={index === 0}>
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3"><span className="font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span><span className="font-semibold">{item.topic}</span></div>
                    <Badge variant="secondary">{priorityLabels[item.priority]}</Badge>
                  </div>
                  <p className="mt-2 pl-8 text-sm leading-6 text-muted-foreground">{item.whyRelevant}</p>
                </summary>
                <div className="mt-4 grid gap-3 pl-8 text-sm leading-6">
                  <ReportBlock label={t("preparation.explanation")} value={item.explanation} />
                  <ReportBlock label={t("preparation.currentEvidence")} value={item.currentEvidence} />
                  <ReportBlock label={t("preparation.targetLevel")} value={item.targetLevel} />
                  <ReportBlock label={t("preparation.selfCheck")} value={item.selfCheckQuestions.join("\n")} />
                </div>
              </details>
            ))}
          </div>
        </section>

        <section id="prep-deep-dives" className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 lg:p-8">
          <PreparationSectionHeading number="05" title={t("preparation.deepDiveTitle")} />
          <div className="mt-5 divide-y divide-line border-y border-line">
            {preparation.deepDives.map((item, index) => (
              <details key={`${item.resumeItem}-${index}`} className="py-4" open={index === 0}>
                <summary className="cursor-pointer list-none font-semibold"><span className="mr-3 font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span>{item.resumeItem}</summary>
                <div className="mt-3 pl-8 text-sm leading-6 text-muted-foreground">
                  <p>{item.whyRelevant}</p>
                  <p className="mt-2"><span className="font-medium text-foreground">{t("preparation.contribution")}: </span>{item.personalContributionFocus}</p>
                  <ListBlock label={t("preparation.followUps")} items={item.likelyFollowUps} />
                  <ListBlock label={t("preparation.factsToConfirm")} items={item.factsToConfirm} />
                </div>
              </details>
            ))}
          </div>
        </section>

        <section id="prep-questions" className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 lg:p-8">
          <PreparationSectionHeading number="06" title={t("preparation.questionsTitle")} />
          <ol className="mt-5 divide-y divide-line border-y border-line">
            {preparation.targetedQuestions.map((item, index) => (
              <li key={`${item.question}-${index}`} className="py-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium"><span className="mr-3 font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span>{item.question}</p>
                  <Badge variant="secondary">{priorityLabels[item.priority]}</Badge>
                </div>
                <p className="mt-2 pl-8 text-xs text-muted-foreground">{item.category}</p>
                <p className="mt-2 pl-8 text-sm leading-6 text-muted-foreground">{item.preparationDirection}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="prep-plan" className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 lg:p-8">
          <PreparationSectionHeading number="07" title={t("preparation.planTitle")} />
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <PlanBlock label={priorityLabels.must} items={preparation.preparationPlan.mustPrepare} />
            <PlanBlock label={priorityLabels.should} items={preparation.preparationPlan.shouldPrepare} />
            <PlanBlock label={priorityLabels.optional} items={preparation.preparationPlan.optional} />
          </div>
          <Separator className="my-6" />
          <h3 className="text-base font-semibold">{t("preparation.introductionTitle")}</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{preparation.selfIntroduction}</p>
          <h3 className="mt-6 text-base font-semibold">{t("preparation.reverseQuestionsTitle")}</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
            {preparation.reverseQuestions.map((item) => <li key={item}>· {item}</li>)}
          </ul>
        </section>

        <section className="flex flex-col justify-between gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">{message || t("preparation.footerHint")}</p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={isWorking} onClick={onBack}><ArrowLeft data-icon="inline-start" />{t("preparation.back")}</Button>
            <Button disabled={isWorking} onClick={onStart}>
              {isWorking ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
              {t("preparation.start")}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function PreparationSectionHeading({ number, title, description }: { number: string; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 font-mono text-xs font-semibold text-brand">{number}</span>
      <div>
        <h3 className="font-serif text-xl font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="font-medium text-foreground">{label}</p>
      <ul className="mt-1 flex flex-col gap-1">{items.map((item) => <li key={item}>· {item}</li>)}</ul>
    </div>
  );
}

function PlanBlock({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-line bg-background p-4">
      <p className="text-sm font-semibold">{label}</p>
      <ul className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
        {items.map((item) => <li key={item}>· {item}</li>)}
      </ul>
    </div>
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
  const t = useTranslations("interview");

  if (!activeQuestion) return <div className="rounded-lg border border-line bg-surface p-6">{t("session.noQuestions")}</div>;
  const index = session.currentQuestionIndex;
  const value = draftAnswers[activeQuestion.id] ?? session.answers[activeQuestion.id]?.content ?? "";
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_18px_50px_rgba(49,48,48,0.05)]">
      <div className="grid min-h-[650px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-line bg-surface-low p-5 lg:border-r lg:border-b-0">
          <div className="flex flex-col gap-1">
            <Badge variant="outline">{t(MODE_OPTIONS.find((item) => item.value === session.mode)?.labelKey ?? "modes.comprehensive.label")}</Badge>
            <h2 className="mt-2 text-sm font-semibold">{session.context.company} · {session.context.title}</h2>
            <p className="text-xs text-muted-foreground">{session.context.resumeName}</p>
          </div>
          <Separator className="my-4" />
          <nav className="flex flex-col gap-2" aria-label={t("session.questionList")}>
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
                  {answer?.skipped ? <Badge variant="secondary">{t("session.skipped")}</Badge> : answer?.content.trim() ? <CheckCircle2 className="shrink-0 text-brand" /> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 lg:px-7">
            <div className="text-sm text-muted-foreground">{t("session.questionProgress", { current: index + 1, total: session.questions.length })} · {t(CATEGORY_KEYS[activeQuestion.category] ?? "categories.general")}</div>
            <div className={cn("text-xs", saveState === "error" ? "text-destructive" : "text-muted-foreground")}>{saveStateLabel(saveState, t)}</div>
          </header>
          <div className="flex flex-1 flex-col gap-5 p-5 lg:p-7">
            <div>
              <h2 className="max-w-4xl font-serif text-2xl leading-10 font-semibold">{activeQuestion.prompt}</h2>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-low px-4 py-3 text-sm leading-6 text-muted-foreground">
                <Target className="mt-1 size-4 shrink-0 text-brand" />
                <span>{t("session.focus", { focus: activeQuestion.focus })}</span>
              </div>
            </div>
            <label className="flex flex-1 flex-col gap-2 text-xs font-medium text-muted-foreground">
              <span>{t("session.answer")}</span>
              <SpeechTextarea
                value={value}
                onValueChange={(nextValue) => onDraftChange(activeQuestion.id, nextValue)}
                speechSeparator=" "
                placeholder={t("session.answerPlaceholder")}
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
              <ArrowLeft data-icon="inline-start" />{t("session.previous")}
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" disabled={isWorking} onClick={onBack}>{t("session.saveExit")}</Button>
              <Button variant="outline" disabled={isWorking} onClick={() => onMove(Math.min(index + 1, session.questions.length - 1), true)}>{t("session.answerLater")}</Button>
              {index < session.questions.length - 1 ? (
                <Button disabled={isWorking} onClick={() => onMove(index + 1)}>
                  {t("session.saveNext")}<ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <Button disabled={isWorking} onClick={onFinish}>
                  {isWorking ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <ClipboardCheck data-icon="inline-start" />}
                  {t("session.finish")}
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
  const t = useTranslations("interview");

  if (!report) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="font-serif text-xl font-semibold">{t("report.legacyTitle")}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {Object.entries(session.legacyFeedback ?? {}).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-surface-low p-4">
              <p className="text-sm font-semibold">{key}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{value}</p>
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-5" onClick={onReturn}>{t("report.adjust")}</Button>
      </section>
    );
  }
  const dimensions = [
    [t("report.dimensions.jobFit"), report.dimensions.jobFit],
    [t("report.dimensions.structure"), report.dimensions.structure],
    [t("report.dimensions.evidence"), report.dimensions.evidence],
    [t("report.dimensions.star"), report.dimensions.star],
  ] as const;
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(49,48,48,0.05)] lg:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <Badge variant="outline">{t("report.saved")}</Badge>
            <h2 className="mt-3 font-serif text-2xl font-semibold">{t("report.title", { company: session.context.company, title: session.context.title })}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("report.basedOn", { resumeName: session.context.resumeName })}</p>
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
        <div className="rounded-lg border border-line bg-surface p-5"><h3 className="text-base font-semibold">{t("report.strengths")}</h3><ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">{report.strengths.map((item) => <li key={item}>· {item}</li>)}</ul></div>
        <div className="rounded-lg border border-line bg-surface p-5"><h3 className="text-base font-semibold">{t("report.improvements")}</h3><ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">{report.improvements.map((item) => <li key={item}>· {item}</li>)}</ul></div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5 lg:p-6">
        <h3 className="text-base font-semibold">{t("report.questionReview")}</h3>
        <div className="mt-4 flex flex-col gap-3">
          {session.questions.map((question, index) => {
            const review = report.questionReviews.find((item) => item.questionId === question.id);
            const answer = session.answers[question.id];
            if (!review) return null;
            return (
              <details key={question.id} className="group rounded-lg border border-line bg-background p-4" open={index === 0}>
                <summary className="cursor-pointer list-none text-sm font-semibold">{index + 1}. {question.prompt}</summary>
                <div className="mt-4 grid gap-4 text-sm leading-6">
                  <ReportBlock label={t("report.yourAnswer")} value={answer?.content.trim() || t("report.unanswered")} />
                  <ReportBlock label={t("report.diagnosis")} value={review.diagnosis} />
                  <ReportBlock label={t("report.suggestion")} value={review.suggestion} />
                  <ReportBlock label={t("report.reference")} value={review.improvedAnswer} emphasized />
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col justify-between gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center">
        <div><h3 className="text-sm font-semibold">{t("report.nextActions")}</h3><p className="mt-1 text-sm text-muted-foreground">{report.nextActions.join(t("report.separator"))}</p>{message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}</div>
        <div className="flex gap-2"><Button variant="outline" disabled={isWorking} onClick={onReturn}>{t("report.adjust")}</Button><Button disabled={isWorking} onClick={onPracticeAgain}>{isWorking ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}{isWorking ? t("report.generating") : t("report.practiceAgain")}</Button></div>
      </section>
    </div>
  );
}

function ReportBlock({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return <div className={cn("rounded-lg bg-surface-low p-4", emphasized && "bg-brand-muted")}><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-line text-foreground">{value}</p></div>;
}

function buildAnswer(questionId: string, content: string, skipped: boolean): InterviewAnswer {
  return { questionId, content, skipped, updatedAt: new Date().toISOString() };
}

function hasResumeContent(resume: ResumeContent) {
  return Boolean(resume.basics.name.trim() || resume.basics.email.trim() || resume.projects.length || resume.experiences.length || resume.internships.length);
}

function saveStateLabel(state: SaveState, t: (key: string) => string) {
  return {
    idle: t("saveState.idle"),
    saving: t("saveState.saving"),
    saved: t("saveState.saved"),
    error: t("saveState.error"),
  }[state];
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
