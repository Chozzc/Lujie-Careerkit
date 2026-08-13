"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import type { NavKey } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function AppPageHeader({
  active,
  pageTitle,
  pageSubtitle,
  showResumeHeader = false,
  isPending,
  toast,
  onAddApplication,
}: {
  active: NavKey;
  pageTitle?: string;
  pageSubtitle: string;
  showResumeHeader?: boolean;
  isPending: boolean;
  toast: string;
  onAddApplication: () => void;
}) {
  const t = useTranslations("app.header");

  return (
    <div
      className={cn(
        "mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end",
        active === "resume" && !showResumeHeader && "hidden",
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
            {t("addApplication")}
          </button>
        ) : isPending || toast ? (
          <div className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted-foreground">
            {isPending ? t("processing") : toast}
          </div>
        ) : null}
      </div>
    </div>
  );
}
