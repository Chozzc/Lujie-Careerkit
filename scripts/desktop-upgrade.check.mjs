import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

const [phase, backend, profile] = process.argv.slice(2);
assert.ok(["seed", "verify"].includes(phase) && path.isAbsolute(backend) && path.isAbsolute(profile));
const marker = path.join(profile, "synthetic-upgrade-check.json");
const key = path.join(profile, "settings.key");
const db = path.join(profile, "careerkit.db");
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
if (phase === "seed") {
  assert.equal(existsSync(profile), false, "Seed must use a new synthetic profile");
  mkdirSync(profile, { recursive: true });
} else {
  assert.ok(existsSync(marker), "Refusing to open a profile without the synthetic upgrade marker");
  const expected = JSON.parse(readFileSync(marker, "utf8"));
  assert.equal(expected.key, hash(key), "Upgrade changed the synthetic settings key");
  assert.equal(expected.db, hash(db), "Upgrade changed the synthetic database before startup");
}

const origin = "http://127.0.0.1:43229";
const env = { ...process.env, LUJIE_DESKTOP_DATA_DIR: profile, PORT: "43229" };
for (const name of ["NODE_OPTIONS", "NODE_PATH", "OPENAI_API_KEY", "DEEPSEEK_API_KEY", "DATABASE_URL", "LUJIE_SETTINGS_SECRET"]) delete env[name];
const child = spawn(path.join(backend, "node.exe"), [path.join(backend, "desktop-runtime.mjs")], {
  cwd: backend, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
});
const lines = createInterface({ input: child.stdout });
let phaseError;
try {
  const ready = new Promise((resolve, reject) => {
    lines.on("line", (line) => { if (line.startsWith("LUJIE_READY ")) resolve(line.slice(12)); });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Synthetic backend exited before readiness: ${code}`)));
  });
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Synthetic backend startup timed out")), 45_000); });
  child.stdin.write("start\n");
  const url = await Promise.race([ready, timeout]).finally(() => clearTimeout(timer));
  assert.equal(new URL(url).origin, origin);
  const handshake = await fetch(url, { redirect: "manual" });
  assert.equal(handshake.status, 307);
  const cookie = handshake.headers.get("set-cookie").split(";")[0];
  async function api(route, method = "GET", body) {
    const response = await fetch(origin + route, {
      method, headers: { cookie, origin, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
    assert.equal(response.status, 200, route);
    return response.json();
  }
  if (phase === "seed") {
    const { thread } = await api("/api/agent/threads", "POST", { title: "Synthetic NSIS upgrade proof" });
    assert.ok(thread.id);
    await api("/api/settings/ai", "PATCH", { aiProvider: "openai", aiApiKey: "sk-synthetic-upgrade-not-a-real-key" });
  }
  const { threads } = await api("/api/agent/threads");
  assert.ok(threads.some((item) => item.title === "Synthetic NSIS upgrade proof"));
  const { settings } = await api("/api/settings/ai");
  assert.equal(settings.hasApiKey, true);
  assert.equal(settings.apiKeyPreview, "sk-s...-key");
} catch (error) {
  phaseError = error;
} finally {
  lines.close();
  if (child.exitCode === null) {
    const exited = once(child, "exit");
    const timer = setTimeout(() => child.kill(), 7000);
    child.stdin.end();
    try {
      const [code] = await exited;
      if (!phaseError) assert.equal(code, 0, "Synthetic backend failed to stop");
    } finally { clearTimeout(timer); }
  }
}
if (phaseError) throw phaseError;
if (phase === "seed") writeFileSync(marker, JSON.stringify({ key: hash(key), db: hash(db) }));
console.log(`PASS: ${phase} synthetic SQLite history and encrypted provider settings.`);
