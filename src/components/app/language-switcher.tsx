"use client";

import { useLocale, useTranslations } from "next-intl";

import { locales, localeCookieName, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("app.language");

  function changeLocale(nextLocale: Locale) {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
      {!compact && <span>{t("label")}</span>}
      <select
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-foreground outline-none hover:bg-surface-low"
        aria-label={t("label")}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {t(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
