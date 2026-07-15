import { describe, expect, it } from "vitest";

import { DEFAULT_RESUME_THEME, normalizeResumeTheme } from "./resume-theme";

describe("resume theme normalization", () => {
  it("keeps supported editor values", () => {
    expect(normalizeResumeTheme({
      primaryColor: "#172554",
      accentColor: "#2563eb",
      fontFamily: "'Noto Sans SC'",
      fontSize: "large",
      logoSize: "small",
      lineSpacing: 1.6,
      margin: { top: 24, right: 32, bottom: 28, left: 36 },
      sectionSpacing: 18,
      avatarStyle: "circle",
    })).toEqual({
      primaryColor: "#172554",
      accentColor: "#2563eb",
      fontFamily: "'Noto Sans SC'",
      fontSize: "large",
      logoSize: "small",
      lineSpacing: 1.6,
      margin: { top: 24, right: 32, bottom: 28, left: 36 },
      sectionSpacing: 18,
      avatarStyle: "circle",
    });
  });

  it("blocks CSS injection and bounds imported numeric settings", () => {
    expect(normalizeResumeTheme({
      primaryColor: "red;display:none",
      accentColor: "#12345g",
      fontFamily: "Inter;}</style><script>alert(1)</script>",
      fontSize: "huge",
      lineSpacing: Number.POSITIVE_INFINITY,
      margin: { top: -10, right: 999 },
      sectionSpacing: 100,
    })).toEqual({
      ...DEFAULT_RESUME_THEME,
      margin: { ...DEFAULT_RESUME_THEME.margin, top: 0, right: 48 },
      sectionSpacing: 32,
    });
  });
});
