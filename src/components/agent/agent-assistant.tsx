"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  History,
  LoaderCircle,
  Maximize2,
  Minimize2,
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
import { SpeechTextarea } from "@/components/shared/speech-textarea";
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
  applications,
  jobs,
  onHide,
  onOpenSettings,
  onApplicationChanged,
  resumes,
}: {
  aiReady: boolean;
  applications: ApplicationView[];
  jobs: JobView[];
  onHide: () => void;
  onOpenSettings: () => void;
  onApplicationChanged: (result: ApplicationChangeResult) => void;
  resumes: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("agent");
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [threads, setThreads] = useState<AgentThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<AgentThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [petPosition, setPetPosition] = useState(DEFAULT_AGENT_PET_POSITION);
  const [petPositionReady, setPetPositionReady] = useState(false);
  const [dragSource, setDragSource] = useState<"pet" | "panel" | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const petButtonRef = useRef<HTMLButtonElement>(null);
  const petVisualRef = useRef<HTMLSpanElement>(null);
  const groupDrag = useRef<{
    source: "pet" | "panel";
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
  } | null>(null);
  const groupWasDragged = useRef(false);
  const completedDragSource = useRef<"pet" | "panel" | null>(null);

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
        const panel = panelRef.current?.dataset.maximized === "true"
          ? undefined
          : panelRef.current?.getBoundingClientRect();
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
      if (maximized) return;
      const panel = panelRef.current?.getBoundingClientRect();
      if (!panel) return;
      setPetPosition((current) => clampAgentPetGroupPosition(current, {
        width: window.innerWidth,
        height: window.innerHeight,
      }, panel));
    });
    return () => cancelAnimationFrame(layoutFrame);
  }, [maximized, open]);

  useEffect(() => {
    const visual = petVisualRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!visual || reduceMotion.matches) return;
    const petVisual = visual;

    let animationFrame = 0;
    function followPointer(event: PointerEvent) {
      if (event.pointerType !== "mouse" || groupDrag.current) return;
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
      setMaximized(false);
      return;
    }
    setOpen(true);
    setLoadError("");
    if (!activeThread && !loading) void loadThreads();
  }

  function startGroupDrag(event: ReactPointerEvent<HTMLElement>, source: "pet" | "panel") {
    if (source === "panel" && maximized) return;
    if (event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    groupDrag.current = {
      source,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRight: petPosition.right,
      startBottom: petPosition.bottom,
    };
    groupWasDragged.current = false;
    completedDragSource.current = null;
    setDragSource(source);
  }

  function moveGroup(event: ReactPointerEvent<HTMLElement>) {
    const drag = groupDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) >= AGENT_PET_DRAG_THRESHOLD) groupWasDragged.current = true;
    if (!groupWasDragged.current) return;
    const nextPosition = {
      right: drag.startRight - deltaX,
      bottom: drag.startBottom - deltaY,
    };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const panel = maximized ? undefined : panelRef.current?.getBoundingClientRect();
    setPetPosition(panel
      ? clampAgentPetGroupPosition(nextPosition, viewport, panel)
      : clampAgentPetPosition(nextPosition, viewport));
  }

  function finishGroupDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = groupDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    completedDragSource.current = groupWasDragged.current ? drag.source : null;
    groupDrag.current = null;
    setDragSource(null);
  }

  function handlePetClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (completedDragSource.current === "pet") {
      completedDragSource.current = null;
      event.preventDefault();
      return;
    }
    toggleOpen();
  }

  function startPanelDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select, [data-agent-panel-action]")) return;
    startGroupDrag(event, "panel");
  }

  function suppressPanelClickAfterDrag(event: React.MouseEvent<HTMLElement>) {
    if (completedDragSource.current !== "panel") return;
    completedDragSource.current = null;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <>
      {open ? (
        <section
          ref={panelRef}
          data-maximized={maximized}
          aria-label={t("panelLabel")}
          style={maximized ? undefined : {
            right: petPosition.right,
            bottom: petPosition.bottom + AGENT_PET_HEIGHT + AGENT_PET_PANEL_GAP,
          }}
          className={cn(
            "no-print fixed flex flex-col overflow-hidden border border-black/10 bg-background shadow-2xl shadow-black/15",
            maximized
              ? "inset-0 z-50 h-dvh w-screen rounded-none"
              : "z-40 h-[min(640px,calc(100vh-7.75rem))] w-[calc(100vw-2rem)] rounded-2xl sm:w-[420px]",
          )}
        >
          <header
            onPointerDown={startPanelDrag}
            onPointerMove={moveGroup}
            onPointerUp={finishGroupDrag}
            onPointerCancel={finishGroupDrag}
            onClickCapture={suppressPanelClickAfterDrag}
            style={{ touchAction: maximized ? "auto" : "none" }}
            className={cn(
              "flex h-14 shrink-0 items-center gap-2 border-b bg-[#f7f5f3] px-3",
              maximized ? "cursor-default" : dragSource === "panel" ? "cursor-grabbing" : "cursor-grab",
            )}
          >
            <Image
              src="/brand/lujie-agent.svg"
              alt=""
              draggable={false}
              width={38}
              height={35}
              className="h-[35px] w-[38px]"
            />
            <div className="min-w-0 flex-1 px-1">
              <span className="block truncate font-semibold">
                {displayThreadTitle(activeThread?.title, t("newConversation"), t("title"))}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(
                  <Button
                    data-agent-panel-action
                    variant="ghost"
                    size="icon"
                    aria-label={t("conversationHistory")}
                    title={t("conversationHistory")}
                  />
                )}
              >
                <ChevronDown className="size-4 text-muted-foreground" />
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
            <Button
              data-agent-panel-action
              variant="ghost"
              size="icon"
              aria-label={maximized ? t("restore") : t("maximize")}
              title={maximized ? t("restore") : t("maximize")}
              onClick={() => setMaximized((current) => !current)}
            >
              {maximized ? <Minimize2 /> : <Maximize2 />}
            </Button>
            <Button data-agent-panel-action variant="ghost" size="icon" aria-label={t("close")} onClick={() => {
              setOpen(false);
              setMaximized(false);
            }}>
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
                applications={applications}
                jobs={jobs}
                resumes={resumes}
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

      <div
        style={{ right: petPosition.right, bottom: petPosition.bottom }}
        className="no-print group/assistant fixed z-[41] h-[75px] w-[82px] select-none"
      >
        <button
          ref={petButtonRef}
          data-tour-agent
          type="button"
          aria-label={open ? t("close") : t("open")}
          aria-expanded={open}
          onClick={handlePetClick}
          onPointerDown={(event) => startGroupDrag(event, "pet")}
          onPointerMove={moveGroup}
          onPointerUp={finishGroupDrag}
          onPointerCancel={finishGroupDrag}
          style={{ touchAction: "none" }}
          className={cn(
            "lujie-agent-pet-trigger group/pet absolute right-0 bottom-0 h-[75px] w-[82px] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4",
            dragSource === "pet" ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          {!open ? (
            <span className="pointer-events-none absolute left-1/2 bottom-[calc(100%+5px)] -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-full border border-black/10 bg-background px-3 py-1.5 text-xs font-medium text-foreground opacity-0 shadow-[0_8px_24px_rgba(49,48,48,0.10)] transition-[opacity,transform] duration-200 ease-out group-hover/pet:translate-y-0 group-hover/pet:opacity-100 group-focus-visible/pet:translate-y-0 group-focus-visible/pet:opacity-100">
              {t("petHint")}
            </span>
          ) : null}
          <span ref={petVisualRef} className="block transition-transform duration-150 ease-out">
            <span className={cn(
              "block origin-bottom",
              dragSource ? "lujie-agent-pet-dragging" : loading || agentBusy ? "lujie-agent-pet-thinking" : "lujie-agent-pet-idle",
            )}>
              <AgentPetVisual />
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label={t("hide")}
          title={t("hide")}
          onClick={onHide}
          className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-full border border-black/10 bg-background text-muted-foreground opacity-0 shadow-[0_5px_16px_rgba(49,48,48,0.10)] transition hover:bg-surface-low hover:text-foreground group-hover/assistant:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </>
  );
}

function AgentPetVisual() {
  return (
    <svg
      viewBox="0 0 120 110"
      aria-hidden="true"
      className="h-[75px] w-[82px] overflow-visible drop-shadow-[0_8px_8px_rgba(0,0,0,0.16)]"
    >
      <path d="M25 28C25 17 34 10 45 10h31l20 20v48c0 15-12 24-29 24H48c-17 0-28-9-28-24V39c0-4 2-8 5-11Z" fill="#fff" stroke="#191919" strokeWidth="4" strokeLinejoin="round" />
      <path d="M76 10v16c0 7 5 11 12 11h8" fill="#f4f1ef" stroke="#191919" strokeWidth="4" strokeLinejoin="round" />
      <path d="M19 53c-8 1-11 8-8 14 2 4 6 5 10 4" fill="none" stroke="#191919" strokeWidth="4" strokeLinecap="round" />
      <path className="lujie-agent-pet-wave-arm" d="M97 54c9 0 13 7 10 14-2 4-6 6-10 4" fill="none" stroke="#191919" strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy="53" r="3.2" fill="#191919" />
      <circle cx="72" cy="53" r="3.2" fill="#191919" />
      <path d="M55 64c3 3 7 3 10 0" fill="none" stroke="#191919" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M43 78h34" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
      <path d="M48 87h24" stroke="#13a06f" strokeWidth="5" strokeLinecap="round" />
      <path d="M38 101c3-5 9-6 14-2M68 99c5-3 11-2 14 2" fill="none" stroke="#191919" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function AgentConversation({
  applications,
  jobs,
  resumes,
  thread,
  onApplicationChanged,
  onBusyChange,
  onThreadUpdated,
}: {
  applications: ApplicationView[];
  jobs: JobView[];
  resumes: Array<{ id: string; name: string }>;
  thread: AgentThread;
  onApplicationChanged: (result: ApplicationChangeResult) => void;
  onBusyChange: (busy: boolean) => void;
  onThreadUpdated: (thread: AgentThreadSummary) => void;
}) {
  const t = useTranslations("agent");
  const locale = useLocale() === "en" ? "en" : "zh-CN";
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAutoScrolledUserMessageId = useRef(
    thread.messages.at(-1)?.role === "user" ? thread.messages.at(-1)?.id : undefined,
  );
  const handledToolCalls = useRef(new Set<string>());
  const jobLabels = useMemo(
    () => new Map(jobs.map((job) => [job.id, [job.company, job.title].filter(Boolean).join(" · ")])),
    [jobs],
  );
  const resumeLabels = useMemo(() => new Map(resumes.map((resume) => [resume.id, resume.name])), [resumes]);
  const applicationJobIds = useMemo(
    () => new Map(applications.map((application) => [application.id, application.jobId])),
    [applications],
  );
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
    addToolOutput,
  } = useChat<CareerAgentUIMessage>({
    id: thread.id,
    messages: thread.messages,
    transport,
    sendAutomaticallyWhen: (options) =>
      lastAssistantMessageIsCompleteWithApprovalResponses(options)
      || lastAssistantMessageIsCompleteWithToolCalls(options),
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
  }, []);

  useEffect(() => {
    const latestMessage = messages.at(-1);
    if (
      latestMessage?.role !== "user" ||
      latestMessage.id === lastAutoScrolledUserMessageId.current
    ) return;
    lastAutoScrolledUserMessageId.current = latestMessage.id;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";
  const latestMessage = messages.at(-1);
  const completedWriteBeforeError = latestMessage?.role === "assistant" && latestMessage.parts.some(
    (part) => isAgentWriteToolPart(part) && part.state === "output-available",
  );

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

          {messages.filter(hasVisibleAgentMessageContent).map((message) => (
            <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[88%] space-y-2 text-sm leading-6",
                message.role === "user" ? "rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground" : "w-full",
              )}>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    if (!part.text.trim()) return null;
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
                  if (part.type === "tool-configure_jd_optimization") {
                    if (part.state === "input-streaming") {
                      return <ToolActivity key={part.toolCallId} done={false} label={t("configuration.preparing")} />;
                    }
                    return (
                      <JdOptimizationConfiguration
                        key={part.toolCallId}
                        part={part}
                        disabled={message.id !== latestMessage?.id}
                        onSubmit={(preferences) => addToolOutput({
                          tool: "configure_jd_optimization",
                          toolCallId: part.toolCallId,
                          output: { preferences },
                        })}
                      />
                    );
                  }
                  if (part.type === "tool-configure_interview") {
                    if (part.state === "input-streaming") {
                      return <ToolActivity key={part.toolCallId} done={false} label={t("configuration.preparing")} />;
                    }
                    return (
                      <InterviewConfiguration
                        key={part.toolCallId}
                        part={part}
                        disabled={message.id !== latestMessage?.id}
                        onSubmit={(task, mode) => addToolOutput({
                          tool: "configure_interview",
                          toolCallId: part.toolCallId,
                          output: { task, mode },
                        })}
                      />
                    );
                  }
                  if (part.type === "tool-update_application_card") {
                    return (
                      <ApplicationApproval
                        key={part.toolCallId}
                        part={part}
                        targetLabel={resolveApplicationTargetLabel(part.input, jobLabels, applicationJobIds)}
                        onDecision={(approved) => void addToolApprovalResponse({
                          id: part.state === "approval-requested" ? part.approval.id : "",
                          approved,
                          reason: approved ? undefined : t("approval.deniedReason"),
                        })}
                      />
                    );
                  }
                  if (
                    part.type === "tool-create_resume_from_experience" ||
                    part.type === "tool-create_jd_tailored_resume" ||
                    part.type === "tool-create_interview_preparation" ||
                    part.type === "tool-create_mock_interview" ||
                    part.type === "tool-update_resume_presentation"
                  ) {
                    return (
                      <AgentWriteApproval
                        key={part.toolCallId}
                        part={part}
                        jobLabel={resolveWriteJobLabel(part, jobLabels)}
                        resumeLabel={resolveWriteResumeLabel(part, resumeLabels)}
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

          {busy ? (
            <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t("thinking")}
            </div>
          ) : null}
          {error ? (
            <p className={cn(
              "rounded-lg px-3 py-2 text-sm",
              completedWriteBeforeError
                ? "border border-amber-200 bg-amber-50 text-amber-900"
                : "bg-destructive/10 text-destructive",
            )}>
              {completedWriteBeforeError ? t("errors.afterWrite") : formatError(error, t("errors.request"))}
            </p>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t bg-background p-3">
        <div className="flex items-end gap-2 rounded-xl border bg-[#faf9f8] p-2 focus-within:border-black/30 focus-within:ring-2 focus-within:ring-black/5">
          <SpeechTextarea
            value={input}
            onValueChange={setInput}
            speechSeparator=" "
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            disabled={busy}
            maxLength={50_000}
            rows={1}
            placeholder={t("inputPlaceholder")}
            wrapperClassName="min-w-0 flex-1"
            speechButtonClassName="top-1 right-0 border-0 bg-transparent shadow-none hover:bg-black/5"
            className="max-h-28 min-h-9 resize-none border-0 bg-transparent py-1.5 pl-1 shadow-none focus-visible:ring-0"
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

function isAgentWriteToolPart(part: CareerAgentUIMessage["parts"][number]) {
  return part.type === "tool-update_application_card" ||
    part.type === "tool-create_resume_from_experience" ||
    part.type === "tool-create_jd_tailored_resume" ||
    part.type === "tool-create_interview_preparation" ||
    part.type === "tool-create_mock_interview" ||
    part.type === "tool-update_resume_presentation";
}

function hasVisibleAgentMessageContent(message: CareerAgentUIMessage) {
  return message.parts.some((part) =>
    (part.type === "text" && Boolean(part.text.trim())) ||
    part.type === "tool-search_pipeline" ||
    part.type === "tool-get_resume_context" ||
    part.type === "tool-configure_jd_optimization" ||
    part.type === "tool-configure_interview" ||
    isAgentWriteToolPart(part),
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

type MatchPreferenceKey = "emphasizeImpact" | "quantifyResults" | "atsFriendly" | "highlightMatchedSkills";
type MatchPreferences = Record<MatchPreferenceKey, boolean>;
type InterviewMode = "comprehensive" | "project" | "behavioral" | "hr";

function JdOptimizationConfiguration({
  part,
  disabled,
  onSubmit,
}: {
  part: Extract<CareerAgentUIMessage["parts"][number], { type: "tool-configure_jd_optimization" }>;
  disabled: boolean;
  onSubmit: (preferences: MatchPreferences) => void;
}) {
  const t = useTranslations("agent");
  const input = part.input;
  const recommended: MatchPreferences = {
    emphasizeImpact: true,
    quantifyResults: true,
    atsFriendly: true,
    highlightMatchedSkills: true,
    ...input?.recommended,
  };
  const [preferences, setPreferences] = useState<MatchPreferences>(recommended);
  const [submitted, setSubmitted] = useState(false);

  if (part.state === "output-available") {
    return <ToolActivity done label={t("configuration.jdSelected")} />;
  }
  if (part.state === "output-error") {
    return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{part.errorText}</p>;
  }
  if (part.state !== "input-available" || !input) {
    return <ToolActivity done={false} label={t("configuration.preparing")} />;
  }

  const options: MatchPreferenceKey[] = [
    "emphasizeImpact",
    "quantifyResults",
    "atsFriendly",
    "highlightMatchedSkills",
  ];
  return (
    <div className="rounded-xl border bg-[#faf9f8] p-3 text-foreground">
      <p className="font-semibold">{t("configuration.jdTitle")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{input.resumeName} → {input.jobName}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{input.reason}</p>
      <div className="mt-3 grid auto-rows-fr grid-cols-2 items-stretch gap-2">
        {options.map((option) => {
          const selected = preferences[option];
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={submitted || disabled}
              className={cn(
                "h-full min-h-28 rounded-lg border px-3 py-2.5 text-left text-xs transition",
                selected ? "border-black bg-background shadow-sm" : "border-black/10 bg-transparent text-muted-foreground",
              )}
              onClick={() => setPreferences((current) => ({ ...current, [option]: !current[option] }))}
            >
              <span className="flex items-start gap-1.5 font-medium leading-5">
                {selected ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <span className="mt-0.5 size-3.5 shrink-0 rounded border" />}
                <span>
                  {t(`configuration.jdOptions.${option}`)}
                  {recommended[option] ? (
                    <span className="ms-1 whitespace-nowrap font-normal text-emerald-700">{t("configuration.recommended")}</span>
                  ) : null}
                </span>
              </span>
              <span className="mt-1.5 block text-[11px] leading-4 text-muted-foreground">
                {t(`configuration.jdOptionDescriptions.${option}`)}
              </span>
            </button>
          );
        })}
      </div>
      {disabled ? <p className="mt-3 text-xs text-muted-foreground">{t("configuration.expired")}</p> : null}
      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={submitted || disabled} onClick={() => {
          setSubmitted(true);
          onSubmit(preferences);
        }}>
          {t("configuration.confirm")}
        </Button>
      </div>
    </div>
  );
}

function InterviewConfiguration({
  part,
  disabled,
  onSubmit,
}: {
  part: Extract<CareerAgentUIMessage["parts"][number], { type: "tool-configure_interview" }>;
  disabled: boolean;
  onSubmit: (task: "preparation" | "simulation", mode: InterviewMode) => void;
}) {
  const t = useTranslations("agent");
  const input = part.input;
  const [mode, setMode] = useState<InterviewMode>(() => input?.recommendedMode ?? "comprehensive");
  const [submitted, setSubmitted] = useState(false);

  if (part.state === "output-available") {
    return <ToolActivity done label={t("configuration.interviewSelected")} />;
  }
  if (part.state === "output-error") {
    return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{part.errorText}</p>;
  }
  if (part.state !== "input-available" || !input) {
    return <ToolActivity done={false} label={t("configuration.preparing")} />;
  }

  const modes: InterviewMode[] = ["comprehensive", "project", "behavioral", "hr"];
  return (
    <div className="rounded-xl border bg-[#faf9f8] p-3 text-foreground">
      <p className="font-semibold">
        {input.task === "simulation" ? t("configuration.simulationTitle") : t("configuration.preparationTitle")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{input.resumeName} → {input.jobName}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{input.reason}</p>
      <div className="mt-3 grid auto-rows-fr grid-cols-2 items-stretch gap-2">
        {modes.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            disabled={submitted || disabled}
            className={cn(
              "h-full min-h-28 rounded-lg border px-3 py-2.5 text-left text-xs transition",
              mode === option ? "border-black bg-background shadow-sm" : "border-black/10 bg-transparent text-muted-foreground",
            )}
            onClick={() => setMode(option)}
          >
            <span className="flex items-start gap-1.5 font-medium leading-5">
              {mode === option ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <span className="mt-0.5 size-3.5 shrink-0 rounded-full border" />}
              <span>
                {t(`approval.focuses.${option}`)}
                {input.recommendedMode === option ? (
                  <span className="ms-1 whitespace-nowrap font-normal text-emerald-700">{t("configuration.recommended")}</span>
                ) : null}
              </span>
            </span>
            <span className="mt-1.5 block text-[11px] leading-4 text-muted-foreground">
              {t(`configuration.interviewModeDescriptions.${option}`)}
            </span>
          </button>
        ))}
      </div>
      {disabled ? <p className="mt-3 text-xs text-muted-foreground">{t("configuration.expired")}</p> : null}
      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={submitted || disabled} onClick={() => {
          setSubmitted(true);
          onSubmit(input.task ?? "preparation", mode);
        }}>
          {t("configuration.confirm")}
        </Button>
      </div>
    </div>
  );
}

function ApplicationApproval({
  part,
  targetLabel,
  onDecision,
}: {
  part: Extract<CareerAgentUIMessage["parts"][number], { type: "tool-update_application_card" }>;
  targetLabel?: string;
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
      [t("approval.target"), targetLabel || [input.company, input.title].filter(Boolean).join(" · ") || t("approval.selectedJob")],
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

type AgentWritePart = Extract<CareerAgentUIMessage["parts"][number], {
  type:
    | "tool-create_resume_from_experience"
    | "tool-create_jd_tailored_resume"
    | "tool-create_interview_preparation"
    | "tool-create_mock_interview"
    | "tool-update_resume_presentation";
}>;

function resolveWriteJobLabel(part: AgentWritePart, jobLabels: Map<string, string>) {
  if (part.type === "tool-create_resume_from_experience" || part.type === "tool-update_resume_presentation") return undefined;
  return part.input?.jobId ? jobLabels.get(part.input.jobId) : undefined;
}

function resolveWriteResumeLabel(part: AgentWritePart, resumeLabels: Map<string, string>) {
  if (part.type === "tool-create_resume_from_experience") return undefined;
  return part.input?.resumeVersionId ? resumeLabels.get(part.input.resumeVersionId) : undefined;
}

function AgentWriteApproval({
  part,
  jobLabel,
  resumeLabel,
  onDecision,
}: {
  part: AgentWritePart;
  jobLabel?: string;
  resumeLabel?: string;
  onDecision: (approved: boolean) => void;
}) {
  const t = useTranslations("agent");
  const templateT = useTranslations("resume.library.templates");
  if (part.state === "input-streaming" || part.state === "input-available") {
    return <ToolActivity done={false} label={t(`tools.${writeToolKey(part.type)}Working`)} />;
  }
  if (part.state === "approval-requested") {
    const rows = writeApprovalRows(part, t, templateT, jobLabel, resumeLabel);
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-foreground">
        <p className="font-semibold">{t(`approval.${writeToolKey(part.type)}Title`)}</p>
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
        {t(`approval.${writeToolKey(part.type)}Created`)}
        <Button
          render={<Link href={part.output.href} />}
          nativeButton={false}
          size="sm"
          variant="link"
          className="ml-1 h-auto p-0 text-xs text-emerald-900"
        >
          {t("approval.openResult")}
        </Button>
      </div>
    );
  }
  if (part.state === "output-error") {
    return <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{part.errorText}</p>;
  }
  return null;
}

function writeToolKey(type: AgentWritePart["type"]) {
  if (type === "tool-create_resume_from_experience") return "resume" as const;
  if (type === "tool-create_jd_tailored_resume") return "tailoredResume" as const;
  if (type === "tool-create_interview_preparation") return "interviewPreparation" as const;
  if (type === "tool-create_mock_interview") return "mockInterview" as const;
  return "resumePresentation" as const;
}

function writeApprovalRows(
  part: AgentWritePart,
  t: ReturnType<typeof useTranslations>,
  templateT: ReturnType<typeof useTranslations>,
  jobLabel?: string,
  resumeLabel?: string,
) {
  if (part.type === "tool-create_resume_from_experience") {
    const input = part.input;
    if (!input) return [];
    return [
      [t("approval.resumeName"), input.resumeName || "-"],
      [t("approval.targetRole"), input.targetRole || "-"],
      [t("approval.sourceFacts"), truncateApprovalText(input.sourceText || "") || "-"],
    ];
  }
  if (part.type === "tool-create_jd_tailored_resume") {
    const input = part.input;
    if (!input) return [];
    return [
      [t("approval.sourceResume"), resumeLabel || t("approval.selectedResume")],
      [t("approval.target"), jobLabel || [input.company, input.title].filter(Boolean).join(" · ") || t("approval.selectedJob")],
      [t("approval.jd"), input.jd ? truncateApprovalText(input.jd) : t("approval.savedJd")],
    ];
  }
  if (part.type === "tool-update_resume_presentation") {
    const input = part.input;
    if (!input) return [];
    return [
      [t("approval.sourceResume"), resumeLabel || t("approval.selectedResume")],
      [t("approval.template"), input.template ? templateT(input.template) : "-"],
    ];
  }
  if (part.type === "tool-create_interview_preparation") {
    const input = part.input;
    if (!input) return [];
    return [
      [t("approval.target"), jobLabel || t("approval.selectedJob")],
      [t("approval.sourceResume"), resumeLabel || t("approval.selectedResume")],
      [t("approval.focus"), input.focus ? t(`approval.focuses.${input.focus}`) : "-"],
    ];
  }
  const input = part.input;
  if (!input) return [];
  return [
    [t("approval.target"), jobLabel || t("approval.selectedJob")],
    [t("approval.sourceResume"), resumeLabel || t("approval.selectedResume")],
    [t("approval.focus"), input.mode ? t(`approval.focuses.${input.mode}`) : "-"],
  ];
}

function resolveApplicationTargetLabel(
  input: Extract<CareerAgentUIMessage["parts"][number], { type: "tool-update_application_card" }>["input"],
  jobLabels: Map<string, string>,
  applicationJobIds: Map<string, string>,
) {
  const jobId = input?.jobId || (input?.applicationId ? applicationJobIds.get(input.applicationId) : undefined);
  return jobId ? jobLabels.get(jobId) : undefined;
}

function truncateApprovalText(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 180)}…` : text;
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
