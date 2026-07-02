"use client";

import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThemeConfig } from "@/types/resume";

const themeColorPresets = [
  { primaryColor: "#111827", accentColor: "#315f92", labelKey: "presets.deep" },
  { primaryColor: "#1f2937", accentColor: "#64748b", labelKey: "presets.gray" },
  { primaryColor: "#172554", accentColor: "#2563eb", labelKey: "presets.blue" },
  { primaryColor: "#27272a", accentColor: "#a16207", labelKey: "presets.gold" },
];

export function ResumeThemePanel({
  theme,
  defaultMargin,
  onChange,
  onReset,
  onClose,
}: {
  theme: ThemeConfig;
  defaultMargin: ThemeConfig["margin"];
  onChange: (themeConfig: Partial<ThemeConfig>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("resumeWorkbench.themePanel");
  const margin = theme.margin ?? defaultMargin;

  return (
    <aside className="fixed bottom-0 right-0 top-12 z-40 flex w-80 shrink-0 flex-col border-l border-line bg-surface p-4 shadow-2xl xl:static xl:shadow-none">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">{t("title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title={t("close")}>
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <section>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("recommendedColors")}</p>
          <div className="grid grid-cols-2 gap-2">
            {themeColorPresets.map((preset) => {
              const active =
                theme.primaryColor === preset.primaryColor && theme.accentColor === preset.accentColor;
              return (
                <button
                  key={preset.labelKey}
                  type="button"
                  onClick={() =>
                    onChange({
                      primaryColor: preset.primaryColor,
                      accentColor: preset.accentColor,
                    })
                  }
                  className={cn(
                    "flex items-center justify-between rounded-lg border border-line bg-surface-low px-3 py-2 text-xs",
                    active && "border-primary text-primary",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex overflow-hidden rounded-full border border-line">
                      <span className="h-4 w-4" style={{ backgroundColor: preset.primaryColor }} />
                      <span className="h-4 w-4" style={{ backgroundColor: preset.accentColor }} />
                    </span>
                    {t(preset.labelKey)}
                  </span>
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <ColorField
            label={t("primaryColor")}
            value={theme.primaryColor}
            onChange={(value) => onChange({ primaryColor: value })}
          />
          <ColorField
            label={t("accentColor")}
            value={theme.accentColor}
            onChange={(value) => onChange({ accentColor: value })}
          />
        </section>

        <ThemeField label={t("font")}>
          <select
            value={theme.fontFamily}
            onChange={(event) => onChange({ fontFamily: event.target.value })}
            className="w-full rounded-lg border border-line bg-surface-low px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="Inter">Inter</option>
            <option value="'Noto Sans SC'">Noto Sans SC</option>
            <option value="system-ui">System UI</option>
            <option value="Georgia">Georgia</option>
            <option value="Arial">Arial</option>
          </select>
        </ThemeField>

        <ThemeField label={t("fontSize")}>
          <div className="grid grid-cols-3 gap-2">
            {(["small", "medium", "large"] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ fontSize: size })}
                className={cn(
                  "rounded-lg border border-line px-3 py-2 text-xs",
                  theme.fontSize === size ? "bg-primary text-white" : "bg-surface-low text-muted-foreground",
                )}
              >
                {t(`fontSizes.${size}`)}
              </button>
            ))}
          </div>
        </ThemeField>

        <RangeField
          label={t("lineSpacing")}
          value={theme.lineSpacing}
          min={1.1}
          max={1.9}
          step={0.1}
          suffix="x"
          onChange={(value) => onChange({ lineSpacing: value })}
        />
        <RangeField
          label={t("sectionSpacing")}
          value={theme.sectionSpacing}
          min={8}
          max={32}
          step={1}
          suffix="px"
          onChange={(value) => onChange({ sectionSpacing: value })}
        />

        <section>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("margins")}</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["top", "margin.top"],
              ["right", "margin.right"],
              ["bottom", "margin.bottom"],
              ["left", "margin.left"],
            ] as const).map(([key, labelKey]) => (
              <label key={key} className="block text-xs text-muted-foreground">
                {t(labelKey)}
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={margin[key]}
                  onChange={(event) =>
                    onChange({
                      margin: {
                        ...margin,
                        [key]: Number(event.target.value),
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-line bg-surface-low px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
        </section>

        <ThemeField label={t("avatarStyle")}>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["oneInch", "avatar.oneInch"],
              ["circle", "avatar.circle"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ avatarStyle: value })}
                className={cn(
                  "rounded-lg border border-line px-3 py-2 text-xs",
                  theme.avatarStyle === value ? "bg-primary text-white" : "bg-surface-low text-muted-foreground",
                )}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </ThemeField>
      </div>

      <Button variant="outline" onClick={onReset} className="mt-4">
        {t("reset")}
      </Button>
    </aside>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <ThemeField label={label}>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-low px-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-6 w-8" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>
    </ThemeField>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <ThemeField label={`${label} ${value}${suffix}`}>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </ThemeField>
  );
}

function ThemeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
