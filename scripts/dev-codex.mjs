import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ensureLocalCodexEnvironment } from "./codex-runtime-config.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const bridgeScript = resolve(ROOT, "scripts/codex-bridge.mjs");
const childEnvironment = await ensureLocalCodexEnvironment(ROOT);
const bridgeOnly = process.argv.includes("--bridge-only");

if (process.argv.includes("--check")) {
  console.log("Local Codex development configuration is valid.");
  process.exit(0);
}

const children = new Set();
let shuttingDown = false;
let exitCode = 0;

if (!bridgeOnly) {
  console.log("Starting CareerKit and Codex Bridge for local development...");
  console.log("Press Ctrl+C once to stop both processes.");
}

start("Codex Bridge", bridgeScript, []);
if (!bridgeOnly) start("CareerKit", nextBin, ["dev", "--webpack"]);

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

function start(label, script, args) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: ROOT,
    env: childEnvironment,
    stdio: "inherit",
  });

  children.add(child);
  child.once("error", (error) => {
    console.error(`${label} failed to start: ${error.message}`);
    exitCode = 1;
    shutdown("SIGTERM");
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      exitCode = code ?? (signal ? 1 : 0);
      if (!bridgeOnly) {
        console.error(`${label} stopped${signal ? ` (${signal})` : ` with exit code ${exitCode}`}.`);
      }
      shutdown("SIGTERM");
      return;
    }
    finishWhenStopped();
  });
}

function shutdown(signal) {
  if (!shuttingDown) {
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) child.kill(signal);
    }
  }
  finishWhenStopped();
}

function finishWhenStopped() {
  if (!shuttingDown || children.size > 0) return;
  process.exit(exitCode);
}
