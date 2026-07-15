"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import type { NavKey } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "@/components/app/navigation";

export function AppSidebar({
  active,
  isResumeEditor,
  onNavigate,
}: {
  active: NavKey;
  isResumeEditor: boolean;
  onNavigate: (key: NavKey) => void;
}) {
  const t = useTranslations("app");

  return (
    <aside
      className={cn(
        "no-print fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-line bg-surface-low px-4 py-6 lg:flex",
        isResumeEditor && "lg:hidden",
      )}
    >
      <div className="mb-8 flex flex-col items-center">
        <div className="flex items-center justify-center gap-3">
          <Image src="/brand/lujie-mark.svg" alt="" width={44} height={44} className="shrink-0" priority />
          <p className="font-serif text-3xl font-semibold leading-none tracking-normal text-primary">{t("brandName")}</p>
        </div>
        <p className="mt-2 text-[0.625rem] font-medium uppercase tracking-[0.28em] text-muted-foreground">
          LuJie CareerKit
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-7">
        {navGroups.map((group) => (
          <div key={group.labelKey} className="flex flex-col gap-2">
            <p className="px-3 text-xs font-medium text-muted-foreground">{t(`navGroups.${group.labelKey}`)}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition",
                    active === item.key
                      ? "bg-surface-high text-primary shadow-[inset_0_0_0_1px_var(--border)]"
                      : "text-foreground/80 hover:bg-surface-mid hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t(`nav.${item.labelKey}`)}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-line pt-5 text-xs leading-5 text-muted-foreground">
        <p>{t("sidebar.localMode")}</p>
        <p>{t("sidebar.encrypted")}</p>
      </div>
    </aside>
  );
}
