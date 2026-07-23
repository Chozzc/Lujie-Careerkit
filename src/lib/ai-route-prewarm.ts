export const AI_ROUTE_WARMUP_PATHS = {
  jobCreate: "/api/jobs",
  match: "/api/ai/resume-tailor",
  optimize: "/api/ai/resume-optimize",
  applicationMessage: "/api/ai/application-message",
  interview: "/api/interviews",
} as const;

type Fetcher = (input: string, init: RequestInit) => Promise<unknown>;

export async function warmAiRoutes(paths: readonly string[], fetcher: Fetcher = fetch) {
  await Promise.all(
    paths.map(async (path) => {
      try {
        await fetcher(path, { method: "GET", cache: "no-store" });
      } catch {
        // Warm-up is best-effort; the real action still reports actionable errors.
      }
    }),
  );
}
