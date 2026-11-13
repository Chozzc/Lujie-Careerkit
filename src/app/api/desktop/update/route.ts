import { z } from "zod";

const repository = "Chozzc/Lujie-Careerkit";
const stableVersion = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const platformPackages: Record<string, string[]> = {
  "win32-x64": ["x64-setup.exe"],
  "darwin-arm64": ["aarch64.dmg"],
  "darwin-x64": ["x64.dmg"],
  "linux-x64": ["amd64.deb", "amd64.AppImage"],
};
const releaseSchema = z.object({
  tag_name: z.string(),
  draft: z.literal(false),
  prerelease: z.literal(false),
  assets: z.array(z.object({ name: z.string() })),
});
const headers = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.LUJIE_DESKTOP_SESSION) return new Response(null, { status: 404, headers });

  const current = process.env.LUJIE_DESKTOP_VERSION?.match(stableVersion);
  const packageSuffixes = platformPackages[`${process.platform}-${process.arch}`];
  const noUpdate = () => new Response(null, { status: 204, headers });
  if (!current || !packageSuffixes) return noUpdate();

  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "LuJie-CareerKit-Desktop" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return noUpdate();

    const release = releaseSchema.safeParse(await response.json());
    if (!release.success) return noUpdate();
    const { tag_name: tag, assets } = release.data;
    const latest = tag.replace(/^v/, "").match(stableVersion);
    if (!latest) return noUpdate();

    const difference = latest.slice(1).map((part, index) => Number(part) - Number(current[index + 1]));
    if ((difference.find((part) => part !== 0) ?? 0) <= 0) return noUpdate();

    const version = latest[0];
    const packageName = /^LuJie[ ._-]+CareerKit(?:[ ._-]+Preview)?[ ._-]+(\d+\.\d+\.\d+)[ ._-]+(.+)$/i;
    if (!assets.some(({ name }) => {
      const match = name.match(packageName);
      return match?.[1] === version && packageSuffixes.includes(match[2]);
    })) return noUpdate();

    return Response.json({ version, url: `https://github.com/${repository}/releases/tag/${tag}` }, { headers });
  } catch {
    return noUpdate();
  }
}
