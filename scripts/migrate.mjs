import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ||= "file:./dev.db";

const prisma = new PrismaClient();
const legacyMigrations = [
  "20260624163000_initial_local_schema",
  "20260716130000_add_interview_preparations",
  "20260815090000_remove_follow_up_log",
];

try {
  const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'table'");
  const names = new Set(tables.map((table) => table.name));
  if (names.has("Resume") && !names.has("_prisma_migrations")) {
    for (const migration of legacyMigrations) runPrisma(["migrate", "resolve", "--applied", migration]);
  }
} finally {
  await prisma.$disconnect();
}

runPrisma(["migrate", "deploy"]);

function runPrisma(args) {
  const cli = new URL("../node_modules/prisma/build/index.js", import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(cli), ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    // Deployment is non-interactive; don't inherit the desktop host's lifetime pipe on Windows.
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
