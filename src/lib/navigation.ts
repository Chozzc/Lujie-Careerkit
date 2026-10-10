export type NavKey = "dashboard" | "campus" | "resume" | "match" | "pipeline" | "interview" | "library" | "settings";

const NAV_PATHS: Record<NavKey, string> = {
  dashboard: "/dashboard",
  campus: "/campus",
  resume: "/resume",
  match: "/match",
  pipeline: "/pipeline",
  interview: "/interview",
  library: "/library",
  settings: "/settings",
};

const PATH_NAV_KEYS = new Map(Object.entries(NAV_PATHS).map(([key, path]) => [path, key as NavKey]));

export function pathnameForNavKey(key: NavKey) {
  return NAV_PATHS[key];
}

export function navKeyFromPathname(pathname: string): NavKey | null {
  const normalized = normalizePathname(pathname);
  if (normalized.startsWith("/resume/")) return "resume";
  if (normalized.startsWith("/library/")) return "library";
  return PATH_NAV_KEYS.get(normalized) ?? null;
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}
