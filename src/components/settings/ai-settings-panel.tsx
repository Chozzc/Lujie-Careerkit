"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, PlugZap, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AI_PROVIDER_GROUPS,
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER_ID,
  getAiProvider,
  getDefaultAiModel,
  providerRequiresApiKey,
} from "@/lib/ai/provider-registry";
import type { RedactedAiSettings } from "@/lib/ai/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

type AiSettingsPanelProps = {
  settings: RedactedAiSettings | null;
  onSettingsChange: (settings: RedactedAiSettings) => void;
  onStatus: (message: string) => void;
};

type SettingsResponse = {
  settings: RedactedAiSettings;
  result?: {
    source: "ai" | "fallback";
    message: string;
    data: { ok: boolean };
  };
};

type ErrorResponse = { message?: string };

type AiSettingsRequestPayload = {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiApiKey: string;
  clearApiKey?: boolean;
  aiEnabled: boolean;
  aiTemperature: number;
};

const CUSTOM_MODEL_VALUE = "__custom_model__";
const DEFAULT_PROVIDER = getAiProvider(DEFAULT_AI_PROVIDER_ID);

const DEFAULT_SETTINGS: RedactedAiSettings = {
  aiProvider: DEFAULT_PROVIDER.id,
  aiModel: getDefaultAiModel(DEFAULT_PROVIDER.id),
  aiBaseUrl: DEFAULT_PROVIDER.baseUrl,
  aiEnabled: false,
  aiTemperature: 0.3,
  aiLastTestedAt: null,
  aiLastTestStatus: "untested",
  hasApiKey: false,
  apiKeyPreview: "",
  requiresApiKey: true,
};

export function AiSettingsPanel({ settings, onSettingsChange, onStatus }: AiSettingsPanelProps) {
  const t = useTranslations("settings.ai");
  const initial = settings ?? DEFAULT_SETTINGS;
  const initialProvider = getAiProvider(initial.aiProvider);
  const initialModel = initial.aiModel || initialProvider.defaultModel;
  const [providerId, setProviderId] = useState(initial.aiProvider);
  const provider = getAiProvider(providerId);
  const [model, setModel] = useState(initialModel);
  const [baseUrl, setBaseUrl] = useState(initial.aiBaseUrl || initialProvider.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(initial.aiEnabled);
  const [temperature, setTemperature] = useState(String(initial.aiTemperature));
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState("");
  const [customModel, setCustomModel] = useState(!initialProvider.models.includes(initialModel));
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const groupedProviders = useMemo(
    () =>
      AI_PROVIDER_GROUPS.map((group) => ({
        ...group,
        providers: AI_PROVIDERS.filter((item) => item.group === group.id),
      })),
    [],
  );
  const requiresKey = providerRequiresApiKey(providerId);
  const canEditBaseUrl = Boolean(provider.baseUrlEditable);
  const selectedModelValue = customModel ? CUSTOM_MODEL_VALUE : model;
  const apiKeyStatus = saved.hasApiKey ? t("savedKey") : t("missingKey");

  function buildSettingsPayload(clearApiKey: boolean): AiSettingsRequestPayload {
    return {
      aiProvider: providerId,
      aiModel: model,
      aiBaseUrl: baseUrl,
      aiApiKey: clearApiKey ? "" : apiKey,
      clearApiKey,
      aiEnabled: clearApiKey ? false : enabled,
      aiTemperature: Number(temperature),
    };
  }

  function applyReturnedSettings(nextSettings: RedactedAiSettings) {
    setSaved(nextSettings);
    const nextProvider = getAiProvider(nextSettings.aiProvider);
    setProviderId(nextSettings.aiProvider);
    setModel(nextSettings.aiModel || nextProvider.defaultModel);
    setBaseUrl(nextSettings.aiBaseUrl || nextProvider.baseUrl);
    setApiKey("");
    setEnabled(nextSettings.aiEnabled);
    setTemperature(String(nextSettings.aiTemperature));
    setCustomModel(!nextProvider.models.includes(nextSettings.aiModel));
    onSettingsChange(nextSettings);
  }

  function handleProviderChange(nextProviderId: string) {
    const nextProvider = getAiProvider(nextProviderId);
    setProviderId(nextProvider.id);
    setModel(nextProvider.defaultModel);
    setBaseUrl(nextProvider.baseUrl);
    setCustomModel(false);
    setStatus(t("selected", { provider: nextProvider.label }));
  }

  function handleModelSelect(value: string) {
    if (value === CUSTOM_MODEL_VALUE) {
      setCustomModel(true);
      return;
    }

    setCustomModel(false);
    setModel(value);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveSettings({ clearApiKey: false });
  }

  async function saveSettings({ clearApiKey }: { clearApiKey: boolean }) {
    setIsSaving(true);
    setStatus(clearApiKey ? t("deletingKey") : t("savingSettings"));
    try {
      const response = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSettingsPayload(clearApiKey)),
      });
      const payload = (await response.json()) as SettingsResponse | ErrorResponse;
      if (!response.ok) {
        throw new Error(getResponseMessage(payload, t("saveFailed")));
      }
      if (!("settings" in payload)) {
        throw new Error(getResponseMessage(payload, t("saveFailed")));
      }
      applyReturnedSettings(payload.settings);
      onStatus(clearApiKey ? t("keyDeleted") : t("settingsSaved"));
      setStatus(clearApiKey ? t("keyDeletedStatus") : t("settingsSavedStatus"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("saveFailed");
      setStatus(message);
      onStatus(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    setStatus(t("testingConnection"));
    try {
      const response = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSettingsPayload(false)),
      });
      const payload = (await response.json()) as SettingsResponse | ErrorResponse;
      if (!response.ok) {
        throw new Error(getResponseMessage(payload, t("testFailed")));
      }
      if (!("settings" in payload)) {
        throw new Error(getResponseMessage(payload, t("testFailed")));
      }
      applyReturnedSettings(payload.settings);
      const message = payload.result?.message ?? t("testComplete");
      setStatus(message);
      onStatus(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("testFailed");
      setStatus(message);
      onStatus(message);
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Card className="max-w-6xl rounded-lg">
      <CardContent className="flex flex-col gap-5 px-4 py-4 sm:px-5">
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-semibold">{t("title")}</h3>
          </div>

          <form id="ai-settings-form" onSubmit={handleSave} className="flex flex-col gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Provider" htmlFor="ai-provider">
                <Select value={providerId} onValueChange={(value) => value && handleProviderChange(value)}>
                  <SelectTrigger id="ai-provider" className="w-full">
                    <SelectValue placeholder={t("providerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    align="start"
                    alignItemWithTrigger={false}
                    collisionAvoidance={{ side: "none", align: "shift" }}
                    className="max-h-80"
                  >
                    {groupedProviders.map((group) => (
                      <SelectGroup key={group.id}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.providers.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={t("model")} htmlFor="ai-model-select">
                <Select value={selectedModelValue} onValueChange={(value) => value && handleModelSelect(value)}>
                  <SelectTrigger id="ai-model-select" className="w-full">
                    <SelectValue placeholder={t("modelPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    align="start"
                    alignItemWithTrigger={false}
                    collisionAvoidance={{ side: "none", align: "shift" }}
                    className="max-h-80"
                  >
                    <SelectItem value={CUSTOM_MODEL_VALUE}>{t("customModel")}</SelectItem>
                    {provider.models.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customModel && (
                  <Input
                    id="ai-model-custom"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder={t("customModelPlaceholder")}
                    className="mt-2"
                    required
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Base URL" htmlFor="ai-base-url">
                <Input
                  id="ai-base-url"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  disabled={!canEditBaseUrl}
                  placeholder="https://api.example.com/v1"
                  required
                />
              </Field>

              <Field label={requiresKey ? t("apiKey") : t("apiKeyOptional")} htmlFor="ai-api-key">
                <Input
                  id="ai-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={saved.hasApiKey ? t("apiKeySavedPlaceholder") : t("apiKeyPlaceholder")}
                  autoComplete="off"
                />
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-line bg-surface-low px-4 py-3">
                <Label htmlFor="ai-enabled" className="text-sm font-medium">
                  {t("enable")}
                </Label>
                <Switch id="ai-enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <Field label="Temperature" htmlFor="ai-temperature">
                <Input
                  id="ai-temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                />
              </Field>
            </div>
          </form>
        </section>

        {status ? <p className="rounded-lg bg-surface-low px-4 py-3 text-sm leading-6 text-muted-foreground">{status}</p> : null}

        <Separator />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label={t("runtime")} value={t("runtimeLocal")} />
          <InfoTile label={t("dataLocation")} value="SQLite" />
          <InfoTile label={t("keyStorage")} value={apiKeyStatus} />
          <InfoTile label={t("testStatus")} value={t(`status.${saved.aiLastTestStatus}`)} />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-muted-foreground">{apiKeyStatus}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => saveSettings({ clearApiKey: true })} disabled={isSaving || isTesting || !saved.hasApiKey}>
            <Trash2 className="h-4 w-4" />
            {t("deleteKey")}
          </Button>
          <Button type="button" variant="outline" onClick={handleTest} disabled={isSaving || isTesting}>
            <PlugZap className="h-4 w-4" />
            {isTesting ? t("testing") : t("test")}
          </Button>
          <Button type="submit" form="ai-settings-form" disabled={isSaving || isTesting}>
            <KeyRound className="h-4 w-4" />
            {isSaving ? t("saving") : t("save")}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function getResponseMessage(payload: SettingsResponse | ErrorResponse, fallback: string) {
  return "message" in payload && payload.message ? payload.message : fallback;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-low p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
