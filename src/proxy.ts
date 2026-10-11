import { NextRequest, NextResponse } from "next/server";

// The browser/Docker app has no desktop session. Only the bundled sidecar enables this boundary.
export function proxy(request: NextRequest) {
  const token = process.env.LUJIE_DESKTOP_SESSION;
  if (!token) return NextResponse.next();

  const origin = `http://127.0.0.1:${process.env.PORT}`;
  const requestOrigin = request.headers.get("origin");
  if (request.headers.get("host") !== new URL(origin).host ||
      (requestOrigin && requestOrigin !== origin) ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (request.nextUrl.pathname === "/_desktop/session" &&
      request.nextUrl.searchParams.get("token") === token && request.method === "GET") {
    const response = NextResponse.redirect(new URL("/dashboard", origin));
    response.cookies.set("lujie-desktop-session", token, { httpOnly: true, sameSite: "strict", path: "/" });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  if (request.cookies.get("lujie-desktop-session")?.value !== token) {
    return new NextResponse("Open LuJie CareerKit from its desktop window.", {
      status: 401, headers: { "Cache-Control": "no-store" },
    });
  }
  if (request.nextUrl.pathname === "/_desktop/health") {
    return NextResponse.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.next();
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
