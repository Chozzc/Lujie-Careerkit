"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import confetti from "canvas-confetti";

import { buildFirstUseTourSteps } from "@/lib/first-use-tour";
import type { NavKey } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SpotlightRect = { left: number; top: number; width: number; height: number };

export function FirstUseTour({
  active,
  onNavigate,
  onFinish,
}: {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  onFinish: (outcome: "completed" | "skipped") => void;
}) {
  const t = useTranslations("firstUseTour");
  const steps = useMemo(() => buildFirstUseTourSteps(), []);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = steps[stepIndex] ?? steps[0];
  const isWelcome = current.id === "welcome";
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!current.nav || current.nav === active) return;
    onNavigate(current.nav);
  }, [active, current.nav, onNavigate]);

  useEffect(() => {
    if (isWelcome || (!current.nav && !current.target)) {
      const frame = window.requestAnimationFrame(() => setSpotlight(null));
      return () => window.cancelAnimationFrame(frame);
    }

    function measure() {
      const target = findVisibleTarget(current);
      if (!target) {
        setSpotlight(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const padding = 6;
      setSpotlight({
        left: Math.max(8, rect.left - padding),
        top: Math.max(8, rect.top - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    }

    const frame = window.requestAnimationFrame(measure);
    const timeout = window.setTimeout(measure, 180);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, current, isWelcome]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      (dialog?.querySelector<HTMLButtonElement>("[data-tour-autofocus]") ?? dialog?.querySelector<HTMLButtonElement>("button"))?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onFinish("skipped");
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onFinish]);

  if (typeof document === "undefined") return null;

  const dialogPosition = getDialogPosition(spotlight, isWelcome);
  const dialogIsLeftOfSpotlight = Boolean(
    spotlight && typeof dialogPosition.left === "number" && dialogPosition.left < spotlight.left,
  );
  const arrowTop = spotlight && typeof dialogPosition.top === "number"
    ? Math.max(24, Math.min(260, spotlight.top + spotlight.height / 2 - dialogPosition.top - 20))
    : 32;
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className={cn("absolute inset-0", isWelcome && "bg-black/45 backdrop-blur-[2px]")} />
      {spotlight ? (
        <div
          className="pointer-events-none fixed rounded-xl border-2 border-white/95 ring-4 ring-white/20"
          style={{
            left: spotlight.left,
            top: spotlight.top,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.48)",
          }}
        />
      ) : !isWelcome ? <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" /> : null}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-use-tour-title"
        aria-describedby="first-use-tour-description"
        className={cn(
          "fixed z-[101] w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-white/20 bg-surface p-5 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.28)]",
          isWelcome && "text-center",
        )}
        style={dialogPosition}
      >
        {spotlight && dialogPosition.left !== "50%" ? (
          <span
            className={cn(
              "absolute grid h-10 w-10 place-items-center rounded-full border border-line bg-surface shadow-md",
              dialogIsLeftOfSpotlight ? "-right-5" : "-left-5",
            )}
            style={{ top: arrowTop }}
            aria-hidden
          >
            {dialogIsLeftOfSpotlight ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onFinish("skipped")}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-low hover:text-foreground"
          aria-label={t("skip")}
        >
          <X className="h-4 w-4" />
        </button>

        <>
            {!isWelcome ? (
              <p className="pr-8 text-xs font-semibold tracking-[0.12em] text-brand">
                {t("progress", { current: stepIndex, total: steps.length - 1 })}
              </p>
            ) : null}
            <h2 id="first-use-tour-title" className={cn("whitespace-pre-line font-serif text-2xl font-semibold leading-8 text-primary", isWelcome ? "px-8" : "mt-3 pr-8")}>
              {t(`steps.${current.id}.title`)}
            </h2>
            <p id="first-use-tour-description" className="mt-3 text-sm leading-6 text-muted-foreground">
              {t(`steps.${current.id}.description`)}
            </p>

            <div className={cn("mt-5 flex items-center gap-2", isWelcome ? "justify-center" : "justify-between")}>
              {!isWelcome ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-low"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("previous")}
                </button>
              ) : (
                <button type="button" onClick={() => onFinish("skipped")} className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground">
                  {t("skip")}
                </button>
              )}
              <button
                type="button"
                data-tour-autofocus={isWelcome ? true : undefined}
                onClick={() => {
                  if (isLast) {
                    fireCelebration();
                    onFinish("completed");
                  }
                  else setStepIndex((index) => Math.min(steps.length - 1, index + 1));
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85"
              >
                {isLast ? t("finish") : isWelcome ? t("start") : t("next")}
                {isLast ? <Sparkles className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
        </>
      </div>
    </div>,
    document.body,
  );
}

function fireCelebration() {
  const options = { particleCount: 120, spread: 65, disableForReducedMotion: true };
  void confetti({ ...options, angle: 60, origin: { x: 0, y: 0.8 } });
  void confetti({ ...options, angle: 120, origin: { x: 1, y: 0.8 } });
}

function findVisibleTarget(step: ReturnType<typeof buildFirstUseTourSteps>[number]) {
  const candidates = step.target === "agent"
    ? [...document.querySelectorAll<HTMLElement>("[data-tour-agent]")]
    : [
        ...document.querySelectorAll<HTMLElement>(`[data-tour-nav="${step.nav}"]`),
        ...document.querySelectorAll<HTMLElement>("[data-tour-mobile-nav]"),
      ];
  return candidates.find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  });
}

function getDialogPosition(spotlight: SpotlightRect | null, centered: boolean): CSSProperties {
  if (centered || !spotlight || typeof window === "undefined" || window.innerWidth < 768) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  const width = 368;
  const gap = 24;
  const rightEdge = spotlight.left + spotlight.width;
  const left = window.innerWidth - rightEdge >= width + gap
    ? rightEdge + gap
    : Math.max(16, spotlight.left - width - gap);
  const top = Math.min(window.innerHeight - 330, Math.max(16, spotlight.top - 24));
  return { left, top: Math.max(16, top) };
}
