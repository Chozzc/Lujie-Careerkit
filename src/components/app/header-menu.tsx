"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import type { NavKey } from "@/lib/navigation";
import { buildDashboardSummary } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { ApplicationView, JobView } from "@/components/app/types";

export type HeaderMenuKey = "notifications" | "help" | "profile";

export function HeaderIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative grid h-8 w-8 place-items-center rounded-lg transition hover:bg-surface-low",
        active && "bg-surface-low shadow-[inset_0_0_0_1px_var(--border)]",
      )}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

export function HeaderMenuPanel({
  menu,
  reminders,
  dashboard,
  resumeVersionCount,
  provider,
  onNavigate,
  onClose,
}: {
  menu: HeaderMenuKey;
  reminders: Array<{ application: ApplicationView; job?: JobView }>;
  dashboard: ReturnType<typeof buildDashboardSummary>;
  resumeVersionCount: number;
  provider: string;
  onNavigate: (key: NavKey) => void;
  onClose: () => void;
}) {
  return (
    <section className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-line bg-surface p-4 text-left text-sm text-foreground shadow-[0_18px_60px_rgba(49,48,48,0.14)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold">
          {menu === "notifications" ? "跟进提醒" : menu === "help" ? "快捷入口" : "本地账户"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-surface-low hover:text-foreground"
          aria-label="关闭菜单"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {menu === "notifications" && (
        <div className="space-y-3">
          {reminders.length > 0 ? (
            reminders.map(({ application, job }) => (
              <div key={application.id} className="rounded-lg bg-surface-low p-3">
                <p className="font-medium">{job?.company ?? "未知公司"} · {job?.title ?? "未知岗位"}</p>
                <p className="mt-1 text-xs text-muted-foreground">跟进日期：{application.nextFollowUpAt}</p>
              </div>
            ))
          ) : (
            <p className="rounded-lg bg-surface-low p-3 text-muted-foreground">暂无到期跟进岗位。</p>
          )}
          <button
            type="button"
            onClick={() => onNavigate("pipeline")}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            查看投递跟进
          </button>
        </div>
      )}

      {menu === "help" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onNavigate("resume")}
            className="w-full rounded-lg bg-surface-low px-3 py-2 text-left font-medium hover:bg-surface-mid"
          >
            打开简历编辑器
          </button>
          <button
            type="button"
            onClick={() => onNavigate("match")}
            className="w-full rounded-lg bg-surface-low px-3 py-2 text-left font-medium hover:bg-surface-mid"
          >
            进入 JD匹配优化
          </button>
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="w-full rounded-lg bg-surface-low px-3 py-2 text-left font-medium hover:bg-surface-mid"
          >
            检查本地设置
          </button>
        </div>
      )}

      {menu === "profile" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-low p-3">
              <p className="text-xs text-muted-foreground">跟进岗位</p>
              <p className="mt-1 text-lg font-semibold">{dashboard.metrics.followUpsDue}</p>
            </div>
            <div className="rounded-lg bg-surface-low p-3">
              <p className="text-xs text-muted-foreground">简历版本</p>
              <p className="mt-1 text-lg font-semibold">{resumeVersionCount}</p>
            </div>
          </div>
          <div className="rounded-lg bg-surface-low p-3 text-xs leading-5 text-muted-foreground">
            <p>模式：本地单用户</p>
            <p>Provider：{provider}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            回到控制中心
          </button>
        </div>
      )}
    </section>
  );
}
