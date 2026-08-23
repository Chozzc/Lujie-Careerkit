"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, FileSearch, FileStack, FileText, FolderOpen, MessagesSquare, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

import type { InitialData } from "@/components/app/types";
import { PreparationScreen, ReportScreen } from "@/components/interview/interview-workspace";
import {
  buildOptimizationDescription,
  buildOptimizationSummary,
  ResumeOptimizationResult,
} from "@/components/resume/resume-optimization-result";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildCareerArtifacts,
  buildCareerArtifactTree,
  buildCareerJobArchives,
  type CareerArtifact,
  type CareerArtifactCategory,
  type CareerLibraryTarget,
  type CareerTreeNode,
} from "@/lib/career-library";
import { readGeneralResumeOptimizationStages } from "@/lib/resume-optimization-state";
import type { InterviewPreparation } from "@/lib/interview-preparation";
import { interviewQuestionNavTitle } from "@/lib/interview";
import type { InterviewSessionRecord } from "@/lib/interview-service";
import type { JobAnalysis, ResumeContent, ResumeOptimizationMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

type WorkspaceData = Pick<
  InitialData,
  "versions" | "jobs" | "applications" | "interviews" | "interviewPreparations"
>;

const libraryCategoryIcons = {
  analysis: FileSearch,
  resume: FileStack,
  interview: MessagesSquare,
} as const;

const libraryChartColors = ["#7F9CBF", "#9CB69C", "#C3B1D0"];

export function CareerLibraryWorkspace({
  data,
  target,
  onClose,
  onOpenResume,
  onDeleteArtifact,
  onRenameResumeArtifact,
  onUpdateJobDescription,
  onUpdateInterviewPreparation,
  onUpdateInterviewSession,
  onDeleteInterviewSection,
  onRegenerateInterviewReport,
}: {
  data: WorkspaceData;
  target: CareerLibraryTarget;
  onClose: () => void;
  onOpenResume: (versionId: string) => void;
  onDeleteArtifact: (artifact: CareerArtifact) => void;
  onRenameResumeArtifact: (artifact: CareerArtifact, name: string) => Promise<void>;
  onUpdateJobDescription: (jobId: string, jd: string) => Promise<void>;
  onUpdateInterviewPreparation: (id: string, content: InterviewPreparation) => Promise<void>;
  onUpdateInterviewSession: (id: string, input: Pick<InterviewSessionRecord, "context" | "questions" | "answers" | "feedback">) => Promise<void>;
  onDeleteInterviewSection: (id: string, section: "questions" | "feedback") => Promise<void>;
  onRegenerateInterviewReport: (id: string) => Promise<void>;
}) {
  const t = useTranslations("careerLibrary");
  const artifacts = useMemo(() => buildCareerArtifacts(data), [data]);
  const archives = useMemo(() => buildCareerJobArchives(data, artifacts), [artifacts, data]);
  const archive = target.type === "job" ? archives.find((item) => item.id === target.id) : undefined;
  const directArtifact = target.type === "artifact"
    ? artifacts.find((item) => item.kind === target.kind && item.id === target.id)
    : undefined;
  const availableArtifacts = archive?.artifacts ?? (directArtifact ? [directArtifact] : []);
  const [selectedArtifactKey, setSelectedArtifactKey] = useState<string | null>(directArtifact?.key ?? null);
  const selectedArtifact = availableArtifacts.find((item) => item.key === selectedArtifactKey) ?? null;
  const selectedTree = selectedArtifact ? buildCareerArtifactTree(selectedArtifact) : [];
  const [requestedNodeId, setSelectedNodeId] = useState(selectedTree[0]?.id ?? "overview");
  const selectedNodeId = selectedTree.some((node) => node.id === requestedNodeId)
    ? requestedNodeId
    : selectedTree[0]?.id ?? requestedNodeId;
  const preparationOpen = selectedArtifact?.source.type === "interview-preparation";
  const backToOverview = Boolean(archive && selectedArtifact);

  if (!archive && !directArtifact) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">{t("notFoundTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("notFoundDescription")}</p>
          <Button className="mt-6" onClick={onClose}>{t("backToLibrary")}</Button>
        </div>
      </div>
    );
  }

  const title = archive ? `${archive.company} · ${archive.role}` : artifactTitle(directArtifact!, t);
  const updatedAt = archive?.updatedAt ?? directArtifact!.updatedAt;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="no-print sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-line bg-background/95 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => backToOverview ? setSelectedArtifactKey(null) : onClose()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-low hover:text-foreground"
            aria-label={t(backToOverview ? "backToOverview" : "backToLibrary")}
            title={t(backToOverview ? "backToOverview" : "backToLibrary")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-lg font-semibold text-primary sm:text-xl">{title}</h1>
              {directArtifact ? <Badge variant="secondary">{t(`kinds.${directArtifact.kind}`)}</Badge> : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("updatedAt", { date: formatDate(updatedAt) })}</p>
          </div>
        </div>
      </header>

      <div className={cn("grid min-h-[calc(100vh-4rem)]", !preparationOpen && "lg:grid-cols-[19rem_minmax(0,1fr)]")}>
        {!preparationOpen ? <aside className="no-print border-b border-line bg-surface-low/60 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="p-4 lg:p-5">
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("outline")}
            </p>
            {archive ? (
              <JobTree
                artifacts={archive.artifacts}
                selectedArtifactKey={selectedArtifact?.key ?? null}
                selectedNodeId={selectedNodeId}
                onSelectOverview={() => setSelectedArtifactKey(null)}
                onSelect={(artifact, nodeId) => {
                  setSelectedArtifactKey(artifact.key);
                  setSelectedNodeId(nodeId);
                }}
                onDelete={onDeleteArtifact}
                onRename={onRenameResumeArtifact}
                onDeleteInterviewSection={onDeleteInterviewSection}
              />
            ) : (
              <ArtifactTree
                artifact={directArtifact!}
                nodes={buildCareerArtifactTree(directArtifact!)}
                selectedNodeId={selectedNodeId}
                onSelect={setSelectedNodeId}
                onDelete={onDeleteArtifact}
                onRename={onRenameResumeArtifact}
                onDeleteInterviewSection={onDeleteInterviewSection}
              />
            )}
          </div>
        </aside> : null}

        <main className="min-w-0 bg-background px-4 py-7 sm:px-8 lg:px-12 lg:py-10">
          <div className={cn("mx-auto", selectedArtifact?.source.type === "resume-version" || selectedArtifact?.source.type === "interview-session" || preparationOpen ? "max-w-7xl" : "max-w-5xl")}>
            {archive && !selectedArtifact ? (
              <JobOverview
                archive={archive}
                onSelect={(artifact) => {
                  setSelectedArtifactKey(artifact.key);
                  setSelectedNodeId(buildCareerArtifactTree(artifact)[0]?.id ?? "overview");
                }}
              />
            ) : selectedArtifact ? (
              <ArtifactContent
                artifact={selectedArtifact}
                nodeId={selectedNodeId}
                jobAnalysis={data.jobs.find((job) => job.id === selectedArtifact.jobId)?.analysis}
                onOpenResume={onOpenResume}
                onUpdateJobDescription={onUpdateJobDescription}
                onUpdateInterviewPreparation={onUpdateInterviewPreparation}
                onUpdateInterviewSession={onUpdateInterviewSession}
                onRegenerateInterviewReport={onRegenerateInterviewReport}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function JobTree({
  artifacts,
  selectedArtifactKey,
  selectedNodeId,
  onSelectOverview,
  onSelect,
  onDelete,
  onRename,
  onDeleteInterviewSection,
}: {
  artifacts: CareerArtifact[];
  selectedArtifactKey: string | null;
  selectedNodeId: string;
  onSelectOverview: () => void;
  onSelect: (artifact: CareerArtifact, nodeId: string) => void;
  onDelete: (artifact: CareerArtifact) => void;
  onRename: (artifact: CareerArtifact, name: string) => Promise<void>;
  onDeleteInterviewSection: (id: string, section: "questions" | "feedback") => Promise<void>;
}) {
  const t = useTranslations("careerLibrary");
  const [expandedCategories, setExpandedCategories] = useState<Set<CareerArtifactCategory>>(() => new Set());
  return (
    <nav className="space-y-1">
      <button
        type="button"
        onClick={onSelectOverview}
        className={cn(
          "flex h-10 w-full items-center rounded-md pl-8 pr-2 text-left text-sm transition",
          selectedArtifactKey
            ? "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
            : "bg-foreground/[0.04] font-semibold text-primary",
        )}
      >
        <span className="truncate">{t("tree.job-overview")}</span>
      </button>
      {(["analysis", "resume", "interview"] as CareerArtifactCategory[]).map((category) => {
        const categoryArtifacts = artifacts.filter((artifact) => artifact.category === category);
        const expanded = expandedCategories.has(category);
        const Icon = libraryCategoryIcons[category];
        return (
          <section key={category}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedCategories((current) => {
                const next = new Set(current);
                if (next.has(category)) next.delete(category);
                else next.add(category);
                return next;
              })}
              className={cn(
                "flex h-10 w-full items-center justify-between gap-3 rounded-md px-2 text-left transition hover:bg-foreground/[0.04]",
                expanded && "font-semibold text-primary",
              )}
            >
              <h2 className="flex min-w-0 items-center gap-2 text-sm">
                <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition", expanded && "rotate-90")} />
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.65} />
                <span className="truncate">{t(`categories.${category}`)}</span>
              </h2>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {t("categoryCount", { count: categoryArtifacts.length })}
              </span>
            </button>
            {expanded ? <div className="ml-5 space-y-1">
              {categoryArtifacts.length ? categoryArtifacts.map((artifact) => {
                const tree = buildCareerArtifactTree(artifact);
                const childNodes = artifact.source.type === "interview-session" ? tree : tree.slice(1);
                const isSelected = selectedArtifactKey === artifact.key;
                return (
                  <div key={artifact.key}>
                    <ArtifactTreeRow
                      artifact={artifact}
                      active={artifact.source.type !== "interview-session" && isSelected && selectedNodeId === tree[0]?.id}
                      onClick={() => onSelect(artifact, tree[0]?.id ?? "overview")}
                      onDelete={() => onDelete(artifact)}
                      onRename={(name) => onRename(artifact, name)}
                      showDelete={artifact.source.type !== "interview-session"}
                    />
                    {isSelected && childNodes.length ? (
                      <TreeNodes
                        artifact={artifact}
                        nodes={childNodes}
                        selectedNodeId={selectedNodeId}
                        depth={2}
                        onSelect={(nodeId) => onSelect(artifact, nodeId)}
                        onDeleteNode={artifact.source.type === "interview-session"
                          ? (nodeId) => void onDeleteInterviewSection(artifact.id, nodeId as "questions" | "feedback")
                          : undefined}
                      />
                    ) : null}
                  </div>
                );
              }) : (
                <p className="px-3 py-3 text-xs leading-5 text-muted-foreground">
                  {t(`emptyCategories.${category}`)}
                </p>
              )}
            </div> : null}
          </section>
        );
      })}
    </nav>
  );
}

function ArtifactTree({ artifact, nodes, selectedNodeId, onSelect, onDelete, onRename, onDeleteInterviewSection }: {
  artifact: CareerArtifact;
  nodes: CareerTreeNode[];
  selectedNodeId: string;
  onSelect: (nodeId: string) => void;
  onDelete: (artifact: CareerArtifact) => void;
  onRename: (artifact: CareerArtifact, name: string) => Promise<void>;
  onDeleteInterviewSection: (id: string, section: "questions" | "feedback") => Promise<void>;
}) {
  const childNodes = artifact.source.type === "interview-session" ? nodes : nodes.slice(1);
  return (
    <nav className="space-y-1">
      <ArtifactTreeRow
        artifact={artifact}
        active={artifact.source.type !== "interview-session" && selectedNodeId === (nodes[0]?.id ?? "overview")}
        onClick={() => onSelect(nodes[0]?.id ?? "overview")}
        onDelete={() => onDelete(artifact)}
        onRename={(name) => onRename(artifact, name)}
        showDelete={artifact.source.type !== "interview-session"}
      />
      {childNodes.length ? (
        <TreeNodes
          artifact={artifact}
          nodes={childNodes}
          selectedNodeId={selectedNodeId}
          depth={1}
          onSelect={onSelect}
          onDeleteNode={artifact.source.type === "interview-session"
            ? (nodeId) => void onDeleteInterviewSection(artifact.id, nodeId as "questions" | "feedback")
            : undefined}
        />
      ) : null}
    </nav>
  );
}

function ArtifactTreeRow({
  artifact,
  active,
  onClick,
  onDelete,
  onRename,
  showDelete = true,
}: {
  artifact: CareerArtifact;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => Promise<void>;
  showDelete?: boolean;
}) {
  const t = useTranslations("careerLibrary");
  const editable = artifact.source.type === "resume-version";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(artifact.name);
  const [saving, setSaving] = useState(false);

  async function save() {
    const name = draft.trim();
    if (!editable || saving) return;
    if (!name || name === artifact.name) {
      setDraft(artifact.name);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(name);
      setEditing(false);
    } catch {
      // The parent reports the persistence error and the input stays open for retrying.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("flex h-10 min-w-0 items-center gap-1 rounded-md pr-1", active && "bg-foreground/[0.05]")}>
      {editing ? (
        <input
          autoFocus
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") {
              setDraft(artifact.name);
              setEditing(false);
            }
          }}
          className="ml-2 min-w-0 flex-1 rounded-md border border-primary/30 bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/15"
          aria-label={t("editArtifactName")}
          title={artifact.name}
        />
      ) : (
        <button
          type="button"
          onClick={onClick}
          onDoubleClick={() => {
            if (!editable) return;
            setDraft(artifact.name);
            setEditing(true);
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-lg px-2 text-left text-sm transition",
            active ? "text-primary" : "text-muted-foreground hover:bg-surface/70 hover:text-foreground",
          )}
          title={editable ? t("doubleClickToRename", { name: artifact.name }) : artifactTreeTitle(artifact, t)}
        >
          <span className="truncate">{artifactTreeTitle(artifact, t)}</span>
        </button>
      )}
      {showDelete ? <button
        type="button"
        onClick={onDelete}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
        aria-label={t("delete")}
        title={t("delete")}
      >
        <Trash2 className="h-4 w-4" />
      </button> : null}
    </div>
  );
}

function TreeNodes({ artifact, nodes, selectedNodeId, depth, onSelect, onDeleteNode }: {
  artifact: CareerArtifact;
  nodes: CareerTreeNode[];
  selectedNodeId: string;
  depth: number;
  onSelect: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}) {
  const t = useTranslations("careerLibrary");
  return (
    <div className={cn(depth > 0 && "mt-1 space-y-1")}>
      {nodes.map((node, index) => (
        <div key={node.id}>
          <div className="flex min-w-0 items-center gap-1 pr-1">
          <TreeButton active={selectedNodeId === node.id} depth={depth} onClick={() => onSelect(node.id)}>
            <span className="truncate">{treeNodeLabel(artifact, node.id, index, t)}</span>
          </TreeButton>
          {onDeleteNode && (node.id === "questions" || node.id === "feedback") ? <button
            type="button"
            onClick={() => onDeleteNode(node.id)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
            aria-label={t("delete")}
            title={t("delete")}
          ><Trash2 className="h-4 w-4" /></button> : null}
          </div>
          {node.children?.length ? (
            <TreeNodes
              artifact={artifact}
              nodes={node.children}
              selectedNodeId={selectedNodeId}
              depth={depth + 1}
              onSelect={onSelect}
              onDeleteNode={onDeleteNode}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TreeButton({ active, depth, onClick, children }: {
  active: boolean;
  depth: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      className={cn(
        "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg pr-2 text-left text-sm transition",
        active ? "bg-foreground/[0.05] text-primary" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function JobOverview({
  archive,
  onSelect,
}: {
  archive: ReturnType<typeof buildCareerJobArchives>[number];
  onSelect: (artifact: CareerArtifact) => void;
}) {
  const t = useTranslations("careerLibrary");
  const categories = [
    { key: "analysis", icon: FileSearch, artifacts: archive.artifacts.filter((artifact) => artifact.category === "analysis") },
    { key: "resume", icon: FileStack, artifacts: archive.artifacts.filter((artifact) => artifact.category === "resume") },
    { key: "interview", icon: MessagesSquare, artifacts: archive.artifacts.filter((artifact) => artifact.category === "interview") },
  ] as const;
  const chartData = categories.map((category, index) => ({
    key: category.key,
    label: t(`categories.${category.key}`),
    count: category.artifacts.length,
    color: libraryChartColors[index],
  }));
  const chartTotal = chartData.reduce((sum, item) => sum + item.count, 0);
  return (
    <ContentPage
      title={`${archive.company} · ${archive.role}`}
      description={t("overviewSummary", {
        count: archive.artifacts.length,
        date: formatDate(archive.updatedAt),
      })}
    >
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <header className="border-b border-line px-5 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-primary">{t("overviewPathTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("overviewPathDescription")}</p>
        </header>
        <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {categories.map(({ key, icon: Icon, artifacts }) => {
            const latest = artifacts[0];
            return (
              <button
                key={key}
                type="button"
                disabled={!latest}
                onClick={() => latest && onSelect(latest)}
                className="group min-h-40 px-5 py-5 text-left transition hover:bg-surface-low disabled:cursor-default disabled:hover:bg-transparent sm:px-6"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-low text-primary/75">
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {t("categoryCount", { count: artifacts.length })}
                  </span>
                </span>
                <span className="mt-5 block font-semibold text-primary">{t(`categories.${key}`)}</span>
                <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">
                  {t(`overviewPath.${key}`)}
                </span>
                <span className={cn(
                  "mt-4 flex items-center justify-between gap-3 text-xs",
                  latest ? "text-foreground/75" : "text-muted-foreground",
                )}>
                  <span className="truncate">{latest ? artifactTreeTitle(latest, t) : t("overviewPath.empty")}</span>
                  {latest ? <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <header className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-primary">{t("jobFilesTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("jobFilesDescription")}</p>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {t("categoryCount", { count: archive.artifacts.length })}
          </span>
        </header>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {archive.artifacts.map((artifact) => (
            <button
              key={artifact.key}
              type="button"
              onClick={() => onSelect(artifact)}
              className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-surface-low sm:px-6"
            >
              <FileText className="h-5 w-5 shrink-0 text-primary/65" strokeWidth={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{artifactTreeTitle(artifact, t)}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t(`categories.${artifact.category}`)} · {t("updatedAt", { date: formatDate(artifact.updatedAt) })}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <header>
          <h3 className="text-base font-semibold text-primary">{t("overviewCompositionTitle")}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("overviewCompositionDescription")}</p>
        </header>
        <div className="mt-5 grid items-center gap-5 md:grid-cols-[minmax(17rem,1fr)_minmax(16rem,0.8fr)] md:gap-10">
          <div className="relative h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={160}>
              <PieChart>
                <defs>
                  {chartData.map((item) => (
                    <linearGradient key={item.key} id={`library-composition-${item.key}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={item.color} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={item.color} stopOpacity={0.68} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={72}
                  outerRadius={108}
                  paddingAngle={3}
                  stroke="none"
                >
                  {chartData.map((item) => (
                    <Cell key={item.key} fill={`url(#library-composition-${item.key})`} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5DDD0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <strong className="font-serif text-4xl font-normal tabular-nums text-primary">{chartTotal}</strong>
              <span className="mt-1 text-xs text-muted-foreground">{t("overviewCompositionTitle")}</span>
            </div>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {chartData.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-5 py-4">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {t("categoryCount", { count: item.count })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ContentPage>
  );
}

function ArtifactContent({
  artifact,
  nodeId,
  jobAnalysis,
  onOpenResume,
  onUpdateJobDescription,
  onUpdateInterviewPreparation,
  onUpdateInterviewSession,
  onRegenerateInterviewReport,
}: {
  artifact: CareerArtifact;
  nodeId: string;
  jobAnalysis?: JobAnalysis | null;
  onOpenResume: (versionId: string) => void;
  onUpdateJobDescription: (jobId: string, jd: string) => Promise<void>;
  onUpdateInterviewPreparation: (id: string, content: InterviewPreparation) => Promise<void>;
  onUpdateInterviewSession: (id: string, input: Pick<InterviewSessionRecord, "context" | "questions" | "answers" | "feedback">) => Promise<void>;
  onRegenerateInterviewReport: (id: string) => Promise<void>;
}) {
  switch (artifact.source.type) {
    case "resume-version":
      return (
        <ResumeArtifactContent
          artifact={artifact}
          nodeId={nodeId}
          jobAnalysis={jobAnalysis}
          onOpenResume={onOpenResume}
        />
      );
    case "job":
      return <JobAnalysisContent artifact={artifact} onSave={onUpdateJobDescription} />;
    case "interview-preparation":
      return <InterviewPreparationContent artifact={artifact} onSave={onUpdateInterviewPreparation} />;
    case "interview-session":
      return <InterviewSessionContent artifact={artifact} nodeId={nodeId} onSave={onUpdateInterviewSession} onRegenerateReport={onRegenerateInterviewReport} />;
  }
}

function ResumeArtifactContent({
  artifact,
  nodeId,
  jobAnalysis,
  onOpenResume,
}: {
  artifact: CareerArtifact;
  nodeId: string;
  jobAnalysis?: JobAnalysis | null;
  onOpenResume: (versionId: string) => void;
}) {
  const t = useTranslations("careerLibrary");
  const matchT = useTranslations("match");
  if (artifact.source.type !== "resume-version") return null;
  const version = artifact.source.value;
  const stages = readGeneralResumeOptimizationStages(version.content);
  const meta = readOptimizationMeta(version.content);
  const base = readOptimizationBase(version.content);
  const sectionId = nodeId.startsWith("change:") ? nodeId.slice(7) : null;

  if ((nodeId === "overview" || nodeId === "optimized-resume") && base) {
    const mode = artifact.kind === "general-resume" ? "general" : "jd";
    return (
      <ResumeOptimizationResult
        workflowLabels={mode === "jd"
          ? [matchT("steps.select"), matchT("steps.optimize"), matchT("steps.preview")]
          : [matchT("steps.current"), matchT("steps.generalOptimize"), matchT("steps.preview")]}
        currentStep={2}
        showWorkflow={false}
        title={mode === "jd"
          ? [artifact.company, artifact.role].filter(Boolean).join(" · ") || matchT("result.jdComplete")
          : matchT("result.generalComplete")}
        description={buildOptimizationDescription(base, version.content, { mode, meta: meta ?? undefined })}
        before={base}
        after={version.content}
        summaryItems={buildOptimizationSummary(base, version.content, {
          mode,
          analysis: jobAnalysis ?? undefined,
          meta: meta ?? undefined,
        })}
        openEditorLabel={t("openResumeEditor")}
        onOpenEditor={() => onOpenResume(version.id)}
      />
    );
  }

  if (nodeId === "original-resume" && base) {
    return (
      <ContentPage title={t("tree.original-resume")} description={t("originalResumeDescription")}>
        <ResumeDocument content={base} />
      </ContentPage>
    );
  }
  if (nodeId === "optimized-resume") {
    return (
      <ContentPage title={t("tree.optimized-resume")} description={version.name}>
        <ResumeDocument content={version.content} />
      </ContentPage>
    );
  }
  if (nodeId === "job-relation") {
    return (
      <ContentPage title={t("tree.job-relation")} description={[artifact.company, artifact.role].filter(Boolean).join(" · ")}>
        <DefinitionGrid items={[
          [t("labels.company"), artifact.company || t("unknown")],
          [t("labels.role"), artifact.role || t("unknown")],
          [t("labels.keywords"), meta?.keywords.join("、") || t("notRecorded")],
        ]} />
      </ContentPage>
    );
  }
  if (nodeId === "diagnosis" || nodeId === "diagnosis-summary") {
    return <TextPage title={t("tree.diagnosis-summary")} text={stages?.diagnosis?.summary || t("notRecorded")} />;
  }
  if (nodeId === "strengths") {
    return <ListPage title={t("tree.strengths")} items={stages?.diagnosis?.strengths ?? []} />;
  }
  if (nodeId === "issues") {
    return (
      <ContentPage title={t("tree.issues")} description={t("issuesDescription")}>
        <div className="space-y-3">
          {(stages?.diagnosis?.issues ?? []).map((issue) => (
            <div key={issue.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={issue.severity === "high" ? "destructive" : "secondary"}>{t(`severity.${issue.severity}`)}</Badge>
                <h3 className="font-semibold">{issue.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.explanation}</p>
              <p className="mt-2 text-sm leading-6"><span className="font-medium">{t("labels.suggestion")}：</span>{issue.suggestion}</p>
            </div>
          ))}
        </div>
      </ContentPage>
    );
  }
  if (nodeId === "changes") {
    return <ListPage title={t("tree.changes")} items={meta?.changes ?? []} empty={t("notRecorded")} />;
  }
  if (sectionId && base) {
    return (
      <ContentPage title={t(`resumeSections.${sectionId}`)} description={t("beforeAfterDescription")}>
        <div className="grid gap-5 xl:grid-cols-2">
          <ResumeSectionPanel title={t("before")} content={base} sectionId={sectionId} />
          <ResumeSectionPanel title={t("after")} content={version.content} sectionId={sectionId} emphasized />
        </div>
      </ContentPage>
    );
  }
  return (
    <ContentPage title={artifactTitle(artifact, t)} description={version.summary || t(`kindDescriptions.${artifact.kind}`)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard value={artifact.metrics[0]} label={t("overviewMetrics.issues")} />
        <MetricCard value={artifact.metrics[1]} label={t("overviewMetrics.sections")} />
        <MetricCard value={artifact.metrics[2]} label={t("overviewMetrics.changes")} />
      </div>
      {meta?.summary ? <ContentSection title={t("optimizationSummary")}><p>{meta.summary}</p></ContentSection> : null}
    </ContentPage>
  );
}

function JobAnalysisContent({ artifact, onSave }: { artifact: CareerArtifact; onSave: (jobId: string, jd: string) => Promise<void> }) {
  const t = useTranslations("careerLibrary");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(artifact.source.type === "job" ? artifact.source.value.jd : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (artifact.source.type !== "job") return null;
  const job = artifact.source.value;
  return <ContentPage title={t("tree.original-jd")}>
    {editing ? <div className="flex justify-end gap-2">
      <>
        <Button variant="outline" disabled={saving} onClick={() => { setDraft(job.jd); setEditing(false); setError(""); }}>{t("edit.cancel")}</Button>
        <Button disabled={saving || !draft.trim()} onClick={() => void (async () => { setSaving(true); setError(""); try { await onSave(job.id, draft.trim()); setEditing(false); } catch (cause) { setError(cause instanceof Error ? cause.message : t("edit.failed")); } finally { setSaving(false); } })()}>{t("edit.save")}</Button>
      </>
    </div> : null}
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
    {editing
      ? <textarea className="min-h-[32rem] w-full resize-y rounded-xl border border-line bg-surface p-5 text-sm leading-7 outline-none focus:border-primary/40" value={draft} onChange={(event) => setDraft(event.target.value)} />
      : <div className="relative whitespace-pre-wrap rounded-2xl border border-line bg-surface p-6 pr-16 text-sm leading-7">
          <EditIconButton label={t("edit.action")} onClick={() => { setEditing(true); setError(""); }} className="absolute right-4 top-4" />
          {job.jd}
        </div>}
  </ContentPage>;
}

function InterviewPreparationContent({ artifact, onSave }: { artifact: CareerArtifact; onSave: (id: string, content: InterviewPreparation) => Promise<void> }) {
  if (artifact.source.type !== "interview-preparation") return null;
  const record = artifact.source.value;
  return <PreparationScreen key={`${record.id}:${record.updatedAt}`} preparation={record.content} resumeName={record.context.resumeName} isWorking={false} message="" onBack={() => {}} onStart={() => {}} libraryMode onSave={(content) => onSave(record.id, content)} />;
}

function InterviewSessionContent({ artifact, nodeId, onSave, onRegenerateReport }: { artifact: CareerArtifact; nodeId: string; onSave: (id: string, input: Pick<InterviewSessionRecord, "context" | "questions" | "answers" | "feedback">) => Promise<void>; onRegenerateReport: (id: string) => Promise<void> }) {
  const t = useTranslations("careerLibrary");
  const initialSession = artifact.source.type === "interview-session" ? artifact.source.value : null;
  const [draft, setDraft] = useState(initialSession);
  const [editing, setEditing] = useState(false);
  const [editingAnswersOnly, setEditingAnswersOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeQuestionId, setActiveQuestionId] = useState(initialSession?.questions[0]?.id ?? "");

  useEffect(() => {
    if (!initialSession?.questions.length) return;
    const updateActiveQuestion = () => {
      let current = initialSession.questions[0].id;
      for (const question of initialSession.questions) {
        const section = document.getElementById(`interview-question-${question.id}`);
        if (section && section.getBoundingClientRect().top <= 180) current = question.id;
      }
      setActiveQuestionId(current);
    };
    updateActiveQuestion();
    window.addEventListener("scroll", updateActiveQuestion, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveQuestion);
  }, [initialSession]);
  if (artifact.source.type !== "interview-session") return null;
  const session = artifact.source.value;
  if (editing && draft) {
    return <ContentPage title={editingAnswersOnly ? t("edit.answersTitle") : t("edit.mockInterviewTitle")}>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={saving} onClick={() => { setDraft(session); setEditing(false); setEditingAnswersOnly(false); setError(""); }}>{t("edit.cancel")}</Button>
        <Button disabled={saving} onClick={() => void (async () => { setSaving(true); setError(""); try { await onSave(session.id, { context: draft.context, questions: draft.questions, answers: draft.answers, feedback: draft.feedback }); setEditing(false); setEditingAnswersOnly(false); } catch (cause) { setError(cause instanceof Error ? cause.message : t("edit.failed")); } finally { setSaving(false); } })()}>{t("edit.save")}</Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
        {!editingAnswersOnly ? <>
          <EditField label={t("labels.company")} value={draft.context.company} onChange={(company) => setDraft({ ...draft, context: { ...draft.context, company } })} />
          <EditField label={t("labels.role")} value={draft.context.title} onChange={(title) => setDraft({ ...draft, context: { ...draft.context, title } })} />
          <EditField label={t("tree.original-jd")} value={draft.context.jd} multiline onChange={(jd) => setDraft({ ...draft, context: { ...draft.context, jd } })} />
        </> : null}
        {draft.questions.map((question, index) => <div key={question.id} className="space-y-3 rounded-xl border border-line p-4">
          <p className="font-semibold">{t("edit.question", { number: index + 1 })}</p>
          {!editingAnswersOnly ? <>
            <EditField label={t("edit.questionText")} value={question.prompt} multiline onChange={(prompt) => setDraft({ ...draft, questions: draft.questions.map((item) => item.id === question.id ? { ...item, prompt } : item) })} />
            <EditField label={t("edit.questionFocus")} value={question.focus} multiline onChange={(focus) => setDraft({ ...draft, questions: draft.questions.map((item) => item.id === question.id ? { ...item, focus } : item) })} />
          </> : null}
          <EditField label={t("answer")} value={draft.answers[question.id]?.content ?? ""} multiline onChange={(content) => setDraft({ ...draft, answers: { ...draft.answers, [question.id]: { questionId: question.id, content, skipped: false, updatedAt: new Date().toISOString() } } })} />
        </div>)}
        {!editingAnswersOnly && draft.feedback ? <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <EditNumberField label={t("edit.overallScore")} value={draft.feedback.overallScore} onChange={(overallScore) => setDraft({ ...draft, feedback: draft.feedback ? { ...draft.feedback, overallScore } : null })} />
            {(["jobFit", "structure", "evidence", "star"] as const).map((key) => <EditNumberField key={key} label={t(`edit.dimensions.${key}`)} value={draft.feedback!.dimensions[key]} onChange={(score) => setDraft({ ...draft, feedback: draft.feedback ? { ...draft.feedback, dimensions: { ...draft.feedback.dimensions, [key]: score } } : null })} />)}
          </div>
          <EditField label={t("strengths")} value={draft.feedback.strengths.join("\n")} multiline onChange={(value) => setDraft({ ...draft, feedback: draft.feedback ? { ...draft.feedback, strengths: splitLines(value) } : null })} />
          <EditField label={t("improvements")} value={draft.feedback.improvements.join("\n")} multiline onChange={(value) => setDraft({ ...draft, feedback: draft.feedback ? { ...draft.feedback, improvements: splitLines(value) } : null })} />
          {draft.feedback.questionReviews.map((review, index) => <div key={review.questionId} className="space-y-3 rounded-xl border border-line p-4"><p className="font-semibold">{t("edit.review", { number: index + 1 })}</p><EditField label={t("edit.diagnosis")} value={review.diagnosis} multiline onChange={(diagnosis) => setDraft({ ...draft, feedback: draft.feedback ? { ...draft.feedback, questionReviews: draft.feedback.questionReviews.map((item) => item.questionId === review.questionId ? { ...item, diagnosis } : item) } : null })} /><EditField label={t("edit.suggestion")} value={review.suggestion} multiline onChange={(suggestion) => setDraft({ ...draft, feedback: draft.feedback ? { ...draft.feedback, questionReviews: draft.feedback.questionReviews.map((item) => item.questionId === review.questionId ? { ...item, suggestion } : item) } : null })} /><EditField label={t("edit.referenceAnswer")} value={review.improvedAnswer} multiline onChange={(improvedAnswer) => setDraft({ ...draft, feedback: draft.feedback ? { ...draft.feedback, questionReviews: draft.feedback.questionReviews.map((item) => item.questionId === review.questionId ? { ...item, improvedAnswer } : item) } : null })} /></div>)}
          <EditField label={t("nextActions")} value={draft.feedback.nextActions.join("\n")} multiline onChange={(value) => setDraft({ ...draft, feedback: draft.feedback ? { ...draft.feedback, nextActions: splitLines(value) } : null })} />
        </> : null}
      </div>
    </ContentPage>;
  }
  if (nodeId === "questions") {
    return <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="no-print px-2 py-3 lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{t("questionOutline")}</p>
        <nav className="mt-3" aria-label={t("questionOutline")}>
          <ol className="space-y-1">
            {session.questions.map((question, index) => <li key={question.id}>
              <a
                href={`#interview-question-${question.id}`}
                onClick={() => setActiveQuestionId(question.id)}
                aria-current={activeQuestionId === question.id ? "location" : undefined}
                title={question.prompt}
                className={cn(
                  "flex gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
                  activeQuestionId === question.id
                    ? "border-brand bg-brand-muted font-medium text-brand"
                    : "border-transparent text-muted-foreground hover:bg-surface-low hover:text-foreground",
                )}
              >
                <span className="font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span>
                <span className="line-clamp-2">{interviewQuestionNavTitle(question)}</span>
              </a>
            </li>)}
          </ol>
        </nav>
      </aside>
      <article className="min-w-0 space-y-5">
        <div className="space-y-5">
          {session.questions.map((question, index) => {
            const answer = session.answers[question.id];
            return <section id={`interview-question-${question.id}`} key={question.id} className="relative scroll-mt-24 overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              <div className={cn("border-b border-line bg-surface-low px-5 py-5 lg:px-7", index === 0 && "pr-16 lg:pr-16")}>
                <div className="flex items-start gap-3"><span className="font-mono text-xs font-semibold text-brand">{String(index + 1).padStart(2, "0")}</span><div><h3 className="font-semibold leading-6">{question.prompt}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{question.focus}</p></div></div>
              </div>
              {index === 0 ? <EditIconButton label={t("edit.action")} onClick={() => { setDraft(session); setEditingAnswersOnly(false); setEditing(true); setError(""); }} className="absolute right-3 top-3" /> : null}
              <div className="px-5 py-6 lg:px-7"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t("answer")}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{answer?.content || t("unanswered")}</p></div>
            </section>;
          })}
        </div>
        <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("regenerateFeedbackHint")}</p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" disabled={regenerating} onClick={() => { setDraft(session); setEditingAnswersOnly(true); setEditing(true); setError(""); }}><Pencil data-icon="inline-start" />{t("editAnswers")}</Button>
            <Button disabled={regenerating} onClick={() => void (async () => { setRegenerating(true); setError(""); try { await onRegenerateReport(session.id); } catch (cause) { setError(cause instanceof Error ? cause.message : t("edit.failed")); } finally { setRegenerating(false); } })()}>{regenerating ? <RefreshCw data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}{regenerating ? t("regeneratingFeedback") : t("regenerateFeedback")}</Button>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </article>
    </div>;
  }
  if (nodeId === "feedback") {
    if (session.feedback) {
      return <ReportScreen session={session} report={session.feedback} isWorking={false} message="" onPracticeAgain={() => {}} onReturn={() => {}} libraryMode onEdit={() => { setDraft(session); setEditing(true); setError(""); }} />;
    }
    return <ContentPage title={t("tree.feedback")} actions={<EditIconButton label={t("edit.action")} onClick={() => { setDraft(session); setEditing(true); setError(""); }} />}><DefinitionGrid items={Object.entries(session.legacyFeedback ?? {})} /></ContentPage>;
  }
  return null;
}

function EditField({ label, value, multiline, onChange }: { label: string; value: string; multiline?: boolean; onChange: (value: string) => void }) {
  return <label className="block text-sm"><span className="mb-1.5 block font-medium">{label}</span>{multiline ? <textarea className="min-h-24 w-full resize-y rounded-lg border border-line bg-background px-3 py-2 leading-6 outline-none focus:border-primary/40" value={value} onChange={(event) => onChange(event.target.value)} /> : <input className="h-10 w-full rounded-lg border border-line bg-background px-3 outline-none focus:border-primary/40" value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function EditNumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="block text-sm"><span className="mb-1.5 block font-medium">{label}</span><input type="number" min={0} max={100} className="h-10 w-full rounded-lg border border-line bg-background px-3 outline-none focus:border-primary/40" value={value} onChange={(event) => onChange(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} /></label>;
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function EditIconButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return <Button type="button" variant="ghost" size="icon" className={cn("no-print shrink-0 text-muted-foreground hover:text-foreground", className)} onClick={onClick} aria-label={label} title={label}><Pencil className="h-4 w-4" /></Button>;
}

function ContentPage({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return <article><header className="flex items-start justify-between gap-4 border-b border-line pb-6"><div className="min-w-0"><h2 className="font-serif text-3xl font-semibold text-primary">{title}</h2>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>{actions}</header><div className="mt-7 space-y-7">{children}</div></article>;
}
function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm"><h3 className="mb-3 text-base font-semibold text-primary">{title}</h3><div className="text-sm leading-7 text-foreground/85">{children}</div></section>;
}
function MetricCard({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm"><p className="font-serif text-3xl font-semibold text-primary">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>;
}
function TextPage({ title, text, preserve = false }: { title: string; text: string; preserve?: boolean }) {
  return <ContentPage title={title}><div className={cn("rounded-2xl border border-line bg-surface p-6 text-sm leading-7", preserve && "whitespace-pre-wrap")}>{text}</div></ContentPage>;
}
function ListPage({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return <ContentPage title={title}><ContentSection title={title}><BulletList items={items} empty={empty} /></ContentSection></ContentPage>;
}
function BulletList({ items, empty }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-muted-foreground">{empty ?? "—"}</p>;
  return <ul className="space-y-2">{items.map((item, index) => <li key={`${item}:${index}`} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/55" /><span>{item}</span></li>)}</ul>;
}
function DefinitionGrid({ items }: { items: Array<[string, string]> }) {
  return <div className="grid gap-3 sm:grid-cols-2">{items.map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-sm leading-6">{value || "—"}</p></div>)}</div>;
}

function ResumeDocument({ content }: { content: ResumeContent }) {
  const t = useTranslations("careerLibrary");
  const sections = ["profile", "education", "experiences", "internships", "projects", "skills", "awards", "customSections"];
  return <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-7 text-slate-900 shadow-sm sm:p-10"><h3 className="font-serif text-3xl font-semibold">{content.basics.name}</h3><p className="mt-1 text-sm text-slate-600">{content.profile.title}</p><div className="mt-7 space-y-7">{sections.map((section) => <ResumeSectionPanel key={section} title={t(`resumeSections.${section}`)} content={content} sectionId={section} />)}</div></div>;
}
function ResumeSectionPanel({ title, content, sectionId, emphasized = false }: { title: string; content: ResumeContent; sectionId: string; emphasized?: boolean }) {
  const value = resumeSectionLines(content, sectionId);
  if (!value.length) return null;
  return <section className={cn("rounded-xl border border-line p-4", emphasized && "border-primary/25 bg-primary/[0.025]")}><h3 className="mb-3 font-semibold text-primary">{title}</h3><div className="space-y-2 text-sm leading-6">{value.map((line, index) => <p key={`${line}:${index}`} className="whitespace-pre-wrap">{line}</p>)}</div></section>;
}

function resumeSectionLines(content: ResumeContent, sectionId: string): string[] {
  if (sectionId === "profile") return [content.profile.summary || content.selfReview].filter(Boolean);
  if (sectionId === "education") return content.education.map((item) => `${item.school} · ${item.degree} ${item.major}\n${item.highlights.join("；")}`.trim());
  if (sectionId === "experiences" || sectionId === "internships") return content[sectionId].map((item) => `${item.company} · ${item.role}\n${item.highlights.join("；")}`.trim());
  if (sectionId === "projects") return content.projects.map((item) => `${item.name} · ${item.role}\n${item.highlights.join("；")}`.trim());
  if (sectionId === "skills") return content.skills;
  if (sectionId === "awards") return content.awards;
  if (sectionId === "customSections") return (content.customSections ?? []).map((item) => `${item.title}\n${item.content}`);
  return [];
}

function readOptimizationBase(content: ResumeContent) {
  const value = (content as ResumeContent & { _tailoringBaseResume?: unknown })._tailoringBaseResume;
  return isResumeContent(value) ? value : null;
}
function readOptimizationMeta(content: ResumeContent): ResumeOptimizationMeta | null {
  const value = (content as ResumeContent & { _optimizationMeta?: unknown })._optimizationMeta;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<ResumeOptimizationMeta>;
  return { company: text(record.company), title: text(record.title), keywords: strings(record.keywords), summary: text(record.summary), changes: strings(record.changes), versionName: text(record.versionName) };
}
function isResumeContent(value: unknown): value is ResumeContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<ResumeContent>;
  return Boolean(record.basics && record.profile && Array.isArray(record.projects) && Array.isArray(record.skills));
}
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
function artifactTitle(artifact: CareerArtifact, t: ReturnType<typeof useTranslations>) { return artifact.kind === "general-resume" || artifact.kind === "tailored-resume" ? artifact.name : `${artifact.name} · ${t(`kindShort.${artifact.kind}`)}`; }
function artifactTreeTitle(artifact: CareerArtifact, t: ReturnType<typeof useTranslations>) { return artifact.kind === "general-resume" || artifact.kind === "tailored-resume" ? artifact.name : t(`kinds.${artifact.kind}`); }
function treeNodeLabel(artifact: CareerArtifact, id: string, index: number, t: ReturnType<typeof useTranslations>) {
  if (id.startsWith("change:")) return t(`resumeSections.${id.slice(7)}`);
  if (id.startsWith("question:")) {
    if (artifact.source.type !== "interview-session") return t("tree.questions");
    const question = artifact.source.value.questions.find((item) => item.id === id.slice(9));
    return question?.prompt || t("questionNumber", { number: index + 1 });
  }
  return t(`tree.${id}`);
}
