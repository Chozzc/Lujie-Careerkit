"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { AiSettingsPanel } from "@/components/settings/ai-settings-panel";
import { Button } from "@/components/ui/button";
import type { RedactedAiSettings } from "@/lib/ai/settings";
import type { InitialData } from "@/components/app/types";

export function SettingsView({
  settings,
  aiSettings,
  agentAssistantVisible,
  onAiSettingsChange,
  onAgentAssistantVisibleChange,
  onClearSampleData,
  onResetData,
  onStatus,
}: {
  settings: InitialData["settings"];
  aiSettings: RedactedAiSettings | null;
  agentAssistantVisible: boolean;
  onAiSettingsChange: (settings: RedactedAiSettings) => void;
  onAgentAssistantVisibleChange: (visible: boolean) => void;
  onClearSampleData: () => Promise<void>;
  onResetData: () => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const t = useTranslations("settings");
  const [isClearingSampleData, setIsClearingSampleData] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);

  async function handleClearSampleData() {
    const confirmed = window.confirm(t("clearSampleConfirm"));
    if (!confirmed) return;

    setIsClearingSampleData(true);
    try {
      await onClearSampleData();
      onStatus(t("clearSampleSuccess"));
    } catch (error) {
      onStatus(error instanceof Error ? error.message : t("clearSampleFailed"));
    } finally {
      setIsClearingSampleData(false);
    }
  }

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
        agentAssistantVisible={agentAssistantVisible}
        onSettingsChange={onAiSettingsChange}
        onAgentAssistantVisibleChange={onAgentAssistantVisibleChange}
        onStatus={onStatus}
      />
      <section className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(49,48,48,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">{t("localDataTitle")}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t("localDataDescription")}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => void handleClearSampleData()}
              disabled={isClearingSampleData || isResettingData}
            >
              {isClearingSampleData ? t("clearingSample") : t("clearSample")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={() => void handleResetData()}
              disabled={isClearingSampleData || isResettingData}
            >
              {isResettingData ? t("resetting") : t("reset")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
