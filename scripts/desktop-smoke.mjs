import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createDecipheriv, createHash } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { createServer, get } from "node:http";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph } from "docx";
import { desktopTarget } from "./desktop-platform.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.resolve(process.argv[2] ?? path.join(root, "src-tauri", "backend"));
const data = mkdtempSync(path.join(os.tmpdir(), "lujie-桌面烟测-"));
const node = path.join(backend, desktopTarget().executable);
mkdirSync(path.join(data, "empty-path"));
const isolatedEnv = {
  ...process.env, LUJIE_DESKTOP_DATA_DIR: data, PORT: "43188", PATH: path.join(data, "empty-path"),
  HOME: data, USERPROFILE: data, LOCALAPPDATA: data, APPDATA: data,
  XDG_CACHE_HOME: data, XDG_CONFIG_HOME: data, XDG_DATA_HOME: data,
  PRISMA_ENGINES_MIRROR: "http://127.0.0.1:9",
};
delete isolatedEnv.NODE_OPTIONS;
delete isolatedEnv.NODE_PATH;
const origin = "http://127.0.0.1:43188";
let child;
let cookie;
let logs = "";
const children = [];
const providerRequests = [];
// Exercise the packaged HTTP/SDK/SSE path without paying a provider or sending any real data.
const provider = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  const input = JSON.parse(body);
  providerRequests.push({ path: request.url, authorization: request.headers.authorization, input });
  if (input.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    for (const [delta, finish_reason] of [[{ role: "assistant", content: "桌面流式响应测试" }, null], [{}, "stop"]]) {
      response.write(`data: ${JSON.stringify({ id: "test-stream", object: "chat.completion.chunk", created: 1, model: "desktop-test", choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
    }
    response.end("data: [DONE]\n\n");
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "test-connection", object: "chat.completion", created: 1, model: "desktop-test", choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  }
});

async function start() {
  logs = "";
  // A packaged app must find its own engines, without downloading or borrowing a developer cache.
  child = spawn(node, [path.join(backend, "desktop-runtime.mjs")], {
    cwd: backend, env: isolatedEnv, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
  });
  children.push(child);
  child.stderr.on("data", (chunk) => { logs += chunk; if (process.env.DEBUG) process.stderr.write(chunk); });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Desktop startup timed out.\n${logs}`)), 90_000);
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (line.startsWith("LUJIE_READY ")) { clearTimeout(timer); resolve(line.slice(12)); }
      else { logs += line + "\n"; if (process.env.DEBUG) console.log(line); }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Backend exited (${code}).\n${logs}`)); });
    child.stdin.write("start\n");
  });
  assert.equal(new URL(url).origin, origin);
  assert.equal((await fetch(origin + "/api/settings/ai")).status, 401);
  const response = await fetch(url, { redirect: "manual" });
  assert.equal(response.status, 307);
  cookie = response.headers.get("set-cookie").split(";")[0];
}

async function stop() {
  const exited = once(child, "exit");
  child.stdin.end();
  const [code] = await Promise.race([exited, new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error("Backend survived closing its parent pipe")), 5000);
    exited.finally(() => clearTimeout(timer));
  })]);
  assert.equal(code, 0);
}

async function json(route, body, method = "POST") {
  const response = await fetch(origin + route, {
    method, headers: { cookie, "content-type": "application/json", origin },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(response.status, 200, `${route}: ${await response.clone().text()}`);
  return response.json();
}

async function importFile(name, bytes) {
  const form = new FormData();
  form.set("file", new File([bytes], name));
  form.set("preferLocalFallback", "true");
  const response = await fetch(origin + "/api/ai/resume-import", { method: "POST", headers: { cookie, origin }, body: form });
  const parsed = await response.json();
  assert.equal(response.status, 200, JSON.stringify(parsed));
  assert.ok(parsed.characterCount > 20);
  return parsed.content;
}

try {
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const before = Date.now();
  // Windows image processing also needs libvips DLLs that Next's file tracing can miss.
  const imageCheck = spawn(node, ["-e", "require('sharp')({create:{width:2,height:2,channels:3,background:'#ffffff'}}).png().toBuffer().then(b=>{if(b.length<8)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})"], {
    cwd: backend, env: isolatedEnv, windowsHide: true, stdio: "pipe",
  });
  let imageError = "";
  imageCheck.stderr.on("data", (chunk) => { imageError += chunk; });
  assert.equal((await once(imageCheck, "exit"))[0], 0, imageError);
  await start();
  console.log(`Bundled backend ready in ${Date.now() - before} ms (no Node/npm on PATH).`);
  assert.equal((await fetch(origin + "/api/settings/ai", { headers: { cookie, origin: "https://example.com" } })).status, 403);
  // Node's fetch can replace Host; use a raw HTTP request for the DNS-rebinding check.
  assert.equal(await new Promise((resolve, reject) => {
    get(origin + "/api/settings/ai", { headers: { cookie, host: "attacker.example:43188" } }, (response) => {
      response.resume(); resolve(response.statusCode);
    }).on("error", reject);
  }), 403);
  const content = await importFile("resume.txt", "Desktop Smoke Test\nsoftware@example.invalid\nEducation\nExample University, Computer Science\nSkills\nTypeScript, React\n");
  const pdf = new jsPDF();
  pdf.text("Desktop PDF import smoke test. Example University, Software Engineering.", 10, 20);
  await importFile("resume.pdf", pdf.output("arraybuffer"));
  await importFile("resume.docx", await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("Desktop DOCX import smoke test. Example University, TypeScript.")] }] })));
  const { version } = await json("/api/resume-versions", { name: "桌面测试简历", content });
  await json(`/api/resume-versions/${version.id}`, { name: "桌面重启后保留", content }, "PATCH");
  const { job } = await json("/api/jobs", { company: "桌面测试公司", title: "测试岗位", jd: "A synthetic testing role. Not a real application." });
  const { application } = await json("/api/applications", { jobId: job.id, resumeVersionId: version.id, notes: "桌面持久化测试" });
  const { thread } = await json("/api/agent/threads", { title: "桌面对话持久化" });
  const fakeKey = "sk-synthetic-desktop-test-not-a-real-key";
  const connection = await json("/api/settings/ai/test", { aiProvider: "custom-openai-compatible", aiBaseUrl: `http://127.0.0.1:${provider.address().port}/v1`, aiModel: "desktop-test", aiApiKey: fakeKey });
  assert.equal(connection.result.source, "ai");
  assert.equal(connection.result.data.ok, true);
  const stream = await fetch(origin + "/api/agent/chat", {
    method: "POST", headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify({ id: thread.id, locale: "zh-CN", message: { id: "desktop-test-message", role: "user", parts: [{ type: "text", text: "你好，这是本地合成测试。" }] } }),
  });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type"), /text\/event-stream/);
  const streamed = await stream.text();
  assert.ok(streamed.includes("桌面流式响应测试"), streamed);
  assert.ok(!streamed.includes('"type":"error"'), streamed);
  assert.equal(providerRequests.length, 2);
  assert.ok(providerRequests.every((request) => request.path === "/v1/chat/completions" && request.authorization === `Bearer ${fakeKey}`));
  await json("/api/settings/ai", { aiProvider: "openai", aiApiKey: fakeKey }, "PATCH");
  for (const route of ["/dashboard", "/resume", "/pipeline", "/settings", "/library", "/campus", "/interview", "/match", "/brand/lujie-mark.svg", "/brand/lujie-agent.svg"]) {
    assert.equal((await fetch(origin + route, { headers: { cookie } })).status, 200, route);
  }
  const campus = await json("/api/campus", undefined, "GET");
  const expectedCatalog = JSON.parse(readFileSync(path.join(root, "data", "campus", "current.json"), "utf8"));
  const packagedCatalog = JSON.parse(readFileSync(path.join(backend, "data", "campus", "current.json"), "utf8"), (key, value) => {
    assert.notEqual(key, "sourceUrl", "Original source URLs must not be packaged.");
    return value;
  });
  assert.deepEqual(packagedCatalog, expectedCatalog);
  assert.ok(expectedCatalog.records.length > 0);
  assert.equal(campus.total, expectedCatalog.records.length);
  const record = expectedCatalog.records[0];
  const detail = await json("/api/campus?recordId=" + encodeURIComponent(record.id), undefined, "GET");
  assert.deepEqual(detail.selectedRecord, record);
  const search = await json("/api/campus?q=" + encodeURIComponent(record.company), undefined, "GET");
  assert.ok(search.total > 0);
  assert.ok(!JSON.stringify(detail).includes('"sourceUrl"'));
  const oldCookie = cookie;
  await stop();
  await assert.rejects(fetch(origin + "/_desktop/health"));
  const { PrismaClient } = createRequire(path.join(backend, "package.json"))("@prisma/client");
  const databaseUrl = `file:${path.join(data, "careerkit.db").replaceAll("\\", "/")}`;
  const prior = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  // Replay the existing conditional sample-date migration to exercise a real pending-upgrade startup.
  const replay = "20260926090000_refresh_sample_dates";
  try { await prior.$executeRawUnsafe("DELETE FROM _prisma_migrations WHERE migration_name = ?", replay); }
  finally { await prior.$disconnect(); }
  await start();
  assert.notEqual(cookie, oldCookie);
  assert.equal((await fetch(origin + "/api/settings/ai", { headers: { cookie: oldCookie } })).status, 401);
  const threads = await json("/api/agent/threads", undefined, "GET");
  assert.ok(threads.threads.some((item) => item.id === thread.id));
  const savedThread = await json(`/api/agent/threads/${thread.id}`, undefined, "GET");
  assert.ok(JSON.stringify(savedThread.thread.messages).includes("桌面流式响应测试"));
  const settings = await json("/api/settings/ai", undefined, "GET");
  assert.equal(settings.settings.hasApiKey, true);
  assert.equal(settings.settings.apiKeyPreview, "sk-s...-key");
  await stop();

  const backups = readdirSync(path.join(data, "backups"));
  assert.equal(backups.length, 1);
  const backup = path.join(data, "backups", backups[0]);
  assert.equal(readFileSync(path.join(backup, "settings.key"), "utf8"), readFileSync(path.join(data, "settings.key"), "utf8"));
  const snapshot = new PrismaClient({ datasources: { db: { url: `file:${path.join(backup, "careerkit.db").replaceAll("\\", "/")}` } } });
  try {
    assert.equal((await snapshot.resumeVersion.findUniqueOrThrow({ where: { id: version.id } })).name, "桌面重启后保留");
    assert.equal((await snapshot.$queryRawUnsafe("SELECT * FROM _prisma_migrations WHERE migration_name = ?", replay)).length, 0);
  } finally { await snapshot.$disconnect(); }
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    assert.equal((await db.resumeVersion.findUniqueOrThrow({ where: { id: version.id } })).name, "桌面重启后保留");
    assert.equal((await db.application.findUniqueOrThrow({ where: { id: application.id } })).notes, "桌面持久化测试");
    const stored = await db.settings.findUniqueOrThrow({ where: { id: "singleton" } });
    assert.notEqual(stored.aiApiKey, fakeKey);
    const [, iv, tag, encrypted] = stored.aiApiKey.split(".");
    const key = createHash("sha256").update(readFileSync(path.join(data, "settings.key"), "utf8").trim()).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    assert.equal(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString(), fakeKey);
  } finally { await db.$disconnect(); }
  console.log("PASS: public campus catalog/search/detail, native image conversion, migrations and upgrade backup, TXT/PDF/DOCX imports, resume edits, applications, mock AI connection and Agent SSE/history, key encryption, restart persistence, session rotation, HTTP isolation, and parent-pipe cleanup.");
} finally {
  provider.closeAllConnections();
  await new Promise((resolve) => provider.close(resolve));
  for (const running of children) {
    if (running.exitCode === null) { const exited = once(running, "exit"); running.kill(); await exited; }
  }
  // Exact synthetic temporary directory created by this check; never the user's application data.
  rmSync(data, { recursive: true, force: true });
}
