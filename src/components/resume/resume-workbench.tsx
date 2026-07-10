"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Download,
  Palette,
  PanelRightOpen,
  Redo2,
  Save,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { EditorCanvas } from "@/components/editor/editor-canvas";
import { EditorPreviewPanel } from "@/components/editor/editor-preview-panel";
import { EditorSidebar } from "@/components/editor/editor-sidebar";
import { ResumeExportDialog, type ResumeExportFormat } from "@/components/resume/resume-export-dialog";
import { ResumeLibraryView, type ResumeLibraryViewMode } from "@/components/resume/resume-library-view";
import { ResumeTemplateBar } from "@/components/resume/resume-template-bar";
import { ResumeThemePanel } from "@/components/resume/resume-theme-panel";
import { AiSetupRequiredDialog, RESUME_IMPORT_AI_SETUP_MESSAGE } from "@/components/resume/resume-jd-preparation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TEMPLATES } from "@/lib/constants";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  calculateResumePagination,
  getCombinedPageImageLayout,
} from "@/lib/resume-export-layout";
import { contentToJadeResume, jadeResumeToContent } from "@/lib/resume-adapter";
import { buildDocxThemeConfig, type DocxThemeConfig } from "@/lib/resume-docx-style";
import {
  buildResumeEditorPath,
  buildResumeLibraryCards,
  type ResumeLibrarySortMode,
} from "@/lib/resume-library";
import {
  buildAutomaticResumeTitle,
  resolveResumeContentTitle,
  shouldAutoRenameResumeTitle,
} from "@/lib/resume-naming";
import { buildUploadedResumeDraft } from "@/lib/resume-upload";
import { normalizeOptimizedResumeVersionName } from "@/lib/resume-versioning";
import type { ResumeContent, ResumeOptimizationMeta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { useResumeStore } from "@/stores/resume-store";
import type { Resume, SectionContent, ThemeConfig } from "@/types/resume";

type ResumeVersionCard = {
  id: string;
  jobId?: string | null;
  name: string;
  summary: string;
  content: ResumeContent;
  createdAt: string;
  updatedAt?: string;
};

type ResumeSaveResult =
  | { kind: "main" }
  | {
      kind: "version";
      version: ResumeVersionCard;
    };

type ResumeWorkbenchProps = {
  resume: ResumeContent;
  resumeUpdatedAt?: string;
  setResume: Dispatch<SetStateAction<ResumeContent>>;
  saveResume: (content?: ResumeContent, target?: ResumeSaveTarget, name?: string) => Promise<ResumeSaveResult>;
  versions?: ResumeVersionCard[];
  initialResumeVersionId?: string;
  mode: WorkbenchMode;
  onModeChange: (mode: WorkbenchMode) => void;
  onEditorTargetChange: (versionId?: string) => void;
  aiReady: boolean;
  optimizeAiReady: boolean;
  optimizeResume: (input: { resumeContent: ResumeContent }) => Promise<{
    version: ResumeVersionCard;
    message?: string;
    optimization?: ResumeOptimizationMeta;
  }>;
  onResumeOptimized: (result: {
    before: ResumeContent;
    after: ResumeContent;
    version: ResumeVersionCard;
    message?: string;
    optimization?: ResumeOptimizationMeta;
  }) => void;
  onOpenSettings: () => void;
  onDeleteMainResume: () => void;
  onDeleteVersion: (versionId: string) => void;
};

type WorkbenchMode = "library" | "editor";
export type ResumeSaveTarget = { kind: "main" } | { kind: "version"; id: string } | { kind: "new" };
type ViewMode = ResumeLibraryViewMode;
type SortMode = ResumeLibrarySortMode;

const DEFAULT_EDITOR_THEME: ThemeConfig = {
  primaryColor: "#1a1a2e",
  accentColor: "#e94560",
  fontFamily: "Inter",
  fontSize: "medium",
  logoSize: "medium",
  lineSpacing: 1.5,
  margin: { top: 20, right: 24, bottom: 20, left: 24 },
  sectionSpacing: 16,
  avatarStyle: "oneInch",
};

export function ResumeWorkbench({
  resume,
  resumeUpdatedAt,
  setResume,
  saveResume,
  versions = [],
  initialResumeVersionId,
  mode,
  onModeChange,
  onEditorTargetChange,
  aiReady,
  optimizeAiReady,
  optimizeResume,
  onResumeOptimized,
  onOpenSettings,
  onDeleteMainResume,
  onDeleteVersion,
}: ResumeWorkbenchProps) {
  const t = useTranslations("resumeWorkbench");
  const templateT = useTranslations("app.resumeLibrary.templates");
  const savedStatus = t("status.saved");
  const importReviewStatus = t("status.importReview");
  const initialVersion = initialResumeVersionId
    ? versions.find((version) => version.id === initialResumeVersionId)
    : undefined;
  const [editingContent, setEditingContent] = useState<ResumeContent>(initialVersion?.content ?? resume);
  const [editingTitle, setEditingTitle] = useState(initialVersion ? versionTitle(initialVersion) : buildResumeTitle(resume));
  const [editingTarget, setEditingTarget] = useState<ResumeSaveTarget>(
    initialVersion ? { kind: "version", id: initialVersion.id } : { kind: "main" },
  );
  const [status, setStatus] = useState(savedStatus);
  const [showPreview, setShowPreview] = useState(true);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ResumeExportFormat | null>(null);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isImportingResume, setIsImportingResume] = useState(false);
  const [isOptimizingResume, setIsOptimizingResume] = useState(false);
  const [aiSetupDialogOpen, setAiSetupDialogOpen] = useState(false);
  const [optimizeAiSetupDialogOpen, setOptimizeAiSetupDialogOpen] = useState(false);
  const [showImportReviewNotice, setShowImportReviewNotice] = useState(false);
  const localImportFallbackRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importNoticeTimerRef = useRef<number | null>(null);
  const saveContextRef = useRef({ editingTarget, editingTitle, saveResume, setResume });

  const currentResume = useResumeStore((state) => state.currentResume);
  const sections = useResumeStore((state) => state.sections);
  const isDirty = useResumeStore((state) => state.isDirty);
  const isSaving = useResumeStore((state) => state.isSaving);
  const {
    updateSection,
    addSection,
    removeSection,
    reorderSections,
    setTemplate,
    updateThemeConfig,
    setTitle,
    save,
  } = useResumeStore();
  const { undo, redo, undoStack, redoStack, pushSnapshot } = useEditorStore();

  useEffect(() => {
    const handlePopState = () => {
      const versionId = readEditorRouteVersionId();
      if (window.location.pathname !== "/resume/edit") return;

      if (!versionId) {
        setEditingContent(resume);
        setEditingTitle(buildResumeTitle(resume));
        setEditingTarget({ kind: "main" });
        setStatus(savedStatus);
        return;
      }

      const version = versions.find((item) => item.id === versionId);
      if (!version) {
        setStatus(t("status.versionNotFound"));
        return;
      }

      setEditingContent(version.content);
      setEditingTitle(versionTitle(version));
      setEditingTarget({ kind: "version", id: version.id });
      setStatus(savedStatus);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [resume, savedStatus, t, versions]);

  useEffect(() => {
    saveContextRef.current = { editingTarget, editingTitle, saveResume, setResume };
  }, [editingTarget, editingTitle, saveResume, setResume]);

  useEffect(() => {
    return () => {
      if (importNoticeTimerRef.current !== null) window.clearTimeout(importNoticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const store = useResumeStore.getState();
    if (mode !== "editor") {
      store.setPersistence(null);
      return undefined;
    }

    store.setPersistence(async (liveResume, context) => {
      const {
        editingTarget: target,
        editingTitle: title,
        saveResume: persistResume,
        setResume: setMainResume,
      } = saveContextRef.current;
      const content = jadeResumeToContent(liveResume);
      const resolvedTitle = resolveResumeTitle(content, title);
      const contentWithTitle = withResumeDisplayName(content, resolvedTitle);
      setStatus(context.source === "auto" ? t("status.autoSaving") : t("status.saving"));

      try {
        const result = await persistResume(contentWithTitle, target, resolvedTitle);
        if (target.kind === "new" && result.kind === "version") {
          const nextTarget: ResumeSaveTarget = { kind: "version", id: result.version.id };
          setEditingTarget(nextTarget);
          setEditingTitle(versionTitle(result.version));
          onEditorTargetChange(result.version.id);
          window.history.replaceState(null, "", buildResumeEditorPath(nextTarget));
        }
        if (target.kind === "main") {
          setMainResume(contentWithTitle);
        }
        setStatus(
          context.source === "auto"
            ? t("status.autoSaved")
            : target.kind === "main"
              ? t("status.mainSaved")
              : t("status.resumeSaved"),
        );
      } catch (error) {
        setStatus(context.source === "auto" ? t("status.autoSaveFailed") : t("status.saveFailed"));
        throw error;
      }
    });

    return () => {
      useResumeStore.getState().setPersistence(null);
    };
  }, [mode, onEditorTargetChange, t]);

  useEffect(() => {
    if (mode !== "editor") return;

    const jadeResume = contentToJadeResume(editingContent);
    const hydratedResume: Resume = {
      ...jadeResume,
      title: saveContextRef.current.editingTitle,
      template: getValidTemplate(jadeResume.template),
      themeConfig: mergeTheme(jadeResume.themeConfig),
      updatedAt: new Date(),
    };

    useEditorStore.getState().reset();
    useResumeStore.getState().setResume(hydratedResume);
    useEditorStore.getState().selectSection(hydratedResume.sections[0]?.id ?? null);
  }, [editingContent, mode]);

  useEffect(() => {
    return useResumeStore.subscribe((state) => {
      if (mode !== "editor" || !state.currentResume) return;
      if (editingTarget.kind !== "main") return;
      const liveResume: Resume = { ...state.currentResume, sections: state.sections };
      setResume(jadeResumeToContent(liveResume));
    });
  }, [editingTarget.kind, mode, setResume]);

  const activeResume = useMemo<Resume | null>(() => {
    if (!currentResume) return null;
    return { ...currentResume, sections };
  }, [currentResume, sections]);

  const resumeCards = useMemo(() => {
    return buildResumeLibraryCards({
      resume,
      mainResumeUpdatedAt: resumeUpdatedAt,
      versions,
      search,
      sortMode,
    });
  }, [resume, resumeUpdatedAt, search, sortMode, versions]);

  function withSnapshot(action: () => void) {
    pushSnapshot(sections);
    action();
  }

  function handleSectionUpdate(sectionId: string, content: Partial<SectionContent>) {
    const currentSection = sections.find((section) => section.id === sectionId);
    const previousName =
      currentSection?.type === "personal_info" && "fullName" in currentSection.content
        ? currentSection.content.fullName
        : "";

    withSnapshot(() => updateSection(sectionId, content));

    if (
      currentSection?.type === "personal_info" &&
      "fullName" in content &&
      typeof content.fullName === "string" &&
      shouldAutoRenameResumeTitle(editingTitle, previousName)
    ) {
      const nextTitle = buildAutomaticResumeTitle(content.fullName);
      setEditingTitle(nextTitle);
      setTitle(nextTitle);
    }
  }

  function handleTitleChange(title: string) {
    setEditingTitle(title);
    setTitle(title);
  }

  function handleTitleBlur() {
    if (!activeResume) return;
    const nextTitle = resolveResumeTitle(activeResume, editingTitle);
    setEditingTitle(nextTitle);
    setTitle(nextTitle);
  }

  function handleUndo() {
    const snapshot = undo();
    if (snapshot) reorderSections(snapshot.sections);
  }

  function handleRedo() {
    const snapshot = redo();
    if (snapshot) reorderSections(snapshot.sections);
  }

  function openEditor(content: ResumeContent, title = buildResumeTitle(content), target: ResumeSaveTarget = { kind: "main" }) {
    setEditingContent(content);
    setEditingTitle(title);
    setEditingTarget(target);
    setStatus(savedStatus);
    setShowThemePanel(false);
    onEditorTargetChange(target.kind === "version" ? target.id : undefined);
    onModeChange("editor");
    const nextPath = target.kind === "new" ? "/resume/edit" : buildResumeEditorPath(target);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }

  function closeEditor() {
    onModeChange("library");
    onEditorTargetChange(undefined);
    setShowThemePanel(false);
    if (window.location.pathname !== "/resume") {
      window.history.pushState(null, "", "/resume");
    }
  }

  function handleCreateResume() {
    const blankResume = createBlankResume();
    openEditor(blankResume, t("untitled"), { kind: "new" });
  }

  function showImportReviewStatus() {
    if (importNoticeTimerRef.current !== null) window.clearTimeout(importNoticeTimerRef.current);
    setShowImportReviewNotice(true);
    setStatus(importReviewStatus);
    importNoticeTimerRef.current = window.setTimeout(() => {
      setShowImportReviewNotice(false);
      setStatus((current) => (current === importReviewStatus ? savedStatus : current));
      importNoticeTimerRef.current = null;
    }, 12000);
  }

  async function handleImportResume(file?: File, options: { preferLocalFallback?: boolean } = {}) {
    if (!file || isImportingResume) return;
    if (!aiReady && !options.preferLocalFallback) {
      setAiSetupDialogOpen(true);
      return;
    }

    setIsImportingResume(true);
    setStatus(options.preferLocalFallback ? t("status.localParsing") : t("status.importing"));
    try {
      const draft = await buildUploadedResumeDraft(file, options);
      const title = resolveResumeContentTitle(draft.content);
      const result = await saveResume(draft.content, { kind: "new" }, title);
      if (result.kind === "version") {
        openEditor(result.version.content, versionTitle(result.version), { kind: "version", id: result.version.id });
      } else {
        openEditor(draft.content, title, { kind: "new" });
      }
      showImportReviewStatus();
    } catch (error) {
      setStatus(t("status.importFailed", { message: error instanceof Error ? error.message : t("status.retryLater") }));
    } finally {
      setIsImportingResume(false);
    }
  }

  function handleImportButtonClick() {
    if (!aiReady && !localImportFallbackRef.current) {
      setAiSetupDialogOpen(true);
      return;
    }
    importInputRef.current?.click();
  }

  function importWithLocalFallback() {
    localImportFallbackRef.current = true;
    importInputRef.current?.click();
  }

  function openAiSettingsForImport() {
    localImportFallbackRef.current = false;
    onOpenSettings();
  }

  async function handleOptimizeResume() {
    if (isOptimizingResume) return;
    if (!optimizeAiReady) {
      setOptimizeAiSetupDialogOpen(true);
      return;
    }

    const state = useResumeStore.getState();
    if (!state.currentResume) return;
    const liveResume: Resume = { ...state.currentResume, sections: state.sections };
    const content = jadeResumeToContent(liveResume);
    const resolvedTitle = resolveResumeTitle(content, editingTitle);
    const contentWithTitle = withResumeDisplayName(content, resolvedTitle);

    setIsOptimizingResume(true);
    setStatus(t("status.optimizing"));
    try {
      const result = await optimizeResume({ resumeContent: contentWithTitle });
      onResumeOptimized({
        before: contentWithTitle,
        after: result.version.content,
        version: result.version,
        message: result.message,
        optimization: result.optimization,
      });
      setStatus(result.message ?? t("status.optimizeDone"));
    } catch (error) {
      setStatus(t("status.optimizeFailed", { message: error instanceof Error ? error.message : t("status.retryLater") }));
    } finally {
      setIsOptimizingResume(false);
    }
  }

  function handleTemplateChange(template: string) {
    setTemplate(template);
  }

  function handleThemeChange(themeConfig: Partial<ThemeConfig>) {
    const current = useResumeStore.getState().currentResume?.themeConfig ?? DEFAULT_EDITOR_THEME;
    const nextTheme = mergeTheme(current, themeConfig);
    updateThemeConfig(nextTheme);
  }

  function resetTheme() {
    handleThemeChange(DEFAULT_EDITOR_THEME);
  }

  async function persistNow() {
    const state = useResumeStore.getState();
    if (!state.currentResume) return;
    setStatus(t("status.saving"));
    await save("manual", { force: true });
  }

  async function handleExport(format: ResumeExportFormat) {
    if (!activeResume || exportingFormat) return;
    setExportingFormat(format);
    setStatus(t("status.exporting"));
    try {
      await exportResume(activeResume, format);
      setStatus(t(`status.exported.${format}`));
      setExportDialogOpen(false);
    } catch (error) {
      console.error("Failed to export resume:", error);
      setStatus(t("status.exportFailed"));
    } finally {
      setExportingFormat(null);
    }
  }

  const importAiSetupDialog = (
    <AiSetupRequiredDialog
      open={aiSetupDialogOpen}
      title={t("aiSetup.title")}
      message={RESUME_IMPORT_AI_SETUP_MESSAGE}
      secondaryLabel={t("aiSetup.later")}
      onOpenChange={setAiSetupDialogOpen}
      onOpenSettings={openAiSettingsForImport}
      onSecondary={importWithLocalFallback}
    />
  );
  const optimizeAiSetupDialog = (
    <AiSetupRequiredDialog
      open={optimizeAiSetupDialogOpen}
      title={t("aiSetup.title")}
      message={t("aiSetup.optimizeMessage")}
      onOpenChange={setOptimizeAiSetupDialogOpen}
      onOpenSettings={onOpenSettings}
    />
  );

  if (mode === "library") {
    return (
      <>
        <ResumeLibraryView
          cards={resumeCards}
          status={status}
          savedStatus={savedStatus}
          search={search}
          sortMode={sortMode}
          viewMode={viewMode}
          isImportingResume={isImportingResume}
          importInputRef={importInputRef}
          onImportFile={(file) => void handleImportResume(file, { preferLocalFallback: localImportFallbackRef.current })}
          onImportButtonClick={handleImportButtonClick}
          onCreateResume={handleCreateResume}
          onSearchChange={setSearch}
          onSortModeChange={setSortMode}
          onViewModeChange={setViewMode}
          onOpenCard={(card) => openEditor(card.content, card.title, card.target)}
          onDeleteCard={(card) => {
            if (card.id === "main") {
              onDeleteMainResume();
            } else {
              onDeleteVersion(card.id);
            }
          }}
        />
        {importAiSetupDialog}
        {optimizeAiSetupDialog}
      </>
    );
  }

  if (!activeResume) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <section className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
          <div className="flex min-w-[220px] shrink-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeEditor} title={t("toolbar.back")}>
              <X />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <input
                  value={editingTitle}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  onBlur={handleTitleBlur}
                  className="h-7 min-w-0 max-w-[220px] rounded-md border border-transparent bg-transparent px-2 text-xs font-semibold outline-none hover:border-line hover:bg-surface focus:border-primary focus:bg-white"
                  aria-label={t("toolbar.resumeName")}
                  title={t("toolbar.rename")}
                />
                <Badge variant="secondary" className="text-[0.6875rem]" title={status}>
                  {showImportReviewNotice ? t("status.parsed") : formatEditorSaveStatus(isDirty, isSaving, status, t)}
                </Badge>
              </div>
              <p className="text-[0.6875rem] text-muted-foreground">
                {t("toolbar.meta", {
                  template: templateT(activeResume.template),
                  kind: editingTarget.kind === "main" ? t("toolbar.mainResume") : t("toolbar.versionResume"),
                })}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto">
            <ToolbarButton icon={Undo2} label={t("toolbar.undo")} disabled={undoStack.length === 0} onClick={handleUndo} />
            <ToolbarButton icon={Redo2} label={t("toolbar.redo")} disabled={redoStack.length === 0} onClick={handleRedo} />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <ToolbarButton
              icon={WandSparkles}
              label={isOptimizingResume ? t("toolbar.optimizing") : t("toolbar.optimize")}
              showText
              disabled={isOptimizingResume || isSaving}
              onClick={() => void handleOptimizeResume()}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 text-xs"
              aria-label={t("toolbar.export")}
              title={t("toolbar.export")}
              onClick={() => setExportDialogOpen(true)}
            >
              <Download />
              <span>{t("toolbar.export")}</span>
            </Button>
            <ToolbarButton
              icon={Palette}
              label={showThemePanel ? t("toolbar.closeTheme") : t("toolbar.theme")}
              showText
              onClick={() => setShowThemePanel((value) => !value)}
            />
            <ToolbarButton
              icon={PanelRightOpen}
              label={showPreview ? t("toolbar.hidePreview") : t("toolbar.showPreview")}
              showText
              onClick={() => setShowPreview((value) => !value)}
            />
            <Button onClick={persistNow} disabled={isSaving} size="sm" className="shrink-0 text-xs">
              <Save data-icon="inline-start" />
              {t("toolbar.save")}
            </Button>
          </div>
        </header>

        <ResumeExportDialog
          open={exportDialogOpen}
          exportingFormat={exportingFormat}
          onOpenChange={setExportDialogOpen}
          onExport={handleExport}
        />
        {importAiSetupDialog}
        {optimizeAiSetupDialog}

        <div className="flex min-h-0 flex-1">
          <div className="hidden md:block">
            <EditorSidebar
              sections={sections}
              onAddSection={(section) => withSnapshot(() => addSection({ ...section, resumeId: activeResume.id }))}
              onReorderSections={(nextSections) => withSnapshot(() => reorderSections(nextSections))}
            />
          </div>

          <main className="flex min-w-0 flex-1 overflow-hidden">
            <div className={cn("flex min-h-0 min-w-0 flex-col", showPreview ? "flex-[0.95]" : "flex-1")}>
              <ResumeTemplateBar resume={activeResume} onTemplateChange={handleTemplateChange} />
              {showImportReviewNotice ? (
                <div className="border-b border-line bg-surface-low px-4 py-3 md:px-6">
                  <div className="mx-auto max-w-3xl rounded-lg border border-primary/20 bg-white px-4 py-3 text-base leading-7 text-foreground shadow-sm">
                    {importReviewStatus}
                  </div>
                </div>
              ) : null}
              <EditorCanvas
                sections={sections}
                onUpdateSection={handleSectionUpdate}
                onRemoveSection={(sectionId) => withSnapshot(() => removeSection(sectionId))}
                onReorderSections={(nextSections) => withSnapshot(() => reorderSections(nextSections))}
              />
            </div>
            {showPreview && (
              <div className="hidden min-h-0 min-w-[500px] flex-1 lg:block">
                <EditorPreviewPanel />
              </div>
            )}
            {showThemePanel && (
              <ResumeThemePanel
                theme={activeResume.themeConfig}
                defaultMargin={DEFAULT_EDITOR_THEME.margin}
                onChange={handleThemeChange}
                onReset={resetTheme}
                onClose={() => setShowThemePanel(false)}
              />
            )}
          </main>
        </div>
      </section>
    </TooltipProvider>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  showText,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  showText?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size={showText ? "sm" : "icon"}
            className="h-8 shrink-0 text-xs"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
          >
            <Icon />
            {showText && <span>{label}</span>}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function buildResumeTitle(content: ResumeContent) {
  return resolveResumeContentTitle(content);
}

function versionTitle(version: ResumeVersionCard) {
  return version.jobId ? normalizeOptimizedResumeVersionName(version.name) : version.name;
}

function withResumeDisplayName(content: ResumeContent, title: string): ResumeContent {
  const displayName = title.trim() || buildResumeTitle(content);
  return {
    ...content,
    editor: {
      ...content.editor,
      displayName,
    },
  };
}

function resolveResumeTitle(content: ResumeContent | Resume, title: string) {
  if ("basics" in content) return resolveResumeContentTitle(content, title);
  const cleanTitle = title.trim();
  return cleanTitle || content.title || buildAutomaticResumeTitle("");
}

function createBlankResume(): ResumeContent {
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

function mergeTheme(base?: ThemeConfig, patch?: Partial<ThemeConfig>): ThemeConfig {
  const theme = base ?? DEFAULT_EDITOR_THEME;
  return {
    ...DEFAULT_EDITOR_THEME,
    ...theme,
    ...patch,
    margin: {
      ...DEFAULT_EDITOR_THEME.margin,
      ...theme.margin,
      ...(patch?.margin ?? {}),
    },
  };
}

function getValidTemplate(template?: string) {
  return TEMPLATES.includes(template as (typeof TEMPLATES)[number]) ? template! : "modern";
}

function formatEditorSaveStatus(
  isDirty: boolean,
  isSaving: boolean,
  status: string,
  t: (key: string) => string,
) {
  if (isSaving) return status || t("status.saving");
  if (isDirty) return t("status.unsaved");
  return status;
}

function readSmartOnePagePreference() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("lujie_resume_smart_one_page") === "true";
}

function readEditorRouteVersionId() {
  if (typeof window === "undefined" || window.location.pathname !== "/resume/edit") return undefined;
  return new URLSearchParams(window.location.search).get("version") ?? undefined;
}

async function exportResume(resume: Resume, format: ResumeExportFormat) {
  if (format === "word") {
    await exportResumeAsEditableDocx(resume);
    return;
  }

  const pages = await captureResumePages(resume, readSmartOnePagePreference());
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pages.forEach((page, index) => {
      if (index > 0) {
        pdf.addPage();
      }
      pdf.addImage(page.dataUrl, "PNG", 0, 0, pageWidth, pageHeight);
    });

    pdf.save(`${buildExportName(resume)}.pdf`);
    return;
  }

  downloadDataUrl(await combinePageImages(pages), `${buildExportName(resume)}.png`);
}

async function captureResumePages(resume: Resume, smartOnePage: boolean) {
  const { pages, cleanup } = await renderResumePagesForExport(resume, smartOnePage);

  try {
    const { domToPng } = await import("modern-screenshot");
    const captures = [];
    for (const page of pages) {
      captures.push({
        dataUrl: await domToPng(page, {
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          scale: 2,
          backgroundColor: "#ffffff",
          fetch: { requestInit: { cache: "force-cache" } },
          font: false,
        }),
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
      });
    }
    return captures;
  } finally {
    cleanup();
  }
}

async function renderResumePagesForExport(resume: Resume, smartOnePage: boolean) {
  const measurement = await renderResumeForMeasurement(resume);

  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { ResumePreview } = await import("@/components/preview/resume-preview");

  const measuredHeight = Math.max(measurement.element.scrollHeight, Math.ceil(measurement.element.getBoundingClientRect().height), 1);
  const { fitScale, pageCount, horizontalOffset } = calculateResumePagination(measuredHeight, smartOnePage);

  const container = document.createElement("div");
  container.setAttribute("data-resume-export-pages", "true");
  Object.assign(container.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${A4_WIDTH_PX}px`,
    background: "#ffffff",
    color: "#111111",
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.appendChild(container);

  const roots: Array<ReturnType<typeof createRoot>> = [];
  const pages: HTMLElement[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = document.createElement("div");
    Object.assign(page.style, {
      position: "relative",
      width: `${A4_WIDTH_PX}px`,
      height: `${A4_HEIGHT_PX}px`,
      overflow: "hidden",
      background: "#ffffff",
    });

    const scaleWrapper = document.createElement("div");
    Object.assign(scaleWrapper.style, {
      position: "absolute",
      left: `${horizontalOffset}px`,
      top: "0",
      width: `${A4_WIDTH_PX}px`,
      transform: `scale(${fitScale})`,
      transformOrigin: "top left",
    });

    const slice = document.createElement("div");
    slice.style.marginTop = `${-(pageIndex * A4_HEIGHT_PX) / fitScale}px`;
    scaleWrapper.appendChild(slice);
    page.appendChild(scaleWrapper);
    container.appendChild(page);

    const root = createRoot(slice);
    roots.push(root);
    pages.push(page);
    flushSync(() => {
      root.render(<ResumePreview resume={resume} mode="export" />);
    });
  }

  await waitForNextFrame();
  await waitForNextFrame();
  if ("fonts" in document) {
    await document.fonts.ready.catch(() => undefined);
  }

  measurement.cleanup();

  return {
    pages,
    cleanup: () => {
      roots.forEach((root) => root.unmount());
      container.remove();
    },
  };
}

async function renderResumeForMeasurement(resume: Resume) {
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { ResumePreview } = await import("@/components/preview/resume-preview");

  const element = document.createElement("div");
  element.setAttribute("data-resume-export-measure", "true");
  Object.assign(element.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${A4_WIDTH_PX}px`,
    minHeight: "1px",
    background: "#ffffff",
    color: "#111111",
    pointerEvents: "none",
    visibility: "hidden",
    zIndex: "-1",
  });
  document.body.appendChild(element);

  const root = createRoot(element);
  flushSync(() => {
    root.render(<ResumePreview resume={resume} mode="export" />);
  });
  await waitForNextFrame();
  await waitForNextFrame();
  if ("fonts" in document) {
    await document.fonts.ready.catch(() => undefined);
  }

  return {
    element,
    cleanup: () => {
      root.unmount();
      element.remove();
    },
  };
}

async function combinePageImages(pages: Array<{ dataUrl: string; width: number; height: number }>) {
  const layout = getCombinedPageImageLayout(pages.length);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建图片导出画布。");
  ctx.fillStyle = layout.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let offsetY = 0;
  for (const page of pages) {
    const image = await loadImage(page.dataUrl);
    ctx.drawImage(image, 0, offsetY, A4_WIDTH_PX * layout.pageScale, A4_HEIGHT_PX * layout.pageScale);
    offsetY += A4_HEIGHT_PX * layout.pageScale + layout.pageGap * layout.pageScale;
  }

  return canvas.toDataURL("image/png", 1);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function exportResumeAsEditableDocx(resume: Resume) {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TabStopPosition,
    TabStopType,
    TextRun,
  } = await import("docx");
  const children: Array<InstanceType<typeof Paragraph>> = [];
  const visibleSections = resume.sections.filter((section) => section.visible !== false);
  const personalSection = visibleSections.find((section) => section.type === "personal_info");
  const personal = getRecord(personalSection?.content);
  const name = getString(personal.fullName) || resume.title;
  const jobTitle = getString(personal.jobTitle);
  const docxTheme = buildDocxThemeConfig(resume.themeConfig);
  const contacts = [
    getString(personal.email),
    getString(personal.phone),
    getString(personal.location),
    getString(personal.website),
    getString(personal.github),
  ].filter(Boolean);

  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 90 },
    children: [new TextRun({ text: name, bold: true, size: docxTheme.sizes.h1, color: docxTheme.primaryColor, font: docxTheme.font })],
  }));

  if (jobTitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: jobTitle, color: "475569", size: docxTheme.sizes.h3, font: docxTheme.font })],
    }));
  }

  if (contacts.length > 0) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: contacts.join(" | "), color: "64748B", size: docxTheme.sizes.meta, font: docxTheme.font })],
    }));
  }

  visibleSections
    .filter((section) => section.type !== "personal_info")
    .forEach((section) => {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: docxTheme.sectionSpacingTwips, after: 110 },
        border: {
          bottom: { color: docxTheme.accentColor, space: 1, style: BorderStyle.SINGLE, size: 8 },
        },
        children: [new TextRun({ text: section.title, bold: true, color: docxTheme.primaryColor, size: docxTheme.sizes.h2, font: docxTheme.font })],
      }));
      appendSectionToDocx(section, children, { Paragraph, TabStopPosition, TabStopType, TextRun }, docxTheme);
    });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: docxTheme.font,
            size: docxTheme.sizes.body,
            color: "334155",
          },
          paragraph: {
            spacing: { line: docxTheme.lineTwips, after: docxTheme.paragraphAfterTwips },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: docxTheme.marginTwips.top,
              right: docxTheme.marginTwips.right,
              bottom: docxTheme.marginTwips.bottom,
              left: docxTheme.marginTwips.left,
            },
          },
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${buildExportName(resume)}.docx`);
}

function appendSectionToDocx(
  section: Resume["sections"][number],
  children: Array<InstanceType<typeof import("docx").Paragraph>>,
  docx: Pick<typeof import("docx"), "Paragraph" | "TabStopPosition" | "TabStopType" | "TextRun">,
  docxTheme: DocxThemeConfig,
) {
  const content = getRecord(section.content);

  if (section.type === "summary" || section.type === "self_evaluation") {
    pushDocxParagraph(children, docx, docxTheme, getString(content.text));
    return;
  }

  if (section.type === "skills") {
    getArray(content.categories).forEach((category) => {
      const item = getRecord(category);
      const name = getString(item.name);
      const skills = getArray(item.skills).map(getString).filter(Boolean);
      if (name || skills.length > 0) {
        children.push(new docx.Paragraph({
          spacing: { after: 90 },
          children: [
            new docx.TextRun({ text: name ? `${name}：` : "", bold: true, color: "0F172A", size: docxTheme.sizes.body, font: docxTheme.font }),
            new docx.TextRun({ text: skills.join("、"), color: "334155", size: docxTheme.sizes.body, font: docxTheme.font }),
          ],
        }));
      }
    });
    return;
  }

  getArray(content.items).forEach((rawItem) => {
    const item = getRecord(rawItem);
    const title =
      getString(item.company) ||
      getString(item.institution) ||
      getString(item.name) ||
      getString(item.title);
    const subtitle =
      getString(item.position) ||
      getString(item.degree) ||
      getString(item.field) ||
      getString(item.subtitle) ||
      getString(item.issuer);
    const dates = [getString(item.startDate), getString(item.endDate), getString(item.date)]
      .filter(Boolean)
      .join(" - ");

    const heading = [title, subtitle].filter(Boolean).join(" | ");
    if (heading || dates) {
      children.push(new docx.Paragraph({
        spacing: { before: 90, after: 55 },
        tabStops: [{ type: docx.TabStopType.RIGHT, position: docx.TabStopPosition.MAX }],
        children: [
          new docx.TextRun({ text: heading, bold: true, color: "0F172A", size: docxTheme.sizes.h3, font: docxTheme.font }),
          ...(dates ? [new docx.TextRun({ text: `\t${dates}`, italics: true, color: "64748B", size: docxTheme.sizes.meta, font: docxTheme.font })] : []),
        ],
      }));
    }
    pushDocxParagraph(children, docx, docxTheme, getString(item.description));
    getArray(item.highlights)
      .map(getString)
      .filter(Boolean)
      .forEach((highlight) => {
        children.push(new docx.Paragraph({
          bullet: { level: 0 },
          spacing: { after: 55 },
          children: [new docx.TextRun({ text: highlight, color: "334155", size: docxTheme.sizes.meta, font: docxTheme.font })],
        }));
      });
  });
}

function pushDocxParagraph(
  children: Array<InstanceType<typeof import("docx").Paragraph>>,
  docx: Pick<typeof import("docx"), "Paragraph" | "TextRun">,
  docxTheme: DocxThemeConfig,
  text: string,
  bold = false,
) {
  if (!text) return;
  children.push(new docx.Paragraph({
    spacing: { after: 90 },
    children: [new docx.TextRun({ text, bold, color: "334155", size: docxTheme.sizes.body, font: docxTheme.font })],
  }));
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function buildExportName(resume: Resume) {
  return sanitizeFileName(resume.title || "录阶简历");
}

function sanitizeFileName(value: string) {
  const sanitized = value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return sanitized || "录阶简历";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadDataUrl(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
