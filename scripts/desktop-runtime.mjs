import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { desktopTarget } from "./desktop-platform.mjs";

export function configurePrismaEngines(backend) {
  const manifest = JSON.parse(readFileSync(path.join(backend, "desktop-build.json"), "utf8"));
  if (manifest.platform !== desktopTarget().id) throw new Error("Desktop resources do not match this OS/CPU. Install the matching package.");
  const { getNodeAPIName } = createRequire(import.meta.url)("@prisma/get-platform");
  const engines = {
    PRISMA_QUERY_ENGINE_LIBRARY: path.join(backend, "node_modules", ".prisma", "client", getNodeAPIName(manifest.prismaTarget, "fs")),
    PRISMA_SCHEMA_ENGINE_BINARY: path.join(backend, "node_modules", "@prisma", "engines", `schema-engine-${manifest.prismaTarget}${process.platform === "win32" ? ".exe" : ""}`),
  };
  for (const file of Object.values(engines)) {
    if (!existsSync(file)) throw new Error(`Missing bundled Prisma engine: ${file}`);
  }
  Object.assign(process.env, engines);
}

export function prepareDataDirectory(directory) {
  if (!directory || !path.isAbsolute(directory)) throw new Error("An absolute desktop data directory is required.");
  if (process.platform !== "win32" && directory.includes("?")) throw new Error("The desktop data directory path cannot contain a question mark (?).");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keyFile = path.join(directory, "settings.key");
  if (!existsSync(keyFile)) {
    // Losing the key must not silently make existing saved API keys unreadable.
    if (existsSync(path.join(directory, "careerkit.db"))) throw new Error("settings.key is missing. Restore it alongside careerkit.db from your backup.");
    writeFileSync(keyFile, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
  }
  const key = readFileSync(keyFile, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid settings.key. Restore the original key from your backup.");
  const databasePath = path.join(directory, "careerkit.db");
  return { databaseUrl: `file:${process.platform === "win32" ? databasePath.replaceAll("\\", "/") : databasePath}`, key };
}

export async function prepareDatabaseMigration(directory, databaseUrl, migrationsDirectory) {
  if (!existsSync(path.join(directory, "careerkit.db"))) return { required: true, backup: null };
  const available = readdirSync(migrationsDirectory).filter((name) => existsSync(path.join(migrationsDirectory, name, "migration.sql")));
  const { PrismaClient } = createRequire(import.meta.url)("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const tables = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'table'");
    if (!tables.length) return { required: true, backup: null };
    const history = tables.some((table) => table.name === "_prisma_migrations")
      ? await db.$queryRawUnsafe("SELECT migration_name, finished_at IS NOT NULL AS finished FROM _prisma_migrations WHERE rolled_back_at IS NULL") : [];
    const applied = new Set(history.filter((row) => row.finished).map((row) => row.migration_name));
    if ([...applied].some((name) => !available.includes(name))) {
      throw new Error("This database belongs to a newer version. Install the newer LuJie version; do not downgrade.");
    }
    if (history.every((row) => row.finished) && available.every((name) => applied.has(name))) {
      return { required: false, backup: null };
    }
    const backups = path.join(directory, "backups");
    mkdirSync(backups, { recursive: true });
    const backup = mkdtempSync(path.join(backups, `before-upgrade-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-`));
    copyFileSync(path.join(directory, "settings.key"), path.join(backup, "settings.key"));
    // SQLite creates a consistent snapshot, including committed WAL data; copying a live .db alone cannot.
    await db.$executeRawUnsafe("VACUUM INTO ?", path.join(backup, "careerkit.db"));
    console.log(`Upgrade backup saved: ${backup}`);
    return { required: true, backup };
  } finally { await db.$disconnect(); }
}

async function main() {
  // The native host establishes process ownership before allowing migration children to start.
  await new Promise((resolve, reject) => {
    process.stdin.once("data", resolve);
    process.stdin.once("end", () => reject(new Error("Desktop host closed during startup.")));
  });
  process.stdin.on("end", () => process.exit(0));
  process.stdin.resume();

  const started = performance.now();
  const directory = process.env.LUJIE_DESKTOP_DATA_DIR;
  const { databaseUrl, key } = prepareDataDirectory(directory);
  process.env.DATABASE_URL = databaseUrl;
  process.env.LUJIE_SETTINGS_SECRET = key;
  process.env.LUJIE_DESKTOP_SESSION = randomBytes(32).toString("hex");
  process.env.HOSTNAME = "127.0.0.1";
  const backend = path.dirname(fileURLToPath(import.meta.url));
  configurePrismaEngines(backend);
  process.env.PORT ||= "43187";
  process.env.NODE_ENV = "production";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  process.env.CHECKPOINT_DISABLE = "1";
  // A packaged install uses only keys explicitly saved in its own settings.
  delete process.env.OPENAI_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  process.chdir(path.dirname(fileURLToPath(import.meta.url)));

  const migration = await prepareDatabaseMigration(directory, databaseUrl, path.join(backend, "prisma", "migrations"));
  const checked = performance.now();
  if (migration.required) await import("./scripts/migrate.mjs");
  const databaseReady = performance.now();
  createRequire(import.meta.url)("./server.js");
  const origin = `http://127.0.0.1:${process.env.PORT}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/_desktop/health`, {
        headers: { cookie: `lujie-desktop-session=${process.env.LUJIE_DESKTOP_SESSION}` },
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok && (await response.json()).ready === true) {
        console.log("LUJIE_TIMING " + JSON.stringify({
          databaseCheck: Math.round(checked - started),
          migration: Math.round(databaseReady - checked),
          localServer: Math.round(performance.now() - databaseReady),
        }));
        // Private parent/child pipe; the native host never writes this line to logs.
        process.stdout.write(`LUJIE_READY ${origin}/_desktop/session?token=${process.env.LUJIE_DESKTOP_SESSION}\n`);
        return;
      }
    } catch { /* The HTTP server may still be starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Desktop server did not become ready within 60 seconds.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
