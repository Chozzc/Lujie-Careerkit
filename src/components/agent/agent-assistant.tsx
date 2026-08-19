"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  History,
  LoaderCircle,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";

import type { CareerAgentUIMessage } from "@/lib/agent/career-agent";
import type { ApplicationView, JobView } from "@/components/app/types";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_AGENT_PET_POSITION,
  AGENT_PET_HEIGHT,
  AGENT_PET_PANEL_GAP,
  clampAgentPetGroupPosition,
  clampAgentPetPosition,
  parseAgentPetPosition,
} from "@/lib/agent/pet-position";
import { cn } from "@/lib/utils";

const AGENT_PET_POSITION_KEY = "lujie-careerkit:agent-pet-position:v1";
const AGENT_PET_DRAG_THRESHOLD = 5;

type AgentThreadSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type AgentThread = AgentThreadSummary & { messages: CareerAgentUIMessage[] };

type ApplicationChangeResult = {
  operation: "created" | "updated";
  job: JobView;
  application: ApplicationView;
};

export function AgentAssistant({
  aiReady,
  onOpenSettings,
  onApplicationChanged,
}: {
  aiReady: boolean;
  onOpenSettings: () => void;
  onApplicationChanged: (result: ApplicationChangeResult) => void;
}) {
  const t = useTranslations("agent");
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<AgentThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<AgentThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [petPosition, setPetPosition] = useState(DEFAULT_AGENT_PET_POSITION);
  const [petPositionReady, setPetPositionReady] = useState(false);
  const [petDragging, setPetDragging] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const petButtonRef = useRef<HTMLButtonElement>(null);
  const petVisualRef = useRef<HTMLSpanElement>(null);
  const petDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
  } | null>(null);
  const petWasDragged = useRef(false);

  useEffect(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const restoreFrame = requestAnimationFrame(() => {
      try {
        setPetPosition(parseAgentPetPosition(window.localStorage.getItem(AGENT_PET_POSITION_KEY), viewport));
      } catch {
        setPetPosition(clampAgentPetPosition(DEFAULT_AGENT_PET_POSITION, viewport));
      }
      setPetPositionReady(true);
    });

    function keepPetInViewport() {
      setPetPosition((current) => {
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        const panel = panelRef.current?.getBoundingClientRect();
        return panel
          ? clampAgentPetGroupPosition(current, viewport, panel)
          : clampAgentPetPosition(current, viewport);
      });
    }

    window.addEventListener("resize", keepPetInViewport);
    return () => {
      cancelAnimationFrame(restoreFrame);
      window.removeEventListener("resize", keepPetInViewport);
    };
  }, []);

  useEffect(() => {
    if (!petPositionReady) return;
    try {
      window.localStorage.setItem(AGENT_PET_POSITION_KEY, JSON.stringify(petPosition));
    } catch {
      // The pet remains draggable even when browser storage is unavailable.
    }
  }, [petPosition, petPositionReady]);

  useEffect(() => {
    if (!open) return;
    const layoutFrame = requestAnimationFrame(() => {
      const panel = panelRef.current?.getBoundingClientRect();
      if (!panel) return;
      setPetPosition((current) => clampAgentPetGroupPosition(current, {
        width: window.innerWidth,
        height: window.innerHeight,
      }, panel));
    });
    return () => cancelAnimationFrame(layoutFrame);
  }, [open]);

  useEffect(() => {
    const visual = petVisualRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!visual || reduceMotion.matches) return;
    const petVisual = visual;

    let animationFrame = 0;
    function followPointer(event: PointerEvent) {
      if (event.pointerType !== "mouse" || petDrag.current) return;
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const button = petButtonRef.current;
        if (!button) return;
        const bounds = button.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (event.clientX - (bounds.left + bounds.width / 2)) / 220));
        const y = Math.max(-1, Math.min(1, (event.clientY - (bounds.top + bounds.height / 2)) / 180));
        petVisual.style.transform = `translate3d(${x * 2.5}px, ${y * 2}px, 0) rotate(${x * 2.5}deg)`;
      });
    }

    window.addEventListener("pointermove", followPointer, { passive: true });
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", followPointer);
    };
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    setLoading(true);
    setLoadError("");
    try {
      const payload = await requestJson(`/api/agent/threads/${threadId}`) as { thread: AgentThread };
      setActiveThread(payload.thread);
    } catch (error) {
      setLoadError(formatError(error, t("errors.load")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const createThread = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const payload = await requestJson("/api/agent/threads", {}) as {
        thread: AgentThreadSummary;
      };
      setThreads((current) => [payload.thread, ...current]);
      await loadThread(payload.thread.id);
    } catch (error) {
      setLoadError(formatError(error, t("errors.create")));
      setLoading(false);
    }
  }, [loadThread, t]);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const payload = await requestJson("/api/agent/threads") as { threads: AgentThreadSummary[] };
      setThreads(payload.threads);
      if (payload.threads[0]) await loadThread(payload.threads[0].id);
      else await createThread();
    } catch (error) {
      setLoadError(formatError(error, t("errors.load")));
      setLoading(false);
    }
  }, [createThread, loadThread, t]);

  async function deleteThread(threadId: string) {
    try {
      await requestJson(`/api/agent/threads/${threadId}`, undefined, "DELETE");
      const remaining = threads.filter((thread) => thread.id !== threadId);
      setThreads(remaining);
      setActiveThread(null);
      if (remaining[0]) await loadThread(remaining[0].id);
      else await createThread();
    } catch (error) {
      setLoadError(formatError(error, t("errors.delete")));
    }
  }

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoadError("");
    if (!activeThread && !loading) void loadThreads();
  }

  function startPetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    petDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRight: petPosition.right,
      startBottom: petPosition.bottom,
    };
    petWasDragged.current = false;
    setPetDragging(true);
  }

  function movePet(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = petDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) >= AGENT_PET_DRAG_THRESHOLD) petWasDragged.current = true;
    if (!petWasDragged.current) return;
    const nextPosition = {
      right: drag.startRight - deltaX,
      bottom: drag.startBottom - deltaY,
    };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const panel = panelRef.current?.getBoundingClientRect();
    setPetPosition(panel
      ? clampAgentPetGroupPosition(nextPosition, viewport, panel)
      : clampAgentPetPosition(nextPosition, viewport));
  }

  function finishPetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = petDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    petDrag.current = null;
    setPetDragging(false);
  }

  function handlePetClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (petWasDragged.current) {
      petWasDragged.current = false;
      event.preventDefault();
      return;
    }
    toggleOpen();
  }

  return (
    <>
      {open ? (
        <section
          ref={panelRef}
          aria-label={t("panelLabel")}
          style={{
            right: petPosition.right,
            bottom: petPosition.bottom + AGENT_PET_HEIGHT + AGENT_PET_PANEL_GAP,
          }}
          className="no-print fixed z-40 flex h-[min(640px,calc(100vh-7.75rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-background shadow-2xl shadow-black/15 sm:w-[420px]"
        >
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-[#f7f5f3] px-3">
            <Image
              src="/brand/lujie-agent.svg"
              alt=""
              width={38}
              height={35}
              className="h-[35px] w-[38px]"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" className="min-w-0 flex-1 justify-start px-1" />}
              >
                <span className="truncate font-semibold">{displayThreadTitle(activeThread?.title, t("newConversation"), t("title"))}</span>
                <ChevronDown className="ml-auto size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuItem onClick={() => void createThread()}>
                  <Plus />
                  {t("newConversation")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {threads.map((thread) => (
                  <DropdownMenuItem
                    key={thread.id}
                    onClick={() => void loadThread(thread.id)}
                    className="group/thread"
                  >
                    <History />
                    <span className="min-w-0 flex-1 truncate">{displayThreadTitle(thread.title, t("newConversation"), t("title"))}</span>
                    {thread.id === activeThread?.id ? <Check className="size-3.5" /> : null}
                    <button
                      type="button"
                      aria-label={t("deleteConversation")}
                      className="ml-1 rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-focus/thread:opacity-100 group-hover/thread:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteThread(thread.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" aria-label={t("close")} onClick={() => setOpen(false)}>
              <X />
            </Button>
          </header>

          {loadError ? <div className="m-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{loadError}</div> : null}
          {loading && !activeThread ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <LoaderCircle className="mr-2 size-4 animate-spin" />
              {t("loading")}
            </div>
          ) : activeThread ? (
            aiReady ? (
              <AgentConversation
                key={activeThread.id}
                thread={activeThread}
                onApplicationChanged={onApplicationChanged}
                onBusyChange={setAgentBusy}
                onThreadUpdated={(thread) => {
                  setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
                  setActiveThread((current) => current ? { ...current, ...thread } : current);
                }}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <Settings className="mb-3 size-8" />
                <h3 className="font-semibold">{t("setup.title")}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("setup.description")}</p>
                <Button className="mt-5" onClick={onOpenSettings}>{t("setup.action")}</Button>
              </div>
            )
          ) : null}
        </section>
      ) : null}

      <button
        ref={petButtonRef}
        type="button"
        aria-label={open ? t("close") : t("open")}
        aria-expanded={open}
        onClick={handlePetClick}
        onPointerDown={startPetDrag}
        onPointerMove={movePet}
        onPointerUp={finishPetDrag}
        onPointerCancel={finishPetDrag}
        style={{ right: petPosition.right, bottom: petPosition.bottom, touchAction: "none" }}
        className={cn(
          "no-print group fixed z-[41] h-[75px] w-[82px] border-0 bg-transparent p-0 outline-none select-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4",
          petDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {!open ? (
          <span className="pointer-events-none absolute right-0 bottom-[calc(100%+4px)] whitespace-nowrap rounded-full border border-black/10 bg-background px-2.5 py-1 text-[11px] text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {t("petHint")}
          </span>
        ) : null}
        <span ref={petVisualRef} className="block transition-transform duration-150 ease-out">
          <span className={cn(
            "block origin-bottom",
            petDragging ? "lujie-agent-pet-dragging" : loading || agentBusy ? "lujie-agent-pet-thinking" : "lujie-agent-pet-idle",
          )}>
            <Image
              src="/brand/lujie-agent.svg"
              alt=""
              width={82}
              height={75}
              priority
              draggable={false}
              className="h-[75px] w-[82px] object-contain drop-shadow-[0_8px_8px_rgba(0,0,0,0.16)] transition-transform duration-200 group-hover:scale-105"
            />
          </span>
        </span>
      </button>
    </>
  );
}

function AgentConversation({
  thread,
  onApplicationChanged,
  onBusyChange,
  onThreadUpdated,
}: {
  thread: AgentThread;
  onApplicationChanged: (result: ApplicationChangeResult) => void;
  onBusyChange: (busy: boolean) => void;
  onThreadUpdated: (thread: AgentThreadSummary) => void;
}) {
  const t = useTranslations("agent");
  const locale = useLocale() === "en" ? "en" : "zh-CN";
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const handledToolCalls = useRef(new Set<string>());
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/agent/chat",
    prepareSendMessagesRequest: ({ id, messages }) => ({
      body: { id, locale, message: messages[messages.length - 1] },
    }),
  }), [locale]);

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    addToolApprovalResponse,
  } = useChat<CareerAgentUIMessage>({
    id: thread.id,
    messages: thread.messages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ messages: finishedMessages }) => {
      for (const message of finishedMessages) {
        for (const part of message.parts) {
          if (part.type !== "tool-update_application_card" || part.state !== "output-available") continue;
          if (handledToolCalls.current.has(part.toolCallId)) continue;
          handledToolCalls.current.add(part.toolCallId);
          onApplicationChanged(part.output);
        }
      }
      void refreshThreadSummary(thread.id, onThreadUpdated);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4">
          {messages.length === 0 ? (
            <div className="rounded-xl border bg-[#faf9f8] p-4">
              <div className="flex items-center gap-2 font-semibold">
                <FileText className="size-4" />
                {t("welcome.title")}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("welcome.description")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[t("welcome.prompt1"), t("welcome.prompt2"), t("welcome.prompt3")].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-full border bg-background px-3 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => setInput(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[88%] space-y-2 text-sm leading-6",
                message.role === "user" ? "rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground" : "w-full",
              )}>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    if (message.role === "user") {
                      return <p key={`${message.id}-${index}`} className="whitespace-pre-wrap">{part.text}</p>;
                    }
                    return (
                      <MessageResponse
                        key={`${message.id}-${index}`}
                        className="min-w-0 break-words [&_a]:break-all [&_a]:underline [&_li]:my-1 [&_p]:my-2"
                      >
                        {part.text}
                      </MessageResponse>
                    );
                  }
                  if (part.type === "tool-search_pipeline") {
                    return <ToolActivity key={part.toolCallId} done={part.state === "output-available"} label={t("tools.searchingPipeline")} />;
                  }
                  if (part.type === "tool-get_resume_context") {
                    return <ToolActivity key={part.toolCallId} done={part.state === "output-available"} label={t("tools.readingResume")} />;
                  }
                  if (part.type === "tool-update_application_card") {
                    return (
                      <ApplicationApproval
                        key={part.toolCallId}
                        part={part}
                        onDecision={(approved) => void addToolApprovalResponse({
                          id: part.state === "approval-requested" ? part.approval.id : "",
                          approved,
                          reason: approved ? undefined : t("approval.deniedReason"),
                        })}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {status === "submitted" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t("thinking")}
            </div>
          ) : null}
          {error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t("errors.request")}</p> : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t bg-background p-3">
        <div className="flex items-end gap-2 rounded-xl border bg-[#faf9f8] p-2 focus-within:border-black/30 focus-within:ring-2 focus-within:ring-black/5">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            disabled={busy}
            rows={1}
            placeholder={t("inputPlaceholder")}
            className="max-h-28 min-h-9 resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:ring-0"
          />
          {busy ? (
            <Button size="icon" variant="outline" aria-label={t("stop")} onClick={stop}><X /></Button>
          ) : (
            <Button size="icon" aria-label={t("send")} disabled={!input.trim()} onClick={submit}><ArrowUp /></Button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("approvalHint")}</p>
      </div>
    </>
  );
}

function ToolActivity({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      {done ? <Check className="size-3.5" /> : <LoaderCircle className="size-3.5 animate-spin" />}
      {label}
    </div>
  );
}

function ApplicationApproval({
  part,
  onDecision,
}: {
  part: Extract<CareerAgentUIMessage["parts"][number], { type: "tool-update_application_card" }>;
  onDecision: (approved: boolean) => void;
}) {
  const t = useTranslations("agent");

  if (part.state === "input-streaming" || part.state === "input-available") {
    return <ToolActivity done={false} label={t("approval.preparing")} />;
  }
  if (part.state === "approval-requested") {
    const input = part.input;
    const statusLabel = input.status ? {
      APPLIED: t("status.applied"),
      ASSESSMENT: t("status.assessment"),
      INTERVIEW: t("status.interview"),
      OFFER: t("status.offer"),
      REJECTED: t("status.rejected"),
      ARCHIVED: t("status.archived"),
    }[input.status] : "-";
    const rows = [
      [t("approval.operation"), input.action === "create" ? t("approval.create") : t("approval.update")],
      [t("approval.target"), [input.company, input.title].filter(Boolean).join(" ") || input.applicationId || input.jobId || "-"],
      [t("approval.status"), statusLabel],
      [t("approval.stageDate"), input.stageDate || "-"],
      [t("approval.followUpDate"), input.nextFollowUpAt || "-"],
      [t("approval.note"), input.notesToAppend || "-"],
    ];
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-foreground">
        <p className="font-semibold">{t("approval.title")}</p>
        <dl className="mt-2 space-y-1.5 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[76px_1fr] gap-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onDecision(false)}>{t("approval.cancel")}</Button>
          <Button size="sm" onClick={() => onDecision(true)}>{t("approval.confirm")}</Button>
        </div>
      </div>
    );
  }
  if (part.state === "approval-responded") {
    return <ToolActivity done label={part.approval.approved ? t("approval.executing") : t("approval.cancelled")} />;
  }
  if (part.state === "output-available") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        <Check className="mr-1.5 inline size-3.5" />
        {part.output.operation === "created" ? t("approval.created") : t("approval.updated")}
        <span className="ml-1 font-medium">{part.output.job.company} · {part.output.job.title}</span>
      </div>
    );
  }
  if (part.state === "output-error") {
    return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{part.errorText}</p>;
  }
  return null;
}

async function refreshThreadSummary(threadId: string, onThreadUpdated: (thread: AgentThreadSummary) => void) {
  try {
    const payload = await requestJson(`/api/agent/threads/${threadId}`) as { thread: AgentThread };
    onThreadUpdated(payload.thread);
  } catch {
    // A stale title does not affect the saved conversation or the completed action.
  }
}

async function requestJson(url: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || response.statusText || `HTTP ${response.status}`);
  }
  return response.json();
}

function formatError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function displayThreadTitle(title: string | undefined, emptyLabel: string, fallback: string) {
  if (!title) return fallback;
  return title === "新对话" ? emptyLabel : title;
}
