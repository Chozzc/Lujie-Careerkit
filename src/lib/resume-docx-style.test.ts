import { describe, expect, it } from "vitest";

import { buildDocxThemeConfig } from "./resume-docx-style";

describe("resume docx style mapping", () => {
  it("maps preview theme settings into Word units", () => {
    const config = buildDocxThemeConfig({
      primaryColor: "#172554",
      accentColor: "#2563eb",
      fontFamily: "'Noto Sans SC'",
      fontSize: "large",
      lineSpacing: 1.6,
      margin: { top: 24, right: 32, bottom: 28, left: 36 },
      sectionSpacing: 18,
      avatarStyle: "oneInch",
    });

    expect(config.primaryColor).toBe("172554");
    expect(config.accentColor).toBe("2563EB");
    expect(config.font).toBe("Noto Sans SC");
    expect(config.sizes.body).toBe(24);
    expect(config.sizes.h1).toBe(45);
    expect(config.lineTwips).toBe(384);
    expect(config.marginTwips).toEqual({ top: 360, right: 480, bottom: 420, left: 540 });
    expect(config.sectionSpacingTwips).toBe(270);
  });

  it("uses conservative fallbacks for incomplete theme data", () => {
    const config = buildDocxThemeConfig({
      primaryColor: "bad",
      accentColor: undefined,
      fontFamily: "",
      fontSize: "unknown",
      lineSpacing: 0,
      margin: {},
      sectionSpacing: 0,
    });

    expect(config.primaryColor).toBe("111827");
    expect(config.accentColor).toBe("315F92");
    expect(config.font).toBe("Microsoft YaHei");
    expect(config.sizes.body).toBe(21);
    expect(config.lineTwips).toBe(360);
  });
});
