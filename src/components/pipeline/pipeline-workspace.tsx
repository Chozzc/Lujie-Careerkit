"use client";

import type { ComponentProps, ComponentType, FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  Archive,
  CalendarClock,
  ClipboardList,
  Edit3,
  FileCheck2,
  GripVertical,
  ListChecks,
  Mic,
  Plus,
  Trash2,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SpeechTextarea } from "@/components/shared/speech-textarea";
import {
  applicationPriorityOptions,
  applicationSourceOptions,
  buildApplicationTimeline,
  buildPipelineOverview,
  chunkPipelineStatuses,
  companySuggestions,
  defaultNextFollowUpDate,
  normalizeApplicationSource,
  visiblePipelineStatuses,
} from "@/lib/pipeline";
import type { ApplicationTimelineItem } from "@/lib/pipeline";
import type { ApplicationPriority, ApplicationStatus, InterviewRound } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ApplicationView, JobView, ResumeVersionView } from "@/components/app/types";

export const statusMeta: Record<
  ApplicationStatus,
  { label: string; icon: ComponentType<{ className?: string }>; className: string }
> = {
  READY: { label: "准备投递", icon: ClipboardList, className: "text-slate-600" },
  APPLIED: { label: "已投递", icon: FileCheck2, className: "text-primary" },
  ASSESSMENT: { label: "笔试 / 测评", icon: ListChecks, className: "text-amber-700" },
  INTERVIEW: { label: "面试中", icon: Mic, className: "text-blue-700" },
  OFFER: { label: "Offer", icon: Trophy, className: "text-emerald-700" },
  REJECTED: { label: "拒绝", icon: XCircle, className: "text-red-700" },
  ARCHIVED: { label: "归档", icon: Archive, className: "text-zinc-500" },
};

const pipelineStatuses = visiblePipelineStatuses;
const pipelineStageOptions = pipelineStatuses.flatMap((status) => {
  if (status !== "INTERVIEW") return [{ value: status }];
  return [
    { value: "INTERVIEW:FIRST" },
    { value: "INTERVIEW:SECOND" },
    { value: "INTERVIEW:THIRD" },
    { value: "INTERVIEW:HR" },
  ];
});

const pipelineChartColors = ["#7F9CBF", "#9CB69C", "#C3B1D0", "#D4A8A8", "#C4A484", "#AF6F3B"];

export function PipelineView({
  jobs,
  applications,
  versions,
  updatePipelineEntry,
  deletePipelineEntry,
  updateStatus,
}: {
  jobs: JobView[];
  applications: ApplicationView[];
  versions: ResumeVersionView[];
  updatePipelineEntry: (event: FormEvent<HTMLFormElement>) => void;
  deletePipelineEntry: (jobId: string) => void;
  updateStatus: (applicationId: string, status: ApplicationStatus) => void;
}) {
  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const overview = useMemo(
    () =>
      buildPipelineOverview({
        jobs,
        applications,
      }),
    [applications, jobs],
  );
  const applicationsByStatus = useMemo(() => {
    const grouped = new Map<ApplicationStatus, ApplicationView[]>(
      pipelineStatuses.map((status) => [status, [] as ApplicationView[]]),
    );
    for (const application of applications) {
      if (isPipelineStatus(application.status)) grouped.get(application.status)?.push(application);
    }
    return grouped;
  }, [applications]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const editingApplication = applications.find((application) => application.id === editingApplicationId);
  const editingJob = editingApplication ? jobById.get(editingApplication.jobId) : undefined;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <div className="space-y-5">
      <PipelineOverview overview={overview} />

      <DndContext
        id="pipeline-board-dnd"
        sensors={sensors}
        modifiers={[restrictToWindowEdges]}
        onDragStart={(event) => setDraggedId(String(event.active.id))}
        onDragEnd={(event: DragEndEvent) => {
          const applicationId = String(event.active.id);
          const nextStatus = event.over?.id;
          if (typeof nextStatus === "string" && isPipelineStatus(nextStatus)) {
            const application = applications.find((item) => item.id === applicationId);
            if (application && application.status !== nextStatus) updateStatus(applicationId, nextStatus);
          }
          setDraggedId(null);
        }}
        onDragCancel={() => setDraggedId(null)}
      >
        <div data-tour="pipeline-board" className="space-y-4">
          {chunkPipelineStatuses().map((row, rowIndex) => (
            <div key={rowIndex} className="grid gap-4 lg:grid-cols-3">
              {row.map((status) => (
                <PipelineStatusColumn
                  key={status}
                  status={status}
                  applications={applicationsByStatus.get(status) ?? []}
                  versions={versions}
                  jobById={jobById}
                  draggingApplicationId={draggedId}
                  onEditApplication={setEditingApplicationId}
                />
              ))}
            </div>
          ))}
        </div>
      </DndContext>
      <PipelineEditDialog
        application={editingApplication}
        job={editingJob}
        open={Boolean(editingApplication && editingJob)}
        onOpenChange={(open) => {
          if (!open) setEditingApplicationId(null);
        }}
        onSubmit={(event) => {
          updatePipelineEntry(event);
          setEditingApplicationId(null);
        }}
        onDelete={() => {
          if (!editingJob) return;
          deletePipelineEntry(editingJob.id);
          setEditingApplicationId(null);
        }}
      />
    </div>
  );
}

function PipelineStatusColumn({
  status,
  applications,
  versions,
  jobById,
  draggingApplicationId,
  onEditApplication,
}: {
  status: ApplicationStatus;
  applications: ApplicationView[];
  versions: ResumeVersionView[];
  jobById: Map<string, JobView>;
  draggingApplicationId: string | null;
  onEditApplication: (applicationId: string) => void;
}) {
  const t = useTranslations("pipeline");
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const Icon = statusMeta[status].icon;
  const statusLabel = pipelineStatusLabel(status, t);

  return (
    <section
      ref={setNodeRef}
      data-pipeline-status={status}
      className={cn(
        "min-h-56 rounded-xl border bg-surface p-4 shadow-[0_12px_32px_rgba(49,48,48,0.035)] transition-[background-color,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        isOver ? "border-primary/45 bg-primary-soft/25 shadow-[0_14px_36px_rgba(49,48,48,0.055),inset_0_0_0_1px_rgba(49,48,48,0.03)]" : "border-line",
      )}
    >
      <div className="relative mb-4 flex items-center justify-center px-9 text-center">
        <div className="flex min-w-0 items-center justify-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", statusMeta[status].className)} />
          <h2 className="truncate text-lg font-semibold tracking-normal">{statusLabel}</h2>
        </div>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md bg-surface-mid px-2 py-1 text-xs">
          {applications.length}
        </span>
      </div>
      <div className="space-y-3">
        {applications.length === 0 && (
          <p
            className={cn(
              "rounded-lg border border-dashed px-3 py-5 text-center text-xs transition-colors",
              isOver ? "border-primary/40 bg-white/70 text-primary" : "border-line text-muted-foreground",
            )}
          >
            {isOver ? t("board.dropInto", { status: statusLabel }) : t("board.empty")}
          </p>
        )}
        {applications.map((application) => (
          <PipelineApplicationCard
            key={application.id}
            application={application}
            job={jobById.get(application.jobId)}
            version={versions.find((item) => item.id === application.resumeVersionId)}
            timeline={buildApplicationTimeline({
              status: application.status,
              appliedAt: application.appliedAt,
              updatedAt: application.updatedAt,
            })}
            isAnyDragging={Boolean(draggingApplicationId)}
            onEdit={() => onEditApplication(application.id)}
          />
        ))}
      </div>
    </section>
  );
}

function PipelineOverview({ overview }: { overview: ReturnType<typeof buildPipelineOverview> }) {
  const t = useTranslations("pipeline");
  const sourceCountMap = new Map(overview.sourceCounts.map((item) => [item.source, item.count]));
  const sourceData = applicationSourceOptions.map((source) => ({
    source,
    label: sourceLabel(source, t),
    count: sourceCountMap.get(source) ?? 0,
  }));
  const sourceChartData = sourceData.filter((item) => item.count > 0);
  const sourceTotal = sourceData.reduce((sum, item) => sum + item.count, 0);

  return (
    <Panel title={t("overview.title")}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PipelineMetric icon={ClipboardList} label={t("overview.metrics.total")} value={overview.total} />
        <PipelineMetric icon={CalendarClock} label={t("overview.metrics.active")} value={overview.active} />
        <PipelineMetric icon={Mic} label={t("overview.metrics.interviewRate")} value={`${overview.interviewRate}%`} />
        <PipelineMetric icon={Trophy} label={t("overview.metrics.offerRate")} value={`${overview.offerRate}%`} />
      </div>
      <div className="mt-4 grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.65fr)]">
        <div className="min-w-0">
          <div className="relative min-h-[24rem] min-w-0">
            <p className="absolute left-1/2 top-3 z-10 min-w-20 -translate-x-1/2 rounded-md bg-background/85 px-2 py-1 text-center text-[0.6875rem] font-medium text-muted-foreground shadow-[0_4px_14px_rgba(49,48,48,0.04)]">
              {t("overview.statusChart")}
            </p>
            <ResponsiveContainer width="100%" height={392} minWidth={160}>
              <BarChart data={overview.statusCounts} margin={{ top: 8, right: 18, bottom: 4, left: -12 }} barCategoryGap="22%">
                <defs>
                  {overview.statusCounts.map((entry, index) => {
                    const color = pipelineChartColors[index % pipelineChartColors.length];
                    return (
                      <linearGradient key={entry.status} id={`pipeline-status-${entry.status}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.64} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5DDD0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: "#4A3F35" }} />
                <YAxis
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.max(4, dataMax)]}
                  tickCount={5}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 13, fill: "#4A3F35" }}
                />
                <RechartsTooltip
                  cursor={{ fill: "rgba(156, 182, 156, 0.12)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E5DDD0", fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} name={t("overview.jobCount")}>
                  {overview.statusCounts.map((entry) => (
                    <Cell key={entry.status} fill={`url(#pipeline-status-${entry.status})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-x-5 gap-y-3 border-t border-line pt-4">
            {overview.statusCounts.map((item, index) => (
              <div key={item.status} className="min-w-0 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: pipelineChartColors[index % pipelineChartColors.length] }}
                  />
                  <span className="truncate font-medium text-foreground">{pipelineStatusLabel(item.status, t)}</span>
                </span>
                <span className="mt-1 block text-muted-foreground">{t("overview.count", { count: item.count })}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          {sourceChartData.length > 0 ? (
            <div className="relative min-h-[20rem] min-w-0">
              <p className="absolute left-1/2 top-3 z-10 min-w-20 -translate-x-1/2 rounded-md bg-background/85 px-2 py-1 text-center text-[0.6875rem] font-medium text-muted-foreground shadow-[0_4px_14px_rgba(49,48,48,0.04)]">
                {t("overview.sourceChart")}
              </p>
              <ResponsiveContainer width="100%" height={328} minWidth={160}>
                <PieChart>
                  <defs>
                    {sourceChartData.map((entry) => {
                      const sourceIndex = applicationSourceOptions.indexOf(entry.source);
                      const color = pipelineChartColors[sourceIndex % pipelineChartColors.length];
                      return (
                        <linearGradient key={entry.source} id={`pipeline-source-${sourceIndex}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.88} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.64} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <Pie
                    data={sourceChartData}
                    dataKey="count"
                    nameKey="label"
                    cy="57%"
                    innerRadius={66}
                    outerRadius={104}
                    paddingAngle={2}
                  >
                    {sourceChartData.map((entry) => {
                      const sourceIndex = applicationSourceOptions.indexOf(entry.source);
                      return <Cell key={entry.source} fill={`url(#pipeline-source-${sourceIndex})`} />;
                    })}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #E5DDD0", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="relative grid min-h-[22rem] place-items-center rounded-lg bg-surface-low text-sm text-muted-foreground">
              <p className="absolute left-1/2 top-3 min-w-20 -translate-x-1/2 rounded-md bg-background/85 px-2 py-1 text-center text-[0.6875rem] font-medium text-muted-foreground shadow-[0_4px_14px_rgba(49,48,48,0.04)]">
                {t("overview.sourceChart")}
              </p>
              {t("overview.noSourceData")}
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-x-5 gap-y-3 border-t border-line pt-4">
            {sourceData.map((entry, index) => (
              <div key={entry.source} className="min-w-0 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: pipelineChartColors[index % pipelineChartColors.length] }}
                  />
                  <span className="truncate font-medium text-foreground">{entry.label}</span>
                </span>
                <span className="mt-1 block text-muted-foreground">
                  {t("overview.sourceCount", { count: entry.count, percent: sourceTotal > 0 ? Math.round((entry.count / sourceTotal) * 100) : 0 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function AddApplicationDialog({
  open,
  addJob,
  onOpenChange,
}: {
  open: boolean;
  addJob: (event: FormEvent<HTMLFormElement>) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("pipeline");
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        aria-labelledby="pipeline-add-title"
        aria-modal="true"
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-[0_24px_80px_rgba(49,48,48,0.18)]"
        role="dialog"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="pipeline-add-title" className="font-serif text-xl font-semibold">
              {t("add.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("add.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-muted-foreground hover:bg-surface-low hover:text-foreground"
            aria-label={t("add.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <AddApplicationForm addJob={addJob} onSubmitted={() => onOpenChange(false)} />
      </section>
    </div>
  );
}

function AddApplicationForm({
  addJob,
  onSubmitted,
}: {
  addJob: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitted?: () => void;
}) {
  const t = useTranslations("pipeline");
  const [applicationStage, setApplicationStage] = useState("APPLIED");
  const [stageDate, setStageDate] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [jd, setJd] = useState("");
  const applicationStatus = parsePipelineStage(applicationStage).status;

  function handleStageDateChange(value: string) {
    setStageDate(value);
    if (applicationStatus === "APPLIED" && !nextFollowUpAt) {
      setNextFollowUpAt(defaultNextFollowUpDate(value));
    }
  }

  return (
    <form
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const hasRequiredFields =
          String(formData.get("company") ?? "").trim() &&
          String(formData.get("title") ?? "").trim();
        addJob(event);
        if (hasRequiredFields) {
          setApplicationStage("APPLIED");
          setStageDate("");
          setNextFollowUpAt("");
          setJd("");
          onSubmitted?.();
        }
      }}
      className="grid gap-3"
    >
      <datalist id="pipeline-company-suggestions">
        {companySuggestions.map((company) => (
          <option key={company} value={company} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("fields.company")} required>
          <Input name="company" placeholder={t("placeholders.company")} list="pipeline-company-suggestions" required />
        </FormField>
        <FormField label={t("fields.title")} required>
          <Input name="title" placeholder={t("placeholders.title")} required />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t("fields.source")} required>
          <SourceSelect name="source" defaultValue="企业官网" required />
        </FormField>
        <FormField label={t("fields.status")} required>
          <PipelineStageSelect
            name="applicationStage"
            value={applicationStage}
            onValueChange={setApplicationStage}
            required
          />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label={statusDateLabel(applicationStatus, t)} optional>
          <Input
            name="stageDate"
            type="date"
            value={stageDate}
            onChange={(event) => handleStageDateChange(event.target.value)}
          />
        </FormField>
        <FormField label={t("fields.nextFollowUp")} optional>
          <Input
            name="nextFollowUpAt"
            type="date"
            value={nextFollowUpAt}
            onChange={(event) => setNextFollowUpAt(event.target.value)}
          />
        </FormField>
        <FormField label={t("fields.priority")} required>
          <ApplicationPrioritySelect name="priority" defaultValue="NORMAL" required />
        </FormField>
      </div>
      <FormField label={t("fields.link")} optional>
        <Input name="link" placeholder={t("placeholders.link")} />
      </FormField>
      <FormField label={t("fields.notes")} optional>
        <textarea
          name="notes"
          placeholder={t("placeholders.notes")}
          className="min-h-24 w-full resize-none rounded-lg border border-line bg-surface-low px-3 py-2 text-sm leading-6 outline-none focus:border-primary"
        />
      </FormField>
      <FormField label={t("fields.jd")} optional>
        <SpeechTextarea
          name="jd"
          value={jd}
          onValueChange={setJd}
          maxLength={8000}
          placeholder={t("placeholders.jd")}
          className="min-h-28 resize-y bg-surface-low text-sm leading-6"
        />
      </FormField>
      <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white">
        <Plus className="h-4 w-4" />
        {t("add.submit")}
      </button>
    </form>
  );
}

function PipelineMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg bg-surface-low p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PipelineApplicationCard({
  application,
  job,
  version,
  timeline,
  isAnyDragging,
  onEdit,
}: {
  application: ApplicationView;
  job?: JobView;
  version?: ResumeVersionView;
  timeline: ApplicationTimelineItem[];
  isAnyDragging?: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("pipeline");
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: application.id });
  const dragTransform = transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;

  return (
    <article
      ref={setNodeRef}
      data-application-card={application.id}
      {...attributes}
      {...listeners}
      style={{
        transform: dragTransform,
        transition: isDragging
          ? "box-shadow 120ms ease, opacity 120ms ease, border-color 120ms ease"
          : "box-shadow 160ms ease, opacity 140ms ease, border-color 140ms ease",
        willChange: isDragging ? "transform" : undefined,
        zIndex: isDragging ? 30 : undefined,
      }}
      className={cn(
        "relative touch-none cursor-grab select-none rounded-lg border border-line bg-background p-3 shadow-[0_8px_20px_rgba(49,48,48,0.03)] outline-none transition-[border-color,box-shadow,opacity] duration-150 ease-out hover:border-brand/40 hover:shadow-[0_10px_24px_rgba(49,48,48,0.06)] active:cursor-grabbing motion-reduce:transition-none",
        isDragging && "border-primary/35 opacity-95 shadow-[0_20px_48px_rgba(49,48,48,0.16)]",
        isAnyDragging && !isDragging && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{job?.company ?? t("card.unknownCompany")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{job?.title ?? t("card.unknownTitle")}</p>
        </div>
        <button
          type="button"
          draggable={false}
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[0.6875rem] font-medium text-primary hover:bg-primary-soft"
          aria-label={t("card.editAria", { company: job?.company ?? t("card.application") })}
          title={t("card.editTitle")}
        >
          <Edit3 className="h-3 w-3" />
          {t("card.edit")}
        </button>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {application.notes || t("card.noNotes")}
      </p>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span className="rounded-md bg-surface-low px-2 py-1">{t("card.source", { source: sourceLabel(displaySource(job?.source), t) })}</span>
        <span className="rounded-md bg-surface-low px-2 py-1">
          {t("card.stageDate", { label: statusShortDateLabel(application.status, t), date: application.stageDate ?? application.appliedAt ?? t("card.notRecorded") })}
        </span>
        <span className="rounded-md bg-surface-low px-2 py-1">{t("card.followUp", { date: application.nextFollowUpAt ?? t("card.notSet") })}</span>
        <span className="rounded-md bg-surface-low px-2 py-1">{t("card.priority", { priority: priorityLabel(application.priority, t) })}</span>
        <span className="rounded-md bg-surface-low px-2 py-1">{t("card.resume", { resume: version?.name ?? t("card.unbound") })}</span>
      </div>
      <div className="mt-3 rounded-lg border border-line bg-surface-low px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] font-semibold text-foreground">{t("card.progress")}</span>
          <span className="rounded-full bg-background px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
            {applicationStageLabel(application, t)}
          </span>
        </div>
        <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))` }}>
          {timeline.map((item, index) => {
            const Icon = statusMeta[item.status].icon;
            const nextItem = timeline[index + 1];
            return (
              <li key={item.key} className="relative min-w-0">
                {nextItem && (
                  <span
                    className={cn(
                      "absolute left-1/2 right-[-50%] top-3 h-px",
                      timelineConnectorClass(item, nextItem),
                    )}
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex min-w-0 flex-col items-center text-center">
                  <span className={cn("grid h-6 w-6 place-items-center rounded-full border", timelineMarkerClass(item))}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className={cn("mt-1 w-full truncate text-[0.625rem] font-semibold", timelineTextClass(item))}>
                    {pipelineStatusLabel(item.status, t)}
                  </span>
                  <span className="mt-0.5 w-full truncate text-[0.5625rem] text-muted-foreground">
                    {formatTimelineDate(item, t)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1 rounded-md border border-dashed border-line bg-surface-low px-2 py-2 text-xs font-medium text-muted-foreground">
        <GripVertical className="h-3.5 w-3.5" />
        {t("card.dragHint")}
      </div>
    </article>
  );
}

function PipelineEditDialog({
  application,
  job,
  open,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  application?: ApplicationView;
  job?: JobView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  if (!open || !application || !job) return null;

  return (
    <PipelineEditDialogContent
      key={job.id}
      application={application}
      job={job}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      onDelete={onDelete}
    />
  );
}

function PipelineEditDialogContent({
  application,
  job,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  application: ApplicationView;
  job: JobView;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("pipeline");
  const [jd, setJd] = useState(job.jd ?? "");
  const [applicationStage, setApplicationStage] = useState(
    pipelineStageValue(application.status, application.interviewRound),
  );
  const applicationStatus = parsePipelineStage(applicationStage).status;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        aria-labelledby="pipeline-edit-title"
        aria-modal="true"
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-[0_24px_80px_rgba(49,48,48,0.18)]"
        role="dialog"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="pipeline-edit-title" className="font-serif text-xl font-semibold">
              {t("edit.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("edit.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-muted-foreground hover:bg-surface-low hover:text-foreground"
            aria-label={t("edit.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="jobId" value={job.id} />
          <input type="hidden" name="applicationId" value={application.id} />
          <datalist id="pipeline-edit-company-suggestions">
            {companySuggestions.map((company) => (
              <option key={company} value={company} />
            ))}
          </datalist>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("fields.company")} required>
              <Input
                name="company"
                defaultValue={job.company}
                list="pipeline-edit-company-suggestions"
                required
              />
            </FormField>
            <FormField label={t("fields.title")} required>
              <Input name="title" defaultValue={job.title} required />
            </FormField>
            <FormField label={t("fields.source")} required>
              <SourceSelect name="source" defaultValue={displaySource(job.source)} required />
            </FormField>
            <FormField label={t("fields.stage")} required>
              <PipelineStageSelect
                name="stage"
                value={applicationStage}
                onValueChange={setApplicationStage}
                required
              />
            </FormField>
            <FormField label={statusDateLabel(applicationStatus, t)} optional>
              <Input name="stageDate" type="date" defaultValue={application.stageDate ?? application.appliedAt ?? ""} />
            </FormField>
            <FormField label={t("fields.nextFollowUp")} optional>
              <Input name="nextFollowUpAt" type="date" defaultValue={application.nextFollowUpAt ?? ""} />
            </FormField>
            <FormField label={t("fields.priority")} required>
              <ApplicationPrioritySelect name="priority" defaultValue={application.priority} required />
            </FormField>
          </div>

          <FormField label={t("fields.link")} optional>
            <Input name="link" defaultValue={job.link ?? ""} placeholder={t("placeholders.link")} />
          </FormField>
          <FormField label={t("fields.notes")} optional>
            <textarea
              name="notes"
              defaultValue={application.notes ?? ""}
              placeholder={t("placeholders.notes")}
              className="min-h-24 w-full resize-none rounded-lg border border-line bg-surface-low px-3 py-2 text-sm leading-6 outline-none focus:border-primary"
            />
          </FormField>
          <FormField label={t("fields.jd")} optional>
            <SpeechTextarea
              name="jd"
              value={jd}
              onValueChange={setJd}
              maxLength={8000}
              placeholder={t("placeholders.jdShort")}
              className="min-h-28 resize-y bg-surface-low text-sm leading-6"
            />
          </FormField>

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("edit.deleteConfirm", { company: job.company, title: job.title }))) {
                  onDelete();
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              {t("edit.delete")}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-primary hover:bg-surface-low"
              >
                {t("edit.cancel")}
              </button>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
                {t("edit.save")}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function Panel({
  title,
  action,
  onAction,
  children,
  className,
  contentClassName,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-surface p-4 shadow-[0_12px_40px_rgba(49,48,48,0.04)]",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        {action && (
          <button onClick={onAction} className="text-xs font-medium text-primary">
            {action}
          </button>
        )}
      </div>
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </section>
  );
}

function FormField({
  label,
  required,
  optional,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("pipeline");
  return (
    <label className={cn("block space-y-1.5 text-xs font-medium text-muted-foreground", className)}>
      <span>
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
        {optional && <span className="ml-1 font-normal text-muted-foreground">{t("fields.optional")}</span>}
      </span>
      {children}
    </label>
  );
}

function SourceSelect({
  name,
  defaultValue,
  required,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const t = useTranslations("pipeline");
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      required={required}
      className="w-full rounded-lg border border-line bg-surface-low px-3 py-3 text-sm text-foreground outline-none focus:border-primary"
    >
      {applicationSourceOptions.map((source) => (
        <option key={source} value={source}>
          {sourceLabel(source, t)}
        </option>
      ))}
    </select>
  );
}

function PipelineStageSelect({
  name,
  defaultValue,
  value,
  onValueChange,
  required,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
}) {
  const t = useTranslations("pipeline");
  return (
    <select
      name={name}
      defaultValue={value === undefined ? defaultValue : undefined}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      required={required}
      className="w-full rounded-lg border border-line bg-surface-low px-3 py-3 text-sm text-foreground outline-none focus:border-primary"
    >
      {pipelineStageOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {pipelineStageOptionLabel(option.value, t)}
        </option>
      ))}
    </select>
  );
}

function ApplicationPrioritySelect({
  name,
  defaultValue,
  required,
}: {
  name: string;
  defaultValue: ApplicationPriority;
  required?: boolean;
}) {
  const t = useTranslations("pipeline");
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      required={required}
      className="w-full rounded-lg border border-line bg-surface-low px-3 py-3 text-sm text-foreground outline-none focus:border-primary"
    >
      {applicationPriorityOptions.map((priority) => (
        <option key={priority} value={priority}>
          {priorityLabel(priority, t)}
        </option>
      ))}
    </select>
  );
}

function isPipelineStatus(value: string): value is (typeof visiblePipelineStatuses)[number] {
  return visiblePipelineStatuses.includes(value as (typeof visiblePipelineStatuses)[number]);
}

export function normalizeInterviewRound(value: FormDataEntryValue | null): InterviewRound {
  return value === "FIRST" || value === "SECOND" || value === "THIRD" || value === "HR" ? value : "";
}

export function parsePipelineStage(value: FormDataEntryValue | null): {
  status: ApplicationStatus;
  interviewRound: InterviewRound;
} {
  const stage = String(value ?? "APPLIED");
  if (stage === "INTERVIEW:FIRST") return { status: "INTERVIEW", interviewRound: "FIRST" };
  if (stage === "INTERVIEW:SECOND") return { status: "INTERVIEW", interviewRound: "SECOND" };
  if (stage === "INTERVIEW:THIRD") return { status: "INTERVIEW", interviewRound: "THIRD" };
  if (stage === "INTERVIEW:HR") return { status: "INTERVIEW", interviewRound: "HR" };
  if (isPipelineStatus(stage)) return { status: stage, interviewRound: "" };
  return { status: "APPLIED", interviewRound: "" };
}

function pipelineStageValue(status: ApplicationStatus, interviewRound?: InterviewRound | null) {
  if (status !== "INTERVIEW") return status;
  return `INTERVIEW:${interviewRound || "FIRST"}`;
}

type PipelineT = (key: string, values?: Record<string, string | number>) => string;

function pipelineStatusLabel(status: ApplicationStatus, t: PipelineT) {
  return t(`status.${status}`);
}

function interviewRoundLabel(round: Exclude<InterviewRound, "">, t: PipelineT) {
  return t(`round.${round}`);
}

function pipelineStageOptionLabel(value: string, t: PipelineT) {
  if (value === "INTERVIEW:FIRST") return interviewRoundLabel("FIRST", t);
  if (value === "INTERVIEW:SECOND") return interviewRoundLabel("SECOND", t);
  if (value === "INTERVIEW:THIRD") return interviewRoundLabel("THIRD", t);
  if (value === "INTERVIEW:HR") return interviewRoundLabel("HR", t);
  return isPipelineStatus(value) ? pipelineStatusLabel(value, t) : value;
}

function priorityLabel(priority: ApplicationPriority, t: PipelineT) {
  return t(`priority.${priority}`);
}

function statusDateLabel(status: ApplicationStatus, t: PipelineT) {
  return t(`statusDate.${status}`);
}

function statusShortDateLabel(status: ApplicationStatus, t: PipelineT) {
  return t(`statusShortDate.${status}`);
}

function sourceLabel(source: string, t: PipelineT) {
  return t(`source.${sourceKey(source)}`);
}

function sourceKey(source: string) {
  return (
    {
      实习僧: "shixiseng",
      BOSS直聘: "boss",
      猎聘: "liepin",
      智联招聘: "zhaopin",
      前程无忧: "51job",
      企业官网: "official",
      内推: "referral",
      邮件: "email",
      其他: "other",
    }[source] ?? "other"
  );
}

function applicationStageLabel(application: Pick<ApplicationView, "status" | "interviewRound">, t: PipelineT) {
  if (application.status !== "INTERVIEW") return pipelineStatusLabel(application.status, t);
  const round = application.interviewRound ? interviewRoundLabel(application.interviewRound, t) : "";
  return round ? t("card.interviewRound", { round }) : pipelineStatusLabel("INTERVIEW", t);
}

function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="text"
      className={cn("w-full rounded-lg border border-line bg-surface-low px-3 py-3 text-sm outline-none focus:border-primary", className)}
      {...props}
    />
  );
}

function displaySource(source?: string) {
  return normalizeApplicationSource(source);
}

function formatTimelineDate(item: ApplicationTimelineItem, t: PipelineT) {
  if (item.date) return item.date.slice(0, 10);
  if (item.tone === "future") return t("timeline.future");
  if (item.tone === "current") return t("timeline.current");
  if (item.tone === "win") return t("timeline.win");
  if (item.tone === "terminal") return t("timeline.terminal");
  return t("timeline.done");
}

function timelineMarkerClass(item: ApplicationTimelineItem) {
  if (item.tone === "win") return "border-[#e3a600] bg-[#f6c343] text-[#3a2a00] shadow-[0_0_0_3px_rgba(246,195,67,0.24)]";
  if (item.tone === "current") return "border-amber-300 bg-amber-50 text-amber-700 shadow-[0_0_0_3px_rgba(217,119,6,0.10)]";
  if (item.tone === "terminal") {
    return item.status === "REJECTED"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-zinc-300 bg-zinc-100 text-zinc-600";
  }
  if (item.tone === "future") return "border-line bg-background text-muted-foreground/55";
  return "border-emerald-600 bg-emerald-600 text-white";
}

function timelineTextClass(item: ApplicationTimelineItem) {
  if (item.tone === "future") return "text-muted-foreground";
  if (item.tone === "win") return "text-[#b77900]";
  if (item.tone === "terminal") return item.status === "REJECTED" ? "text-red-700" : "text-zinc-600";
  if (item.tone === "current") return "text-amber-700";
  return "text-emerald-700";
}

function timelineConnectorClass(current: ApplicationTimelineItem, next: ApplicationTimelineItem) {
  if (next.tone === "win" && current.tone !== "future") return "bg-[#f6c343]/80";
  if (current.tone !== "future" && next.tone !== "future" && next.tone !== "terminal") return "bg-emerald-500/45";
  return "bg-line";
}
