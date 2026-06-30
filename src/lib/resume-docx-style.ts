import type { ThemeConfig } from "@/types/resume";

const FALLBACK_FONT = "Microsoft YaHei";
const FALLBACK_PRIMARY = "111827";
const FALLBACK_ACCENT = "315F92";
const DEFAULT_LINE_SPACING = 1.5;
const DEFAULT_MARGIN = { top: 20, right: 24, bottom: 20, left: 24 };

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
  const fontSize = FONT_SIZE_PX[theme.fontSize ?? "medium"] ?? FONT_SIZE_PX.medium;
  const margin = { ...DEFAULT_MARGIN, ...(theme.margin ?? {}) };
  const lineSpacing =
    typeof theme.lineSpacing === "number" && theme.lineSpacing > 0 ? theme.lineSpacing : DEFAULT_LINE_SPACING;

  return {
    font: normalizeDocxFont(theme.fontFamily),
    primaryColor: toDocxColor(theme.primaryColor, FALLBACK_PRIMARY),
    accentColor: toDocxColor(theme.accentColor, FALLBACK_ACCENT),
    sizes: {
      body: pxToHalfPoints(fontSize.body),
      h1: pxToHalfPoints(fontSize.h1),
      h2: pxToHalfPoints(fontSize.h2),
      h3: pxToHalfPoints(fontSize.h3),
      meta: Math.max(18, pxToHalfPoints(fontSize.body) - 1),
    },
    lineTwips: Math.round(lineSpacing * 240),
    paragraphAfterTwips: 70,
    sectionSpacingTwips: pxToTwips(theme.sectionSpacing || 16),
    marginTwips: {
      top: pxToTwips(margin.top),
      right: pxToTwips(margin.right),
      bottom: pxToTwips(margin.bottom),
      left: pxToTwips(margin.left),
    },
  };
}

function normalizeDocxFont(value: string | undefined) {
  const font = value?.replace(/['"]/g, "").trim();
  if (!font || font === "Inter" || font === "system-ui") return FALLBACK_FONT;
  return font;
}

function toDocxColor(value: string | undefined, fallback: string) {
  const normalized = value?.replace("#", "").trim();
  return normalized && /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

function pxToHalfPoints(px: number) {
  return Math.round(px * 1.5);
}

function pxToTwips(px: number) {
  return Math.round(px * 15);
}
