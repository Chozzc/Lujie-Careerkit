import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDockerRuntimeSecrets } from "./codex-runtime-config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "app";
const runtimeDirectory = process.env.LUJIE_RUNTIME_CONFIG_DIR?.trim() || "/runtime-config";
const secrets = await ensureDockerRuntimeSecrets(runtimeDirectory);
const environment = { ...process.env, ...secrets };
const require = createRequire(import.meta.url);

let command;
if (mode === "app") {
  command = [require.resolve("next/dist/bin/next"), "start", "-H", "0.0.0.0"];
} else if (mode === "bridge") {
  command = [resolve(ROOT, "scripts/codex-bridge.mjs")];
} else {
  console.error(`Unknown Docker runtime mode: ${mode}`);
  process.exit(1);
}

const child = spawn(process.execPath, command, {
  cwd: ROOT,
  env: environment,
  stdio: "inherit",
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.once("error", (error) => {
  console.error(`Docker ${mode} runtime failed to start: ${error.message}`);
  process.exit(1);
});
child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
