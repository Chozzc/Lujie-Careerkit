"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { JobView, ResumeVersionView } from "@/components/app/types";
import { resumeVersionDisplayName } from "@/components/match/match-view";
import type { InterviewSessionRecord } from "@/lib/interview-service";
import type { NavKey } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function AppPageHeader({
  active,
  pageTitle,
  pageSubtitle,
  isPending,
  toast,
  optimizedVersions,
  optimizedMenuOpen,
  setOptimizedMenuOpen,
  interviewSessions,
  interviewMenuOpen,
  setInterviewMenuOpen,
  jobById,
  onAddApplication,
  onOpenOptimizedVersion,
  onDeleteResumeVersion,
  onDeleteOptimizedResumeVersions,
  onOpenInterviewSession,
  onDeleteInterviewSession,
  onClearInterviewSessions,
}: {
  active: NavKey;
  pageTitle?: string;
  pageSubtitle: string;
  isPending: boolean;
  toast: string;
  optimizedVersions: ResumeVersionView[];
  optimizedMenuOpen: boolean;
  setOptimizedMenuOpen: Dispatch<SetStateAction<boolean>>;
  interviewSessions: InterviewSessionRecord[];
  interviewMenuOpen: boolean;
  setInterviewMenuOpen: Dispatch<SetStateAction<boolean>>;
  jobById: Map<string, JobView>;
  onAddApplication: () => void;
  onOpenOptimizedVersion: (versionId: string) => void;
  onDeleteResumeVersion: (versionId: string) => void;
  onDeleteOptimizedResumeVersions: () => void;
  onOpenInterviewSession: (sessionId: string) => void;
  onDeleteInterviewSession: (sessionId: string) => void | Promise<void>;
  onClearInterviewSessions: () => void | Promise<void>;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end",
        active === "resume" && "hidden",
        active === "pipeline" && "relative items-center text-center lg:block",
      )}
    >
      <div className={cn(active === "pipeline" && "mx-auto text-center")}>
        <h1 className="font-serif text-2xl font-semibold tracking-normal lg:text-3xl">{pageTitle}</h1>
        <p
          className={cn(
            "mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground",
            active === "pipeline" && "mx-auto max-w-2xl",
          )}
        >
          {pageSubtitle}
        </p>
      </div>
      <div
        className={cn(
          "flex items-center gap-2",
          active === "pipeline" && "justify-center lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2",
        )}
      >
        {active === "pipeline" ? (
          <button
            type="button"
            onClick={onAddApplication}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_rgba(49,48,48,0.12)] hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新增投递岗位
          </button>
        ) : isPending || toast !== "准备就绪" ? (
          <div className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted-foreground">
            {isPending ? "正在处理..." : toast}
          </div>
        ) : null}
        {active === "match" && optimizedVersions.length > 0 && (
          <OptimizedVersionsMenu
            versions={optimizedVersions}
            open={optimizedMenuOpen}
            setOpen={setOptimizedMenuOpen}
            jobById={jobById}
            onOpen={onOpenOptimizedVersion}
            onDelete={onDeleteResumeVersion}
            onDeleteAll={onDeleteOptimizedResumeVersions}
          />
        )}
        {active === "interview" && interviewSessions.length > 0 && (
          <InterviewSessionsMenu
            sessions={interviewSessions}
            open={interviewMenuOpen}
            setOpen={setInterviewMenuOpen}
            onOpen={onOpenInterviewSession}
            onDelete={onDeleteInterviewSession}
            onDeleteAll={onClearInterviewSessions}
          />
        )}
      </div>
    </div>
  );
}

function OptimizedVersionsMenu({
  versions,
  open,
  setOpen,
  jobById,
  onOpen,
  onDelete,
  onDeleteAll,
}: {
  versions: ResumeVersionView[];
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  jobById: Map<string, JobView>;
  onOpen: (versionId: string) => void;
  onDelete: (versionId: string) => void;
  onDeleteAll: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-low"
      >
        已优化版本 · {versions.length}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 rounded-lg border border-line bg-surface p-2 shadow-[0_18px_60px_rgba(15,23,42,0.14)]">
          <div className="px-2 pb-2 pt-1 text-xs text-muted-foreground">选择一个历史优化结果继续查看</div>
          <div className="max-h-80 overflow-y-auto">
            {versions.map((version) => {
              const job = jobById.get(version.jobId ?? "");
              const versionLabel = resumeVersionDisplayName(version, job);
              return (
                <div key={version.id} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-surface-low">
                  <button type="button" onClick={() => onOpen(version.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-foreground">{versionLabel}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {new Date(version.updatedAt).toLocaleDateString("zh-CN")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(version.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-white text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    aria-label={`删除${versionLabel}优化版本`}
                    title="删除优化版本"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onDeleteAll}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空全部优化版本
          </button>
        </div>
      )}
    </div>
  );
}

function InterviewSessionsMenu({
  sessions,
  open,
  setOpen,
  onOpen,
  onDelete,
  onDeleteAll,
}: {
  sessions: InterviewSessionRecord[];
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onOpen: (sessionId: string) => void;
  onDelete: (sessionId: string) => void | Promise<void>;
  onDeleteAll: () => void | Promise<void>;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-low"
      >
        已模拟面试 · {sessions.length}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 rounded-lg border border-line bg-surface p-2 shadow-[0_18px_60px_rgba(15,23,42,0.14)]">
          <div className="px-2 pb-2 pt-1 text-xs text-muted-foreground">继续未完成练习，或查看已保存的复盘报告</div>
          <div className="max-h-80 overflow-y-auto">
            {sessions.map((session) => (
              <div key={session.id} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-surface-low">
                <button type="button" onClick={() => onOpen(session.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {session.context.company} · {session.context.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {new Date(session.updatedAt).toLocaleDateString("zh-CN")} ·{" "}
                    {session.status === "COMPLETED" ? "已复盘" : "进行中"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(session.id)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-white text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  aria-label={`删除${session.context.company}${session.context.title}模拟面试`}
                  title="删除模拟面试"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void onDeleteAll()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空全部模拟面试
          </button>
        </div>
      )}
    </div>
  );
}
