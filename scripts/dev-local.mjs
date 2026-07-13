import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureLocalAppEnvironment } from "./codex-runtime-config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const environment = await ensureLocalAppEnvironment(ROOT);
const child = spawn(process.execPath, [nextBin, "dev", "--webpack"], {
  cwd: ROOT,
  env: environment,
  stdio: "inherit",
});

forwardSignals(child);
child.once("error", (error) => {
  console.error(`CareerKit failed to start: ${error.message}`);
  process.exit(1);
});
child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

function forwardSignals(target) {
  process.on("SIGINT", () => target.kill("SIGINT"));
  process.on("SIGTERM", () => target.kill("SIGTERM"));
}
