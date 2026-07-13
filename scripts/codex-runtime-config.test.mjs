import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ensureDockerRuntimeSecrets,
  ensureLocalAppEnvironment,
  ensureLocalCodexEnvironment,
} from "./codex-runtime-config.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Codex runtime configuration", () => {
  it("generates a protected local app secret automatically", async () => {
    const root = await createProjectFixture();
    const environment = await ensureLocalAppEnvironment(root, {});
    const envPath = join(root, ".env.local");

    expect(environment.LUJIE_SETTINGS_SECRET).toHaveLength(64);
    expect(await readFile(envPath, "utf8")).toContain(
      `LUJIE_SETTINGS_SECRET=${environment.LUJIE_SETTINGS_SECRET}`,
    );
    expect((await stat(envPath)).mode & 0o777).toBe(0o600);
  });

  it("reuses the app secret and adds a protected Bridge token", async () => {
    const root = await createProjectFixture();
    const appEnvironment = await ensureLocalAppEnvironment(root, {});
    const codexEnvironment = await ensureLocalCodexEnvironment(root, {});

    expect(codexEnvironment.LUJIE_SETTINGS_SECRET).toBe(appEnvironment.LUJIE_SETTINGS_SECRET);
    expect(codexEnvironment.CODEX_BRIDGE_TOKEN).toHaveLength(64);
    expect(codexEnvironment.CODEX_BRIDGE_URL).toBe("http://127.0.0.1:4318");
    expect((await stat(join(root, ".env.codex"))).mode & 0o777).toBe(0o600);
  });

  it("returns one persistent secret set during concurrent Docker startup", async () => {
    const root = await createProjectFixture();
    const runtimeDirectory = join(root, "runtime");
    await mkdir(runtimeDirectory);

    const [first, second] = await Promise.all([
      ensureDockerRuntimeSecrets(runtimeDirectory),
      ensureDockerRuntimeSecrets(runtimeDirectory),
    ]);

    expect(first).toEqual(second);
    expect(first.LUJIE_SETTINGS_SECRET).toHaveLength(64);
    expect(first.CODEX_BRIDGE_TOKEN).toHaveLength(64);
    expect((await stat(join(runtimeDirectory, "runtime-secrets.json"))).mode & 0o777).toBe(0o600);
  });
});

async function createProjectFixture() {
  const root = await mkdtemp(join(tmpdir(), "lujie-runtime-config-"));
  temporaryDirectories.push(root);
  await writeFile(
    join(root, ".env.example"),
    'DATABASE_URL="file:./dev.db"\nLUJIE_SETTINGS_SECRET="change-me-to-a-long-random-string"\n',
  );
  await writeFile(
    join(root, ".env.codex.example"),
    "DATABASE_URL=file:./dev.db\nCODEX_BRIDGE_URL=http://127.0.0.1:4318\n",
  );
  return root;
}
