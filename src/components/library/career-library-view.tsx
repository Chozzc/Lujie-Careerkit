"use client";

import { useMemo, useState } from "react";
import { FolderKanban, FolderOpen, Pencil, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { InitialData } from "@/components/app/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildCareerArtifacts,
  buildCareerJobArchives,
  filterCareerArtifacts,
  filterCareerJobArchives,
  groupCareerJobArchivesByCompany,
  type CareerArtifact,
  type CareerArtifactCategory,
  type CareerLibraryGroup,
  type CareerJobArchive,
} from "@/lib/career-library";
import { cn } from "@/lib/utils";

export function CareerLibraryView({
  data,
  group,
  onGroupChange,
  onOpenJob,
  onUpdateJob,
  onDeleteJob,
  onOpenArtifact,
  onDeleteArtifact,
}: {
  data: Pick<InitialData, "versions" | "jobs" | "applications" | "interviews" | "interviewPreparations">;
  group: CareerLibraryGroup;
  onGroupChange: (group: CareerLibraryGroup) => void;
  onOpenJob: (id: string) => void;
  onUpdateJob: (id: string, company: string, title: string) => Promise<void>;
  onDeleteJob: (id: string) => void;
  onOpenArtifact: (artifact: CareerArtifact) => void;
  onDeleteArtifact: (artifact: CareerArtifact) => void;
}) {
  const t = useTranslations("careerLibrary");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const [editDraft, setEditDraft] = useState<{ id: string; company: string; title: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const artifacts = useMemo(() => buildCareerArtifacts(data), [data]);
  const archives = useMemo(
    () => buildCareerJobArchives(data, artifacts),
    [artifacts, data],
  );
  const visibleArtifacts = sortByUpdatedAt(filterCareerArtifacts(artifacts, query), sortOrder);
  const visibleArchives = sortByUpdatedAt(filterCareerJobArchives(archives, query), sortOrder);
  const companyGroups = groupCareerJobArchivesByCompany(visibleArchives);
  const generatedCount = artifacts.length;
  const hasItems = group === "job" ? visibleArchives.length > 0 : visibleArtifacts.length > 0;

  return (
    <section className="pb-12">
      <div className="flex flex-col gap-6 border-b border-line pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-normal text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("summary", { jobs: archives.length, artifacts: generatedCount })}
          </p>
        </div>
        <div className="inline-flex self-start rounded-xl border border-line bg-surface-low p-1">
          {(["job", "type"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onGroupChange(item)}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-medium transition",
                group === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`groups.${item}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(group === "job" ? "searchJobs" : "searchArtifacts")}
            className="h-12 w-full rounded-xl border border-line bg-surface pl-12 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </label>
        <select
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value as "recent" | "oldest")}
          className="h-12 rounded-xl border border-line bg-surface px-4 text-sm text-foreground outline-none focus:border-primary/40"
          aria-label={t("sortLabel")}
        >
          <option value="recent">{t("sortRecent")}</option>
          <option value="oldest">{t("sortOldest")}</option>
        </select>
      </div>

      {!hasItems ? (
        <div className="mt-12 grid min-h-72 place-items-center rounded-2xl border border-dashed border-line bg-surface-low/50 text-center">
          <div className="max-w-sm px-6">
            <FolderOpen className="mx-auto h-11 w-11 text-muted-foreground/60" strokeWidth={1.6} />
            <h2 className="mt-4 text-lg font-semibold text-foreground">{t("emptyTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(query ? "emptySearch" : "emptyDescription")}</p>
          </div>
        </div>
      ) : group === "job" ? (
        <div className="mt-9 space-y-10">
          {companyGroups.map((company) => (
            <section key={company.id}>
              <div className="mb-4 flex items-baseline gap-3 border-b border-line pb-3">
                <h2 className="font-serif text-2xl font-semibold text-primary">{company.name}</h2>
                <span className="text-sm text-muted-foreground">
                  {t("jobCount", { count: company.archives.length })}
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {company.archives.map((archive) => (
                  <LibraryCard
                    key={archive.id}
                    title={`${archive.company} · ${archive.role}`}
                    subtitle={archive.city}
                    metrics={jobMetrics(archive, t)}
                    updatedAt={archive.updatedAt}
                    badge={archive.status ? t(`status.${archive.status}`) : undefined}
                    isSample={archive.isSample}
                    onOpen={() => onOpenJob(archive.id)}
                    onEdit={archive.jobId ? () => setEditDraft({ id: archive.jobId!, company: archive.company, title: archive.role }) : undefined}
                    onDelete={() => onDeleteJob(archive.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-9 space-y-11">
          {(["resume", "analysis", "interview"] as CareerArtifactCategory[]).map((category) => {
            const items = visibleArtifacts.filter((artifact) => artifact.category === category);
            if (!items.length) return null;
            return (
              <section key={category}>
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="font-serif text-2xl font-semibold text-primary">{t(`categories.${category}`)}</h2>
                  <span className="text-sm text-muted-foreground">{t("count", { count: items.length })}</span>
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((artifact) => (
                    <LibraryCard
                      key={artifact.key}
                      title={artifactTitle(artifact, t)}
                      subtitle={artifactSubtitle(artifact, t)}
                      metrics={artifactMetrics(artifact, t)}
                      updatedAt={artifact.updatedAt}
                      badge={t(`kinds.${artifact.kind}`)}
                      onOpen={() => onOpenArtifact(artifact)}
                      onDelete={() => onDeleteArtifact(artifact)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Dialog open={Boolean(editDraft)} onOpenChange={(open) => { if (!open && !isSaving) setEditDraft(null); }}>
        <DialogContent>
          <form
            className="contents"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!editDraft) return;
              setIsSaving(true);
              try {
                await onUpdateJob(editDraft.id, editDraft.company.trim(), editDraft.title.trim());
                setEditDraft(null);
              } finally {
                setIsSaving(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("editJob.title")}</DialogTitle>
              <DialogDescription>{t("editJob.description")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="library-job-company">{t("editJob.company")}</Label>
                <Input
                  id="library-job-company"
                  value={editDraft?.company ?? ""}
                  maxLength={100}
                  onChange={(event) => setEditDraft((current) => current ? { ...current, company: event.target.value } : current)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="library-job-title">{t("editJob.role")}</Label>
                <Input
                  id="library-job-title"
                  value={editDraft?.title ?? ""}
                  maxLength={100}
                  onChange={(event) => setEditDraft((current) => current ? { ...current, title: event.target.value } : current)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={isSaving} />}>
                {t("editJob.cancel")}
              </DialogClose>
              <Button type="submit" disabled={isSaving || !editDraft?.company.trim() || !editDraft.title.trim()}>
                {isSaving ? t("editJob.saving") : t("editJob.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LibraryCard({
  title,
  subtitle,
  metrics,
  updatedAt,
  badge,
  isSample = false,
  onOpen,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  metrics: string[];
  updatedAt: string;
  badge?: string;
  isSample?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("careerLibrary");
  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary/20"
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 z-0 rounded-2xl focus:outline-none"
        aria-label={title}
      />
      <div className="pointer-events-none grid h-36 place-items-center border-b border-line bg-surface-low/80">
        <FolderKanban
          className="h-20 w-20 text-primary/70 transition group-hover:scale-[1.03]"
          strokeWidth={1.15}
        />
      </div>
      <div className="pointer-events-none min-h-44 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {isSample ? <Badge variant="outline" className="mb-2">{t("sampleJob")}</Badge> : null}
            <h3 className="line-clamp-2 font-serif text-xl font-semibold leading-7 text-primary">{title}</h3>
            {subtitle ? <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="pointer-events-none relative z-10 flex shrink-0 items-center gap-2">
            {badge ? <Badge variant="secondary">{badge}</Badge> : null}
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-low hover:text-foreground"
                aria-label={t("editJob.action")}
                title={t("editJob.action")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                aria-label={t("delete")}
                title={t("delete")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {metrics.filter(Boolean).map((metric) => <span key={metric}>{metric}</span>)}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t("updatedAt", { date: formatDate(updatedAt) })}</p>
      </div>
    </article>
  );
}

function jobMetrics(archive: CareerJobArchive, t: ReturnType<typeof useTranslations>) {
  const { counts } = archive;
  return [
    counts.analyses ? t("metrics.jobAnalysis", { count: counts.analyses }) : "",
    counts.tailoredResumes ? t("metrics.tailoredResume", { count: counts.tailoredResumes }) : "",
    counts.preparations ? t("metrics.preparation", { count: counts.preparations }) : "",
    counts.interviews ? t("metrics.interview", { count: counts.interviews }) : "",
  ].filter(Boolean);
}

function artifactMetrics(artifact: CareerArtifact, t: ReturnType<typeof useTranslations>) {
  const [first, second, third] = artifact.metrics;
  switch (artifact.kind) {
    case "general-resume":
    case "tailored-resume":
      return [t("metrics.issues", { count: first }), t("metrics.sections", { count: second }), t("metrics.changes", { count: third })];
    case "job-analysis":
      return [t("metrics.originalJd", { count: first })];
    case "interview-preparation":
      return [t("metrics.topics", { count: first }), t("metrics.questions", { count: second }), t("metrics.deepDives", { count: third })];
    case "interview-session":
      return [t("metrics.questions", { count: first }), t("metrics.answers", { count: second }), third ? t("metrics.hasFeedback") : t("metrics.noFeedback")];
  }
}

function artifactTitle(artifact: CareerArtifact, t: ReturnType<typeof useTranslations>) {
  if (artifact.kind === "general-resume" || artifact.kind === "tailored-resume") return artifact.name;
  return `${artifact.name} · ${t(`kindShort.${artifact.kind}`)}`;
}

function artifactSubtitle(artifact: CareerArtifact, t: ReturnType<typeof useTranslations>) {
  if (artifact.kind === "general-resume") return t("generalResumeSubtitle");
  if (artifact.company || artifact.role) return [artifact.company, artifact.role].filter(Boolean).join(" · ");
  return t(`kindDescriptions.${artifact.kind}`);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function sortByUpdatedAt<T extends { updatedAt: string }>(items: T[], order: "recent" | "oldest") {
  return [...items].sort((left, right) =>
    order === "recent"
      ? right.updatedAt.localeCompare(left.updatedAt)
      : left.updatedAt.localeCompare(right.updatedAt),
  );
}
