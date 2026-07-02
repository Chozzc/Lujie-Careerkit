"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/app/language-switcher";
import { AiSettingsPanel } from "@/components/settings/ai-settings-panel";
import type { RedactedAiSettings } from "@/lib/ai/settings";
import type { InitialData } from "@/components/app/types";

export function SettingsView({
  settings,
  aiSettings,
  onAiSettingsChange,
  onResetData,
  onStatus,
}: {
  settings: InitialData["settings"];
  aiSettings: RedactedAiSettings | null;
  onAiSettingsChange: (settings: RedactedAiSettings) => void;
  onResetData: () => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const t = useTranslations("settings");
  const [isResettingData, setIsResettingData] = useState(false);

  async function handleResetData() {
    const confirmed = window.confirm(t("resetConfirm"));
    if (!confirmed) return;

    setIsResettingData(true);
    try {
      await onResetData();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : t("resetFailed"));
    } finally {
      setIsResettingData(false);
    }
  }

  return (
    <div className="flex max-w-6xl flex-col gap-4">
      <AiSettingsPanel
        key={settings?.updatedAt ?? "empty-ai-settings"}
        settings={aiSettings}
        onSettingsChange={onAiSettingsChange}
        onStatus={onStatus}
      />
      <section className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(49,48,48,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">{t("languageTitle")}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t("languageDescription")}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(49,48,48,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">{t("localDataTitle")}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t("localDataDescription")}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleResetData()}
            disabled={isResettingData}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResettingData ? t("resetting") : t("reset")}
          </button>
        </div>
      </section>
    </div>
  );
}
