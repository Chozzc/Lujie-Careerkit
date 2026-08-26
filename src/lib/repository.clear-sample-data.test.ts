import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("clearSampleData", () => {
  let database: PrismaClient;
  let clearSampleData: () => Promise<unknown>;
  let resetAppDataToSample: () => Promise<unknown>;
  let directory: string;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), "lujie-clear-sample-"));
    const databasePath = join(directory, "test.db");
    writeFileSync(databasePath, "");
    process.env.DATABASE_URL = `file:${databasePath.replaceAll("\\", "/")}`;
    const migration = spawnSync(
      process.execPath,
      [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
      { cwd: process.cwd(), env: process.env, encoding: "utf8" },
    );
    if (migration.status !== 0) throw new Error(migration.stderr || migration.stdout);

    delete (globalThis as { prisma?: PrismaClient }).prisma;
    vi.resetModules();
    ({ prisma: database } = await import("./db"));
    ({ clearSampleData, resetAppDataToSample } = await import("./repository"));
  }, 30_000);

  beforeEach(async () => {
    await resetAppDataToSample();
  });

  afterAll(async () => {
    await database?.$disconnect();
    delete (globalThis as { prisma?: PrismaClient }).prisma;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    rmSync(directory, { recursive: true, force: true });
  });

  it("preserves a user-created application that reuses a sample job", async () => {
    const sampleApplication = await database.application.findFirstOrThrow({ include: { job: true } });
    await database.application.delete({ where: { id: sampleApplication.id } });
    const userApplication = await database.application.create({
      data: {
        id: "user-recreated-application",
        jobId: sampleApplication.jobId,
        status: "APPLIED",
        notes: "用户重新创建的投递卡片",
      },
    });

    await clearSampleData();

    const preserved = await database.application.findUniqueOrThrow({
      where: { id: userApplication.id },
      include: { job: true },
    });
    expect(preserved.jobId).not.toBe(sampleApplication.jobId);
    expect(preserved.job.company).toBe(sampleApplication.job.company);
    expect(preserved.job.title).toBe(sampleApplication.job.title);
    expect(await database.job.findUnique({ where: { id: sampleApplication.jobId } })).toBeNull();
  }, 30_000);

  it("preserves user-created artifacts that reuse a sample job without an application", async () => {
    const sampleJob = await database.job.findFirstOrThrow();
    const resume = await database.resume.create({ data: { name: "用户简历" } });
    const version = await database.resumeVersion.create({
      data: {
        id: "user-tailored-version",
        resumeId: resume.id,
        jobId: sampleJob.id,
        name: "用户定制简历",
        summary: "用户生成的岗位定制版本",
        content: {},
      },
    });

    await clearSampleData();

    const preserved = await database.resumeVersion.findUniqueOrThrow({
      where: { id: version.id },
      include: { job: true },
    });
    expect(preserved.jobId).not.toBe(sampleJob.id);
    expect(preserved.job?.company).toBe(sampleJob.company);
    expect(preserved.job?.title).toBe(sampleJob.title);
  }, 30_000);
});
