import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());
describe("desktop HTTP boundary", () => {
  const origin = "http://127.0.0.1:43187";
  function request(path: string, headers: Record<string, string> = {}) {
    return new NextRequest(origin + path, { headers: { host: "127.0.0.1:43187", ...headers } });
  }
  it("leaves normal web hosting unchanged", () => {
    vi.stubEnv("LUJIE_DESKTOP_SESSION", "");
    expect(proxy(request("/api/settings/ai")).headers.get("x-middleware-next")).toBe("1");
  });
  it("requires a session even for API reads and static routes", () => {
    vi.stubEnv("LUJIE_DESKTOP_SESSION", "test-session");
    vi.stubEnv("PORT", "43187");
    for (const path of ["/dashboard", "/api/settings/ai", "/_next/static/file.js", "/_desktop/health"]) {
      expect(proxy(request(path)).status).toBe(401);
    }
    const session = proxy(request("/_desktop/session?token=test-session"));
    expect(session.headers.get("location")).toBe(origin + "/dashboard");
    expect(session.headers.get("set-cookie")).toContain("HttpOnly");
    expect(session.headers.get("set-cookie")).toContain("SameSite=strict");
    const cookie = "lujie-desktop-session=test-session";
    expect(proxy(request("/_desktop/health", { cookie })).status).toBe(200);
    expect(proxy(request("/api/settings/ai", { cookie })).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(request("/api/settings/ai", { cookie: "lujie-desktop-session=old-session" })).status).toBe(401);
    const forbiddenHeaders: Record<string, string>[] = [{ origin: "https://example.com" }, { host: "example.com:43187" }, { "sec-fetch-site": "cross-site" }];
    for (const headers of forbiddenHeaders) {
      expect(proxy(request("/api/settings/ai", { cookie, ...headers })).status).toBe(403);
    }
  });
});
