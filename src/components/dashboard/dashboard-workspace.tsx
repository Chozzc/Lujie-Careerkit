import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FilePenLine,
  Mic,
  Plus,
  Target,
  Trophy,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  DASHBOARD_STAGE_STATUSES,
  type DashboardSummary,
  type DashboardTarget,
} from "@/lib/dashboard";
import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardWorkspaceProps = {
  summary: DashboardSummary;
  onNavigate: (target: DashboardTarget) => void;
  onAddApplication: () => void;
};

const priorityRowMeta = [
  { badge: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200", hover: "hover:bg-red-50/60" },
  { badge: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200", hover: "hover:bg-amber-50/60" },
  { badge: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200", hover: "hover:bg-blue-50/60" },
] as const;

const stageMeta: Record<Exclude<ApplicationStatus, "READY">, { label: string; bar: string }> = {
  APPLIED: { label: "已投递", bar: "bg-primary" },
  ASSESSMENT: { label: "笔试 / 测评", bar: "bg-amber-500" },
  INTERVIEW: { label: "面试中", bar: "bg-blue-600" },
  OFFER: { label: "Offer", bar: "bg-emerald-600" },
  REJECTED: { label: "拒绝", bar: "bg-red-500" },
  ARCHIVED: { label: "归档", bar: "bg-zinc-400" },
};

export function DashboardWorkspace({ summary, onNavigate, onAddApplication }: DashboardWorkspaceProps) {
  const maxStageCount = Math.max(1, ...Object.values(summary.stageCounts));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricButton icon={BriefcaseBusiness} label="投递岗位" value={summary.metrics.submitted} onClick={() => onNavigate("pipeline")} />
        <MetricButton icon={ClipboardList} label="活跃流程" value={summary.metrics.active} onClick={() => onNavigate("pipeline")} />
        <MetricButton icon={CalendarClock} label="到期跟进" value={summary.metrics.followUpsDue} onClick={() => onNavigate("pipeline")} />
        <MetricButton icon={Trophy} label="Offer" value={summary.metrics.offers} onClick={() => onNavigate("pipeline")} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(240px,0.75fr)]">
        <DashboardSection title="优先处理">
          <div className="divide-y divide-line">
            {summary.actions.map((action, index) => {
              const rowMeta = priorityRowMeta[index] ?? priorityRowMeta[2];
              return (
              <button
                key={action.applicationId}
                type="button"
                onClick={() => onNavigate(action.target)}
                className={cn("group flex w-full items-center gap-3 px-2 py-3.5 text-left transition-colors", rowMeta.hover)}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold", rowMeta.badge)}>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{action.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.detail}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
              </button>
              );
            })}
            {!summary.actions.length ? (
              <p className="py-6 text-sm text-muted-foreground">为投递岗位设置阶段日期后，这里会显示最紧急的三项任务。</p>
            ) : null}
          </div>
        </DashboardSection>

        <DashboardSection title="快速开始">
          <div className="divide-y divide-line">
            <QuickAction icon={FilePenLine} label="编辑简历" onClick={() => onNavigate("resume")} />
            <QuickAction icon={Target} label="JD 匹配" onClick={() => onNavigate("match")} />
            <QuickAction icon={Plus} label="新增投递" onClick={onAddApplication} />
            <QuickAction icon={Mic} label="模拟面试" onClick={() => onNavigate("interview")} />
          </div>
        </DashboardSection>
      </div>

      <DashboardSection title="求职阶段">
          <div className="space-y-4 py-2">
            {DASHBOARD_STAGE_STATUSES.map((status) => {
              const count = summary.stageCounts[status];
              const meta = stageMeta[status];
              return (
                <div key={status} className="grid grid-cols-[88px_minmax(0,1fr)_28px] items-center gap-3">
                  <span className="text-xs text-muted-foreground">{meta.label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-mid">
                    <div
                      className={cn("h-full rounded-full", meta.bar)}
                      style={{ width: `${count ? Math.max(8, (count / maxStageCount) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-right text-sm font-semibold">{count}</span>
                </div>
              );
            })}
          </div>
      </DashboardSection>
    </div>
  );
}

function MetricButton({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-24 items-center justify-between rounded-lg border border-line bg-surface px-4 py-4 text-left hover:border-primary/35 hover:bg-surface-low"
    >
      <span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="mt-2 block text-2xl font-semibold tabular-nums">{value}</span>
      </span>
      <Icon className="size-5 text-muted-foreground" />
    </button>
  );
}

function DashboardSection({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface px-5 py-4">
      <header className="flex min-h-8 items-center justify-between gap-3 border-b border-line pb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction} className="text-xs font-medium text-primary hover:underline">
            {actionLabel}
          </button>
        ) : null}
      </header>
      <div className="pt-1">{children}</div>
    </section>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Target; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-low"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
      <span className="text-sm font-medium">{label}</span>
      <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground/70 group-hover:text-primary" />
    </button>
  );
}
