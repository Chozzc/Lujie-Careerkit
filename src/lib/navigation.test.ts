import { describe, expect, it } from "vitest";

import { navKeyFromPathname, pathnameForNavKey } from "./navigation";

describe("workspace navigation paths", () => {
  it("maps product views to stable top-level routes", () => {
    expect(pathnameForNavKey("dashboard")).toBe("/");
    expect(pathnameForNavKey("resume")).toBe("/resume");
    expect(pathnameForNavKey("match")).toBe("/match");
    expect(pathnameForNavKey("pipeline")).toBe("/pipeline");
    expect(pathnameForNavKey("interview")).toBe("/interview");
    expect(pathnameForNavKey("settings")).toBe("/settings");
  });

  it("derives the visible workspace view from the current route", () => {
    expect(navKeyFromPathname("/")).toBe("dashboard");
    expect(navKeyFromPathname("/resume")).toBe("resume");
    expect(navKeyFromPathname("/resume/edit")).toBe("resume");
    expect(navKeyFromPathname("/match")).toBe("match");
    expect(navKeyFromPathname("/pipeline")).toBe("pipeline");
    expect(navKeyFromPathname("/interview")).toBe("interview");
    expect(navKeyFromPathname("/settings")).toBe("settings");
    expect(navKeyFromPathname("/something-else")).toBe("dashboard");
  });
});
