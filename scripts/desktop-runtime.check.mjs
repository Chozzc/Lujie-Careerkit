import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { backupBeforeMigration, configurePrismaEngines, prepareDataDirectory } from "./desktop-runtime.mjs";
import { desktopTarget } from "./desktop-platform.mjs";
import prismaPlatform from "@prisma/get-platform";
const { getBinaryTargetForCurrentPlatform, getNodeAPIName } = prismaPlatform;

test("desktop targets reject foreign native dependencies and unsupported architectures", () => {
  for (const [platform, arch, triple] of [
    ["win32", "x64", "x86_64-pc-windows-msvc"], ["darwin", "x64", "x86_64-apple-darwin"],
    ["darwin", "arm64", "aarch64-apple-darwin"], ["linux", "x64", "x86_64-unknown-linux-gnu"],
  ]) {
    const target = desktopTarget(platform, arch, triple);
    assert.equal(target.executable, platform === "win32" ? "node.exe" : "node");
    assert.match(target.sha256, /^[a-f0-9]{64}$/);
    assert.throws(() => desktopTarget(platform, arch, "wrong-target"), /matching OS\/CPU/);
  }
  assert.throws(() => desktopTarget("win32", "arm64"), /Unsupported/);
  assert.throws(() => desktopTarget("linux", "ia32"), /Unsupported/);
});

test("runtime rejects a mismatched package or missing native engines before starting the server", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "lujie-engines-"));
  const previous = { query: process.env.PRISMA_QUERY_ENGINE_LIBRARY, schema: process.env.PRISMA_SCHEMA_ENGINE_BINARY };
  try {
    const manifest = path.join(directory, "desktop-build.json");
    writeFileSync(manifest, JSON.stringify({ platform: "wrong-platform" }));
    assert.throws(() => configurePrismaEngines(directory), /OS\/CPU/);
    const prismaTarget = await getBinaryTargetForCurrentPlatform();
    writeFileSync(manifest, JSON.stringify({ platform: desktopTarget().id, prismaTarget }));
    assert.throws(() => configurePrismaEngines(directory), /Missing bundled/);
    const query = path.join(directory, "node_modules", ".prisma", "client", getNodeAPIName(prismaTarget, "fs"));
    const schema = path.join(directory, "node_modules", "@prisma", "engines", `schema-engine-${prismaTarget}${process.platform === "win32" ? ".exe" : ""}`);
    for (const file of [query, schema]) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, "fixture"); }
    configurePrismaEngines(directory);
    assert.equal(process.env.PRISMA_QUERY_ENGINE_LIBRARY, query);
    assert.equal(process.env.PRISMA_SCHEMA_ENGINE_BINARY, schema);
  } finally {
    if (previous.query === undefined) delete process.env.PRISMA_QUERY_ENGINE_LIBRARY;
    else process.env.PRISMA_QUERY_ENGINE_LIBRARY = previous.query;
    if (previous.schema === undefined) delete process.env.PRISMA_SCHEMA_ENGINE_BINARY;
    else process.env.PRISMA_SCHEMA_ENGINE_BINARY = previous.schema;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("desktop data and encryption key survive restart in a Unicode path", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "lujie-桌面测试-"));
  try {
    const first = prepareDataDirectory(directory);
    writeFileSync(path.join(directory, "careerkit.db"), "synthetic test database");
    assert.deepEqual(prepareDataDirectory(directory), first);
    assert.equal(first.key.length, 64);
    assert.equal(first.databaseUrl, `file:${directory.replaceAll("\\", "/")}/careerkit.db`);
    writeFileSync(path.join(directory, "settings.key"), "damaged");
    assert.throws(() => prepareDataDirectory(directory), /Invalid settings.key/);
    rmSync(path.join(directory, "settings.key"));
    assert.throws(() => prepareDataDirectory(directory), /settings.key is missing/);
    assert.throws(() => prepareDataDirectory("relative"), /absolute/);
  } finally {
    // directory is the exact fresh temporary directory returned by mkdtempSync above.
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migration backups preserve committed WAL data and its key, and newer schemas cannot be downgraded", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "lujie-升级'测试-"));
  const { databaseUrl } = prepareDataDirectory(directory);
  const migrations = path.join(directory, "migrations");
  mkdirSync(path.join(migrations, "001"), { recursive: true });
  writeFileSync(path.join(migrations, "001", "migration.sql"), "SELECT 1;");
  assert.equal(await backupBeforeMigration(directory, databaseUrl, migrations), null);
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await db.$queryRawUnsafe("PRAGMA journal_mode=WAL");
    await db.$executeRawUnsafe("CREATE TABLE evidence (value TEXT)");
    await db.$executeRawUnsafe("INSERT INTO evidence VALUES ('keep this user record')");
    const backup = await backupBeforeMigration(directory, databaseUrl, migrations);
    assert.equal(readFileSync(path.join(backup, "settings.key"), "utf8"), readFileSync(path.join(directory, "settings.key"), "utf8"));
    const snapshot = new PrismaClient({ datasources: { db: { url: `file:${path.join(backup, "careerkit.db").replaceAll("\\", "/")}` } } });
    try { assert.deepEqual(await snapshot.$queryRawUnsafe("SELECT * FROM evidence"), [{ value: "keep this user record" }]); }
    finally { await snapshot.$disconnect(); }

    await db.$executeRawUnsafe("CREATE TABLE _prisma_migrations (migration_name TEXT, finished_at TEXT, rolled_back_at TEXT)");
    await db.$executeRawUnsafe("INSERT INTO _prisma_migrations VALUES ('001', 'done', NULL)");
    assert.equal(await backupBeforeMigration(directory, databaseUrl, migrations), null);
    assert.equal(readdirSync(path.join(directory, "backups")).length, 1);
    await db.$executeRawUnsafe("INSERT INTO _prisma_migrations VALUES ('future-version', 'done', NULL)");
    await assert.rejects(backupBeforeMigration(directory, databaseUrl, migrations), /newer version/);
    assert.deepEqual(await db.$queryRawUnsafe("SELECT * FROM evidence"), [{ value: "keep this user record" }]);
  } finally {
    await db.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
