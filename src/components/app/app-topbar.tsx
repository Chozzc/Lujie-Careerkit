"use client";

import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

import { HeaderIconButton, HeaderMenuPanel, type HeaderMenuKey } from "@/components/app/header-menu";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { navItems } from "@/components/app/navigation";
import type { ApplicationView, JobView } from "@/components/app/types";
import { buildDashboardSummary } from "@/lib/dashboard";
import type { NavKey } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function AppTopbar({
  active,
  isResumeEditor,
  headerMenu,
  setHeaderMenu,
  followUpReminders,
  dashboard,
  resumeVersionCount,
  provider,
  onNavigate,
}: {
  active: NavKey;
  isResumeEditor: boolean;
  headerMenu: HeaderMenuKey | null;
  setHeaderMenu: Dispatch<SetStateAction<HeaderMenuKey | null>>;
  followUpReminders: Array<{ application: ApplicationView; job?: JobView; dueDate: string | null }>;
  dashboard: ReturnType<typeof buildDashboardSummary>;
  resumeVersionCount: number;
  provider: string;
  onNavigate: (key: NavKey) => void;
}) {
  const t = useTranslations("app");

  return (
    <header
      className={cn(
        "no-print sticky top-0 z-20 border-b border-line bg-background/85 px-4 py-3 backdrop-blur lg:ml-72 lg:px-8",
        isResumeEditor && "hidden",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex items-center gap-2">
            <Image src="/brand/lujie-mark.svg" alt="" width={28} height={28} className="shrink-0" priority />
            <span className="font-serif text-xl font-semibold text-primary">{t("brandName")}</span>
          </div>
          <select
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            value={active}
            onChange={(event) => onNavigate(event.target.value as NavKey)}
          >
            {navItems.map((item) => (
              <option key={item.key} value={item.key}>
                {t(`nav.${item.labelKey}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden h-10 w-72 lg:block" aria-hidden />
        <div className="relative flex items-center gap-2 text-primary">
          <LanguageSwitcher compact />
          <HeaderIconButton
            label={t("topbar.notifications")}
            active={headerMenu === "notifications"}
            onClick={() => setHeaderMenu((current) => (current === "notifications" ? null : "notifications"))}
          >
            <Bell className="h-5 w-5" />
            {followUpReminders.length > 0 && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-600" />
            )}
          </HeaderIconButton>
          <a
            href="https://github.com/Chozzc/Lujie-Careerkit"
            target="_blank"
            rel="noreferrer"
            className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-surface-low"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
              <path d="M12 .7A11.5 11.5 0 0 0 8.4 23c.6.1.8-.3.8-.6v-2.2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C14.7 4 16 4 16 4c.6 1.5.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.8 5.4-5.5 5.7.4.4.8 1.1.8 2.2v4.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .7Z" />
            </svg>
          </a>
          <button
            type="button"
            onClick={() => setHeaderMenu((current) => (current === "profile" ? null : "profile"))}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-semibold text-white transition hover:bg-primary/90",
              headerMenu === "profile" && "ring-2 ring-primary/20",
            )}
            aria-label={t("topbar.profile")}
          >
            L
          </button>
          {headerMenu && (
            <HeaderMenuPanel
              menu={headerMenu}
              reminders={followUpReminders}
              dashboard={dashboard}
              resumeVersionCount={resumeVersionCount}
              provider={provider}
              onNavigate={(key) => {
                onNavigate(key);
                setHeaderMenu(null);
              }}
              onClose={() => setHeaderMenu(null)}
            />
          )}
        </div>
      </div>
    </header>
  );
}
