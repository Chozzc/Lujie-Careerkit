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
  const resumeColumns = await prisma.$queryRawUnsafe('PRAGMA table_info("Resume")');
  if (resumeColumns.some(({ name }) => name === "content")) {
    await prisma.$transaction(async (tx) => {
      // Preserve legacy content before the historical migration drops these fields.
      await tx.$executeRaw`
        INSERT INTO "ResumeVersion" ("id", "name", "summary", "content", "createdAt", "updatedAt", "resumeId")
        SELECT 'legacy-original-' || r."id", r."name", '', r."content", r."createdAt", r."updatedAt", r."id"
        FROM "Resume" r
        WHERE NOT EXISTS (
          SELECT 1 FROM "ResumeVersion" v WHERE v."resumeId" = r."id" AND v."jobId" IS NULL
            AND json_type(v."content", '$._tailoringBaseResume') IS NULL AND json(v."content") = json(r."content")
        )
      `;
      // The next schema allows only one application per job.
      await tx.$executeRaw`
        INSERT OR IGNORE INTO "Job" ("id", "company", "title", "city", "source", "jd", "link", "deadline", "tags", "analysis", "createdAt", "updatedAt")
        SELECT 'legacy-ready-job-' || a."id", j."company", j."title", j."city", j."source", j."jd", j."link", j."deadline", j."tags", j."analysis", j."createdAt", j."updatedAt"
        FROM "Application" a JOIN "Job" j ON j."id" = a."jobId"
        WHERE a."status" = 'READY' AND EXISTS (
          SELECT 1 FROM "Application" other WHERE other."jobId" = a."jobId"
          AND (other."status" <> 'READY' OR other."id" < a."id")
        )
      `;
      await tx.$executeRaw`
        UPDATE "Application" SET "status" = 'ARCHIVED', "jobId" = COALESCE(
          (SELECT "id" FROM "Job" WHERE "id" = 'legacy-ready-job-' || "Application"."id"), "jobId"
        ) WHERE "status" = 'READY'
      `;
    });
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
