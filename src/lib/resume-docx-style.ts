import type { ThemeConfig } from "@/types/resume";
import { normalizeResumeTheme } from "./resume-theme";

const FALLBACK_FONT = "Microsoft YaHei";

const FONT_SIZE_PX: Record<string, { body: number; h1: number; h2: number; h3: number }> = {
  small: { body: 12, h1: 22, h2: 15, h3: 13 },
  medium: { body: 14, h1: 26, h2: 17, h3: 15 },
  large: { body: 16, h1: 30, h2: 19, h3: 17 },
};

export type DocxThemeConfig = ReturnType<typeof buildDocxThemeConfig>;
type DocxThemeInput = Omit<Partial<ThemeConfig>, "margin"> & {
  margin?: Partial<ThemeConfig["margin"]>;
};

export function buildDocxThemeConfig(theme: DocxThemeInput = {}) {
  const normalized = normalizeResumeTheme(theme);
  const fontSize = FONT_SIZE_PX[normalized.fontSize];

  return {
    font: normalizeDocxFont(normalized.fontFamily),
    primaryColor: toDocxColor(normalized.primaryColor),
    accentColor: toDocxColor(normalized.accentColor),
    sizes: {
      body: pxToHalfPoints(fontSize.body),
      h1: pxToHalfPoints(fontSize.h1),
      h2: pxToHalfPoints(fontSize.h2),
      h3: pxToHalfPoints(fontSize.h3),
      meta: Math.max(18, pxToHalfPoints(fontSize.body) - 1),
    },
    lineTwips: Math.round(normalized.lineSpacing * 240),
    paragraphAfterTwips: 70,
    sectionSpacingTwips: pxToTwips(normalized.sectionSpacing),
    marginTwips: {
      top: pxToTwips(normalized.margin.top),
      right: pxToTwips(normalized.margin.right),
      bottom: pxToTwips(normalized.margin.bottom),
      left: pxToTwips(normalized.margin.left),
    },
  };
}

function normalizeDocxFont(value: string | undefined) {
  const font = value?.replace(/['"]/g, "").trim();
  if (!font || font === "Inter" || font === "system-ui") return FALLBACK_FONT;
  return font;
}

function toDocxColor(value: string) {
  return value.slice(1).toUpperCase();
}

function pxToHalfPoints(px: number) {
  return Math.round(px * 1.5);
}

function pxToTwips(px: number) {
  return Math.round(px * 15);
}
