import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const suffixes: Record<string, string> = {
  "win32-x64": "x64-setup.exe",
  "darwin-arm64": "aarch64.dmg",
  "darwin-x64": "x64.dmg",
  "linux-x64": "amd64.AppImage",
};
const suffix = suffixes[`${process.platform}-${process.arch}`];

function release(tag = "v0.10.0", name = `LuJie CareerKit Preview_0.10.0_${suffix}`) {
  return { tag_name: tag, draft: false, prerelease: false, assets: [{ name }] };
}

beforeEach(() => {
  vi.stubEnv("LUJIE_DESKTOP_SESSION", "desktop-test");
  vi.stubEnv("LUJIE_DESKTOP_VERSION", "0.9.9");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.skipIf(!suffix).each([
  `LuJie CareerKit Preview_0.10.0_${suffix}`,
  `LuJie.CareerKit.Preview_0.10.0_${suffix}`,
  `LuJie-CareerKit_0.10.0_${suffix}`,
])("reports the newer release with %s", async (name) => {
  const fetchMock = vi.fn(async () => Response.json(release("v0.10.0", name)));
  vi.stubGlobal("fetch", fetchMock);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    version: "0.10.0",
    url: "https://github.com/Chozzc/Lujie-Careerkit/releases/tag/v0.10.0",
  });
  expect(fetchMock).toHaveBeenCalledOnce();
});

it.each([
  release("v0.9.9", `LuJie CareerKit_0.9.9_${suffix}`),
  release("v0.8.99", `LuJie CareerKit_0.8.99_${suffix}`),
  release("v0.10.0", "README.md"),
  release("v0.10.0", `OtherApp_0.10.0_${suffix}`),
  release("v0.10.0", `LuJie CareerKit Preview_0.9.9_${suffix}`),
  release("v0.10.0", "LuJie CareerKit_0.10.0_arm64-setup.exe"),
  { ...release(), prerelease: true },
  { ...release(), draft: true },
  release("../../invalid"),
])("ignores an ineligible release ($tag_name)", async (data) => {
  vi.stubGlobal("fetch", async () => Response.json(data));
  expect((await GET()).status).toBe(204);
});

it("fails quietly when GitHub is unavailable", async () => {
  vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
  expect((await GET()).status).toBe(204);
});

it("keeps web hosting from checking GitHub", async () => {
  vi.stubEnv("LUJIE_DESKTOP_SESSION", "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  expect((await GET()).status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});
