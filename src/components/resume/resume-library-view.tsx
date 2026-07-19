"use client";

import type { RefObject } from "react";
import { ArrowDownUp, Copy, LayoutGrid, List, Plus, Search, Trash2, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ResumeLibraryCard, ResumeLibrarySortMode } from "@/lib/resume-library";
import { RESUME_UPLOAD_ACCEPT } from "@/lib/resume-upload";
import { cn } from "@/lib/utils";

export type ResumeLibraryViewMode = "grid" | "list";

export function ResumeLibraryView({
  cards,
  status,
  savedStatus,
  search,
  sortMode,
  viewMode,
  isImportingResume,
  importInputRef,
  onImportFile,
  onImportButtonClick,
  onCreateResume,
  onSearchChange,
  onSortModeChange,
  onViewModeChange,
  onOpenCard,
  onCopyCard,
  onDeleteCard,
  copyingCardId,
}: {
  cards: ResumeLibraryCard[];
  status: string;
  savedStatus: string;
  search: string;
  sortMode: ResumeLibrarySortMode;
  viewMode: ResumeLibraryViewMode;
  isImportingResume: boolean;
  importInputRef: RefObject<HTMLInputElement | null>;
  onImportFile: (file?: File) => void;
  onImportButtonClick: () => void;
  onCreateResume: () => void;
  onSearchChange: (value: string) => void;
  onSortModeChange: (value: ResumeLibrarySortMode) => void;
  onViewModeChange: (value: ResumeLibraryViewMode) => void;
  onOpenCard: (card: ResumeLibraryCard) => void;
  onCopyCard: (card: ResumeLibraryCard) => void;
  onDeleteCard: (card: ResumeLibraryCard) => void;
  copyingCardId?: string;
}) {
  const t = useTranslations("app.resumeLibrary");
  const optimizedCount = cards.filter((card) => card.kind === "优化后简历").length;

  return (
    <section className="text-foreground">
      <div className="flex flex-col">
        <header className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-normal">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("count", { count: cards.length, optimizedCount })}
            </p>
            {status !== savedStatus && <p className="mt-3 text-xs text-muted-foreground">{status}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={importInputRef}
              type="file"
              className="hidden"
              accept={RESUME_UPLOAD_ACCEPT}
              onChange={(event) => {
                onImportFile(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={onImportButtonClick}
              className="gap-2"
              disabled={isImportingResume}
            >
              <Upload className="h-4 w-4" />
              {isImportingResume ? t("importing") : t("import")}
            </Button>
            <Button onClick={onCreateResume} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("create")}
            </Button>
          </div>
        </header>

        <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex h-11 w-full max-w-md items-center gap-3 rounded-lg border border-line bg-surface px-3 text-sm text-muted-foreground shadow-sm">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("search")}
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="flex items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortMode}
                onChange={(event) => onSortModeChange(event.target.value as ResumeLibrarySortMode)}
                className="bg-transparent outline-none"
              >
                <option value="recent">{t("sortRecent")}</option>
                <option value="recentOptimized">{t("sortRecentOptimized")}</option>
              </select>
            </label>
            <div className="flex h-10 overflow-hidden rounded-lg border border-line bg-surface">
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                className={cn("grid w-10 place-items-center", viewMode === "grid" && "bg-primary text-white")}
                aria-label={t("gridView")}
                title={t("gridView")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("list")}
                className={cn("grid w-10 place-items-center", viewMode === "list" && "bg-primary text-white")}
                aria-label={t("listView")}
                title={t("listView")}
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
          {cards.map((card) => (
            <ResumeCard
              key={card.id}
              card={card}
              viewMode={viewMode}
              onOpen={() => onOpenCard(card)}
              onCopy={() => onCopyCard(card)}
              onDelete={() => onDeleteCard(card)}
              copyDisabled={Boolean(copyingCardId)}
            />
          ))}
        </div>

        {cards.length === 0 && (
          <div className="mt-12 grid min-h-48 place-items-center rounded-xl border border-dashed border-line text-sm text-muted-foreground">
            {t("empty")}
          </div>
        )}
      </div>
    </section>
  );
}

function ResumeCard({
  card,
  viewMode,
  onOpen,
  onCopy,
  onDelete,
  copyDisabled,
}: {
  card: ResumeLibraryCard;
  viewMode: ResumeLibraryViewMode;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  copyDisabled: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("app.resumeLibrary");
  const kindLabel = card.kind === "优化后简历" ? t("kind.optimized") : t("kind.original");
  const updatedAtLabel = card.updatedAtDate
    ? t(`updatedAt.${card.updatedAtKind}`, { date: new Date(card.updatedAtDate).toLocaleDateString(locale) })
    : t(`updatedAt.${card.updatedAtKind}`);

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
              {kindLabel}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCopy();
              }}
              disabled={copyDisabled}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t("copy")}
              title={t("copy")}
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
              aria-label={card.id === "main" ? t("deleteOriginal") : t("deleteResume")}
              title={card.id === "main" ? t("deleteOriginal") : t("deleteResume")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-primary-soft px-2 py-1 text-primary">{t(`templates.${card.templateKey}`)}</span>
          <span>{updatedAtLabel}</span>
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
