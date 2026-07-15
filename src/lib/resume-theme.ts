import type { ThemeConfig } from "@/types/resume";

export const DEFAULT_RESUME_THEME: ThemeConfig = {
  primaryColor: "#1a1a2e",
  accentColor: "#e94560",
  fontFamily: "Inter",
  fontSize: "medium",
  logoSize: "medium",
  lineSpacing: 1.5,
  margin: { top: 20, right: 24, bottom: 20, left: 24 },
  sectionSpacing: 16,
  avatarStyle: "oneInch",
};

export type ResumeThemeInput = Omit<Partial<ThemeConfig>, "margin"> & {
  margin?: Partial<ThemeConfig["margin"]>;
};

const ALLOWED_FONTS = new Set(["Inter", "'Noto Sans SC'", "system-ui", "Georgia", "Arial"]);
const ALLOWED_SIZES = new Set(["small", "medium", "large"]);

export function normalizeResumeTheme(input: ResumeThemeInput = {}): ThemeConfig {
  const margin = input.margin ?? {};
  return {
    primaryColor: normalizeColor(input.primaryColor, DEFAULT_RESUME_THEME.primaryColor),
    accentColor: normalizeColor(input.accentColor, DEFAULT_RESUME_THEME.accentColor),
    fontFamily: ALLOWED_FONTS.has(input.fontFamily ?? "")
      ? input.fontFamily!
      : DEFAULT_RESUME_THEME.fontFamily,
    fontSize: ALLOWED_SIZES.has(input.fontSize ?? "") ? input.fontSize! : DEFAULT_RESUME_THEME.fontSize,
    logoSize: ALLOWED_SIZES.has(input.logoSize ?? "")
      ? input.logoSize
      : DEFAULT_RESUME_THEME.logoSize,
    lineSpacing: boundedNumber(input.lineSpacing, 1.1, 1.9, DEFAULT_RESUME_THEME.lineSpacing),
    margin: {
      top: boundedNumber(margin.top, 0, 48, DEFAULT_RESUME_THEME.margin.top),
      right: boundedNumber(margin.right, 0, 48, DEFAULT_RESUME_THEME.margin.right),
      bottom: boundedNumber(margin.bottom, 0, 48, DEFAULT_RESUME_THEME.margin.bottom),
      left: boundedNumber(margin.left, 0, 48, DEFAULT_RESUME_THEME.margin.left),
    },
    sectionSpacing: boundedNumber(input.sectionSpacing, 8, 32, DEFAULT_RESUME_THEME.sectionSpacing),
    avatarStyle: input.avatarStyle === "circle" || input.avatarStyle === "oneInch"
      ? input.avatarStyle
      : DEFAULT_RESUME_THEME.avatarStyle,
  };
}

function normalizeColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function boundedNumber(value: number | undefined, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
