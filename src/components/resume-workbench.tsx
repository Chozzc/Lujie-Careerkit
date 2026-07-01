"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownUp,
  Check,
  Download,
  FileSearch,
  FileText,
  FileType,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Palette,
  PanelRightOpen,
  Plus,
  Redo2,
  Save,
  Search,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";

import { EditorCanvas } from "@/components/editor/editor-canvas";
import { EditorPreviewPanel } from "@/components/editor/editor-preview-panel";
import { EditorSidebar } from "@/components/editor/editor-sidebar";
import { AiSetupRequiredDialog } from "@/components/resume-jd-preparation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { buildResumeEditorPath, buildResumeLibraryCards } from "@/lib/resume-library";
import {
  buildAutomaticResumeTitle,
  resolveResumeContentTitle,
  shouldAutoRenameResumeTitle,
} from "@/lib/resume-naming";
import { buildUploadedResumeDraft, RESUME_UPLOAD_ACCEPT } from "@/lib/resume-upload";
import { normalizeOptimizedResumeVersionName } from "@/lib/resume-versioning";
import type { ResumeContent } from "@/lib/types";
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
  onOpenMatch: () => void;
  aiReady: boolean;
  aiMessage: string;
  onOpenSettings: () => void;
  onDeleteMainResume: () => void;
  onDeleteVersion: (versionId: string) => void;
};

type WorkbenchMode = "library" | "editor";
type ResumeCardKind = "原简历" | "优化后简历";
export type ResumeSaveTarget = { kind: "main" } | { kind: "version"; id: string } | { kind: "new" };
type ResumeExportFormat = "pdf" | "word" | "image";
type ViewMode = "grid" | "list";
type SortMode = "recent" | "recentOptimized";

const templateLabels: Record<string, string> = {
  classic: "经典",
  modern: "现代",
  minimal: "极简",
  professional: "专业",
  "two-column": "双栏",
  creative: "创意",
  ats: "ATS",
  academic: "学术",
  elegant: "优雅",
  executive: "高管",
  developer: "开发者",
  designer: "设计师",
  startup: "创业",
  formal: "正式",
  infographic: "信息图",
  compact: "紧凑",
  euro: "欧式",
  clean: "清爽",
  bold: "醒目",
  timeline: "时间线",
  nordic: "北欧",
  corporate: "企业",
  consultant: "咨询",
  finance: "金融",
  medical: "医疗",
  gradient: "渐变",
  metro: "都市",
  material: "材料",
  coder: "代码",
  blocks: "块面",
  magazine: "杂志",
  artistic: "艺术",
  retro: "复古",
  neon: "霓虹",
  watercolor: "水彩",
  swiss: "瑞士",
  japanese: "日式",
  berlin: "柏林",
  luxe: "奢雅",
  rose: "玫瑰",
  architect: "建筑",
  legal: "法律",
  teacher: "教师",
  scientist: "科研",
  engineer: "工程师",
  sidebar: "侧栏",
  card: "卡片",
  zigzag: "折线",
  ribbon: "丝带",
  mosaic: "马赛克",
};

const DEFAULT_EDITOR_THEME: ThemeConfig = {
  primaryColor: "#1a1a2e",
  accentColor: "#e94560",
  fontFamily: "Inter",
  fontSize: "medium",
  lineSpacing: 1.5,
  margin: { top: 20, right: 24, bottom: 20, left: 24 },
  sectionSpacing: 16,
  avatarStyle: "oneInch",
};

const themeColorPresets = [
  { primaryColor: "#111827", accentColor: "#315f92", label: "深蓝灰" },
  { primaryColor: "#1f2937", accentColor: "#64748b", label: "冷静灰" },
  { primaryColor: "#172554", accentColor: "#2563eb", label: "校招蓝" },
  { primaryColor: "#27272a", accentColor: "#a16207", label: "稳重金" },
];

const exportOptions: Array<{
  format: ResumeExportFormat;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}> = [
  { format: "pdf", title: "PDF", subtitle: "按分页导出", icon: FileText },
  { format: "word", title: "Word", subtitle: "可编辑，版式近似", icon: FileType },
  { format: "image", title: "PNG 图片", subtitle: "分页高清长图", icon: ImageIcon },
];

const RESUME_SAVED_STATUS = "已保存到本地 SQLite";
const RESUME_IMPORT_REVIEW_STATUS = "简历解析已完成，部分内容由 AI 自动归类，建议仔细甄别后再使用。";

export function ResumeWorkbench({
  resume,
  resumeUpdatedAt,
  setResume,
  saveResume,
  versions = [],
  initialResumeVersionId,
  mode,
  onModeChange,
  onOpenMatch,
  aiReady,
  aiMessage,
  onOpenSettings,
  onDeleteMainResume,
  onDeleteVersion,
}: ResumeWorkbenchProps) {
  const initialVersion = initialResumeVersionId
    ? versions.find((version) => version.id === initialResumeVersionId)
    : undefined;
  const [editingContent, setEditingContent] = useState<ResumeContent>(initialVersion?.content ?? resume);
  const [editingTitle, setEditingTitle] = useState(initialVersion ? versionTitle(initialVersion) : buildResumeTitle(resume));
  const [editingTarget, setEditingTarget] = useState<ResumeSaveTarget>(
    initialVersion ? { kind: "version", id: initialVersion.id } : { kind: "main" },
  );
  const [status, setStatus] = useState(RESUME_SAVED_STATUS);
  const [showPreview, setShowPreview] = useState(true);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ResumeExportFormat | null>(null);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isImportingResume, setIsImportingResume] = useState(false);
  const [aiSetupDialogOpen, setAiSetupDialogOpen] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
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
        setStatus(RESUME_SAVED_STATUS);
        return;
      }

      const version = versions.find((item) => item.id === versionId);
      if (!version) {
        setStatus("未找到该简历版本，已打开原简历");
        return;
      }

      setEditingContent(version.content);
      setEditingTitle(versionTitle(version));
      setEditingTarget({ kind: "version", id: version.id });
      setStatus(RESUME_SAVED_STATUS);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [resume, versions]);

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
      setStatus(context.source === "auto" ? "正在自动保存..." : "正在保存...");

      try {
        const result = await persistResume(contentWithTitle, target, resolvedTitle);
        if (target.kind === "new" && result.kind === "version") {
          const nextTarget: ResumeSaveTarget = { kind: "version", id: result.version.id };
          setEditingTarget(nextTarget);
          setEditingTitle(versionTitle(result.version));
          window.history.replaceState(null, "", buildResumeEditorPath(nextTarget));
        }
        if (target.kind === "main") {
          setMainResume(contentWithTitle);
        }
        setStatus(
          context.source === "auto"
            ? "已自动保存到本地 SQLite"
            : target.kind === "main"
              ? "原简历已保存到本地 SQLite"
              : "简历已保存到本地 SQLite",
        );
      } catch (error) {
        setStatus(context.source === "auto" ? "自动保存失败，请点击保存重试" : "保存失败，请稍后重试");
        throw error;
      }
    });

    return () => {
      useResumeStore.getState().setPersistence(null);
    };
  }, [mode]);

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
    setStatus(RESUME_SAVED_STATUS);
    setShowThemePanel(false);
    onModeChange("editor");
    const nextPath = target.kind === "new" ? "/resume/edit" : buildResumeEditorPath(target);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }

  function closeEditor() {
    onModeChange("library");
    setShowThemePanel(false);
    if (window.location.pathname !== "/resume") {
      window.history.pushState(null, "", "/resume");
    }
  }

  function handleCreateResume() {
    const blankResume = createBlankResume();
    openEditor(blankResume, "未命名简历", { kind: "new" });
  }

  function showImportReviewStatus() {
    if (importNoticeTimerRef.current !== null) window.clearTimeout(importNoticeTimerRef.current);
    setStatus(RESUME_IMPORT_REVIEW_STATUS);
    importNoticeTimerRef.current = window.setTimeout(() => {
      setStatus((current) => (current === RESUME_IMPORT_REVIEW_STATUS ? RESUME_SAVED_STATUS : current));
      importNoticeTimerRef.current = null;
    }, 6500);
  }

  async function handleImportResume(file?: File, options: { preferLocalFallback?: boolean } = {}) {
    if (!file || isImportingResume) return;
    if (!aiReady && !options.preferLocalFallback) {
      setPendingImportFile(file);
      setAiSetupDialogOpen(true);
      return;
    }

    setIsImportingResume(true);
    setStatus(options.preferLocalFallback ? "正在使用本地兜底解析，效果可能不佳..." : "正在解析并导入简历，可能需要一些时间...");
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
      setStatus(`导入失败：${error instanceof Error ? error.message : "请稍后重试"}`);
    } finally {
      setIsImportingResume(false);
    }
  }

  function importWithLocalFallback() {
    const file = pendingImportFile;
    setPendingImportFile(null);
    if (file) void handleImportResume(file, { preferLocalFallback: true });
  }

  function openAiSettingsForImport() {
    setPendingImportFile(null);
    onOpenSettings();
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
    setStatus("正在保存...");
    await save("manual", { force: true });
  }

  async function handleExport(format: ResumeExportFormat) {
    if (!activeResume || exportingFormat) return;
    setExportingFormat(format);
    setStatus("正在导出...");
    try {
      await exportResume(activeResume, format);
      setStatus(format === "pdf" ? "PDF 已导出" : format === "word" ? "Word 已导出" : "图片已导出");
      setExportDialogOpen(false);
    } catch (error) {
      console.error("Failed to export resume:", error);
      setStatus("导出失败，请稍后重试");
    } finally {
      setExportingFormat(null);
    }
  }

  if (mode === "library") {
    return (
      <section className="text-foreground">
        <div className="flex flex-col">
          <header className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-normal">我的简历</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                共 {resumeCards.length} 份简历 · {resumeCards.filter((card) => card.kind === "优化后简历").length} 份岗位优化版本
              </p>
              {status !== RESUME_SAVED_STATUS && <p className="mt-3 text-xs text-muted-foreground">{status}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={importInputRef}
                type="file"
                className="hidden"
                accept={RESUME_UPLOAD_ACCEPT}
                onChange={(event) => {
                  void handleImportResume(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <Button
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                className="gap-2"
                disabled={isImportingResume}
              >
                <Upload className="h-4 w-4" />
                {isImportingResume ? "解析中..." : "导入简历"}
              </Button>
              <Button onClick={handleCreateResume} className="gap-2">
                <Plus className="h-4 w-4" />
                新建简历
              </Button>
            </div>
          </header>

          <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex h-11 w-full max-w-md items-center gap-3 rounded-lg border border-line bg-surface px-3 text-sm text-muted-foreground shadow-sm">
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索简历..."
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>

            <div className="flex items-center gap-2">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm">
                <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="bg-transparent outline-none"
                >
                  <option value="recent">最近编辑</option>
                  <option value="recentOptimized">最近优化</option>
                </select>
              </label>
              <div className="flex h-10 overflow-hidden rounded-lg border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={cn("grid w-10 place-items-center", viewMode === "grid" && "bg-primary text-white")}
                  aria-label="网格视图"
                  title="网格视图"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn("grid w-10 place-items-center", viewMode === "list" && "bg-primary text-white")}
                  aria-label="列表视图"
                  title="列表视图"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "mt-7",
              viewMode === "grid"
                ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                : "flex flex-col gap-3",
            )}
          >
            {resumeCards.map((card) => (
              <ResumeCard
                key={card.id}
                card={card}
                viewMode={viewMode}
                onOpen={() => openEditor(card.content, card.title, card.target)}
                onDelete={() => {
                  if (card.id === "main") {
                    onDeleteMainResume();
                  } else {
                    onDeleteVersion(card.id);
                  }
                }}
              />
            ))}
          </div>

          {resumeCards.length === 0 && (
            <div className="mt-12 grid min-h-48 place-items-center rounded-xl border border-dashed border-line text-sm text-muted-foreground">
              没有匹配的简历
            </div>
          )}
        </div>
      </section>
    );
  }

  if (!activeResume) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">正在载入简历编辑器...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <section className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3">
          <div className="flex min-w-[220px] shrink-0 items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeEditor} title="返回我的简历">
              <X />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <input
                  value={editingTitle}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  onBlur={handleTitleBlur}
                  className="h-7 min-w-0 max-w-[220px] rounded-md border border-transparent bg-transparent px-2 text-xs font-semibold outline-none hover:border-line hover:bg-surface focus:border-primary focus:bg-white"
                  aria-label="简历名称"
                  title="修改简历名称"
                />
                <Badge variant="secondary" className="text-[0.6875rem]" title={status}>
                  {status === RESUME_IMPORT_REVIEW_STATUS ? "解析完成" : formatEditorSaveStatus(isDirty, isSaving, status)}
                </Badge>
              </div>
              <p className="text-[0.6875rem] text-muted-foreground">
                模板 {templateLabels[activeResume.template] ?? activeResume.template} · {editingTarget.kind === "main" ? "主简历" : "版本简历"}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto">
            <ToolbarButton icon={Undo2} label="撤销" disabled={undoStack.length === 0} onClick={handleUndo} />
            <ToolbarButton icon={Redo2} label="重做" disabled={redoStack.length === 0} onClick={handleRedo} />
            <Separator orientation="vertical" className="mx-1 h-5" />
            <ToolbarButton icon={FileSearch} label="JD匹配优化" showText onClick={onOpenMatch} />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 text-xs"
              aria-label="导出"
              title="导出"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download />
              <span>导出</span>
            </Button>
            <ToolbarButton
              icon={Palette}
              label={showThemePanel ? "关闭主题" : "主题"}
              showText
              onClick={() => setShowThemePanel((value) => !value)}
            />
            <ToolbarButton
              icon={PanelRightOpen}
              label={showPreview ? "隐藏预览" : "显示预览"}
              showText
              onClick={() => setShowPreview((value) => !value)}
            />
            <Button onClick={persistNow} disabled={isSaving} size="sm" className="shrink-0 text-xs">
              <Save data-icon="inline-start" />
              保存
            </Button>
          </div>
        </header>

        <ResumeExportDialog
          open={exportDialogOpen}
          exportingFormat={exportingFormat}
          onOpenChange={setExportDialogOpen}
          onExport={handleExport}
        />
        <AiSetupRequiredDialog
          open={aiSetupDialogOpen}
          title="需要配置阿里百炼"
          message={`${aiMessage} 导入简历建议先配置阿里百炼 / Qwen API Key；稍后再说会使用本地兜底解析，字段归类和准确率可能不佳。图片简历需要配置后才能解析。`}
          secondaryLabel="稍后再说"
          onOpenChange={setAiSetupDialogOpen}
          onOpenSettings={openAiSettingsForImport}
          onSecondary={importWithLocalFallback}
        />

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
              <TemplateBar resume={activeResume} onTemplateChange={handleTemplateChange} />
              {status === RESUME_IMPORT_REVIEW_STATUS ? (
                <div className="border-b border-line bg-surface-low px-4 py-3 md:px-6">
                  <div className="mx-auto max-w-3xl rounded-lg border border-primary/20 bg-white px-4 py-3 text-sm leading-6 text-foreground shadow-sm">
                    {RESUME_IMPORT_REVIEW_STATUS}
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
              <ThemePanel
                theme={activeResume.themeConfig}
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

function ResumeCard({
  card,
  viewMode,
  onOpen,
  onDelete,
}: {
  card: {
    id: string;
    kind: ResumeCardKind;
    title: string;
    detail: string;
    template: string;
    updatedAt: string;
    content: ResumeContent;
    target: ResumeSaveTarget;
  };
  viewMode: ViewMode;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-xl border border-line bg-surface text-left shadow-[0_12px_40px_rgba(49,48,48,0.04)] transition hover:border-primary/35 hover:shadow-[0_14px_44px_rgba(49,48,48,0.08)] focus:outline-none focus:ring-2 focus:ring-primary/20",
        viewMode === "list" && "flex items-center",
      )}
    >
      <div
        className={cn(
          "grid place-items-center bg-surface-low",
          viewMode === "grid" ? "h-44 border-b border-line" : "h-32 w-44 shrink-0 border-r border-line",
        )}
      >
        <ResumeMiniPreview template={card.template} />
      </div>
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-serif text-lg font-semibold">{card.title}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{card.detail}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-surface-mid px-2 py-1 text-[0.6875rem] text-muted-foreground">
              {card.kind}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
              aria-label={card.id === "main" ? "删除原简历" : "删除简历"}
              title={card.id === "main" ? "删除原简历" : "删除简历"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-primary-soft px-2 py-1 text-primary">{card.template}</span>
          <span>{card.updatedAt}</span>
        </div>
      </div>
    </article>
  );
}

function ResumeMiniPreview({ template }: { template: string }) {
  const isModern = template === "现代";
  return (
    <div className="h-36 w-24 overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <div className={cn("h-12 px-3 py-2", isModern ? "bg-[#172554]" : "bg-white")}>
        <div className={cn("h-2 w-14 rounded-full", isModern ? "bg-white/80" : "bg-zinc-700")} />
        <div className={cn("mt-2 h-1.5 w-10 rounded-full", isModern ? "bg-white/50" : "bg-zinc-300")} />
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="h-1.5 w-14 rounded-full bg-[#315f92]" />
        <div className="h-1 w-16 rounded-full bg-zinc-200" />
        <div className="h-1 w-12 rounded-full bg-zinc-200" />
        <div className="mt-3 h-1.5 w-10 rounded-full bg-[#315f92]" />
        <div className="h-1 w-16 rounded-full bg-zinc-200" />
        <div className="h-1 w-11 rounded-full bg-zinc-200" />
      </div>
    </div>
  );
}

function TemplateBar({ resume, onTemplateChange }: { resume: Resume; onTemplateChange: (template: string) => void }) {
  return (
    <div data-tour="template-gallery" className="flex h-11 shrink-0 items-center border-b bg-background px-4">
      <span className="mr-2 shrink-0 text-[0.6875rem] font-medium text-muted-foreground">模板</span>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {TEMPLATES.map((template) => (
          <Button
            key={template}
            variant={resume.template === template ? "default" : "ghost"}
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => onTemplateChange(template)}
          >
            {templateLabels[template] ?? template}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ThemePanel({
  theme,
  onChange,
  onReset,
  onClose,
}: {
  theme: ThemeConfig;
  onChange: (themeConfig: Partial<ThemeConfig>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const margin = theme.margin ?? DEFAULT_EDITOR_THEME.margin;

  return (
    <aside className="fixed bottom-0 right-0 top-12 z-40 flex w-80 shrink-0 flex-col border-l border-line bg-surface p-4 shadow-2xl xl:static xl:shadow-none">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">主题编辑</h2>
          <p className="mt-1 text-xs text-muted-foreground">颜色、字体和页面密度会实时作用到右侧预览。</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title="关闭主题面板">
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <section>
          <p className="mb-2 text-xs font-medium text-muted-foreground">推荐配色</p>
          <div className="grid grid-cols-2 gap-2">
            {themeColorPresets.map((preset) => {
              const active =
                theme.primaryColor === preset.primaryColor && theme.accentColor === preset.accentColor;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onChange({
                      primaryColor: preset.primaryColor,
                      accentColor: preset.accentColor,
                    })
                  }
                  className={cn(
                    "flex items-center justify-between rounded-lg border border-line bg-surface-low px-3 py-2 text-xs",
                    active && "border-primary text-primary",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex overflow-hidden rounded-full border border-line">
                      <span className="h-4 w-4" style={{ backgroundColor: preset.primaryColor }} />
                      <span className="h-4 w-4" style={{ backgroundColor: preset.accentColor }} />
                    </span>
                    {preset.label}
                  </span>
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <ColorField
            label="主色"
            value={theme.primaryColor}
            onChange={(value) => onChange({ primaryColor: value })}
          />
          <ColorField
            label="强调色"
            value={theme.accentColor}
            onChange={(value) => onChange({ accentColor: value })}
          />
        </section>

        <ThemeField label="字体">
          <select
            value={theme.fontFamily}
            onChange={(event) => onChange({ fontFamily: event.target.value })}
            className="w-full rounded-lg border border-line bg-surface-low px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="Inter">Inter</option>
            <option value="'Noto Sans SC'">Noto Sans SC</option>
            <option value="system-ui">System UI</option>
            <option value="Georgia">Georgia</option>
            <option value="Arial">Arial</option>
          </select>
        </ThemeField>

        <ThemeField label="字号">
          <div className="grid grid-cols-3 gap-2">
            {(["small", "medium", "large"] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ fontSize: size })}
                className={cn(
                  "rounded-lg border border-line px-3 py-2 text-xs",
                  theme.fontSize === size ? "bg-primary text-white" : "bg-surface-low text-muted-foreground",
                )}
              >
                {size === "small" ? "小" : size === "medium" ? "中" : "大"}
              </button>
            ))}
          </div>
        </ThemeField>

        <RangeField
          label="行距"
          value={theme.lineSpacing}
          min={1.1}
          max={1.9}
          step={0.1}
          suffix="x"
          onChange={(value) => onChange({ lineSpacing: value })}
        />
        <RangeField
          label="模块间距"
          value={theme.sectionSpacing}
          min={8}
          max={32}
          step={1}
          suffix="px"
          onChange={(value) => onChange({ sectionSpacing: value })}
        />

        <section>
          <p className="mb-2 text-xs font-medium text-muted-foreground">页边距</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["top", "上"],
              ["right", "右"],
              ["bottom", "下"],
              ["left", "左"],
            ] as const).map(([key, label]) => (
              <label key={key} className="block text-xs text-muted-foreground">
                {label}
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={margin[key]}
                  onChange={(event) =>
                    onChange({
                      margin: {
                        ...margin,
                        [key]: Number(event.target.value),
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-line bg-surface-low px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
        </section>

        <ThemeField label="头像样式">
          <div className="grid grid-cols-2 gap-2">
            {([
              ["oneInch", "一寸照"],
              ["circle", "圆形"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ avatarStyle: value })}
                className={cn(
                  "rounded-lg border border-line px-3 py-2 text-xs",
                  theme.avatarStyle === value ? "bg-primary text-white" : "bg-surface-low text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </ThemeField>

      </div>

      <Button variant="outline" onClick={onReset} className="mt-4">
        重置主题
      </Button>
    </aside>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <ThemeField label={label}>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-low px-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-6 w-8" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>
    </ThemeField>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <ThemeField label={`${label} ${value}${suffix}`}>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </ThemeField>
  );
}

function ThemeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function ResumeExportDialog({
  open,
  exportingFormat,
  onOpenChange,
  onExport,
}: {
  open: boolean;
  exportingFormat: ResumeExportFormat | null;
  onOpenChange: (open: boolean) => void;
  onExport: (format: ResumeExportFormat) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="border-b border-line p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                <Download className="h-5 w-5 text-emerald-600" />
                导出简历
              </DialogTitle>
              <DialogDescription className="mt-2">选择导出格式下载当前简历。</DialogDescription>
            </div>
            <DialogClose render={<Button variant="ghost" size="icon" title="关闭导出窗口" />}>
              <X />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {exportOptions.map((option) => {
            const Icon = option.icon;
            const active = exportingFormat === option.format;
            return (
              <button
                key={option.format}
                type="button"
                onClick={() => onExport(option.format)}
                disabled={Boolean(exportingFormat)}
                className={cn(
                  "flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface p-4 text-center transition hover:border-primary/40 hover:bg-primary-soft disabled:cursor-wait disabled:opacity-70",
                  active && "border-emerald-500 bg-emerald-50 text-emerald-700",
                )}
              >
                <Icon className="h-8 w-8" />
                <span className="text-base font-semibold">{active ? "正在导出..." : option.title}</span>
                <span className="text-xs text-muted-foreground">{option.subtitle}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="p-4">
          <DialogClose render={<Button variant="outline" disabled={Boolean(exportingFormat)} />}>取消</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function formatEditorSaveStatus(isDirty: boolean, isSaving: boolean, status: string) {
  if (isSaving) return status.startsWith("正在") ? status : "正在保存...";
  if (isDirty) return "未保存";
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
