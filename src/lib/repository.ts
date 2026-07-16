import type { ApplicationStatus } from "@prisma/client";

import {
  AI_SETTINGS_REGISTRY,
  buildAiSettingsPatch,
  getEffectiveAiSettings,
  redactAiSettings,
  type AiSettingsInput,
  type AiTestStatus,
} from "./ai/settings";
import { getAiSettingsMaintenancePatch } from "./ai/settings-migration";
import { DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER_ID, LEGACY_DEFAULT_AI_MODELS, getAiProvider } from "./ai/provider-registry";
import { normalizeApplicationInterviewRound } from "./application";
import { analyzeJobInput } from "./job-analysis";
import { prisma } from "./db";
import {
  interviewModeSchema,
  interviewReportSchema,
  normalizeInterviewAnswers,
  normalizeInterviewQuestions,
} from "./interview";
import {
  interviewPreparationInputSchema,
  interviewPreparationSchema,
  normalizeInterviewPreparation,
  type CreateInterviewPreparationInput,
  type InterviewPreparation,
  type InterviewPreparationRecord,
} from "./interview-preparation";
import type { InterviewRepository, InterviewSessionRecord } from "./interview-service";
import { resolveResumeContentTitle } from "./resume-naming";
import { buildTailoredResumeVersion } from "./resume-versioning";
import { shouldRefreshSampleResumeVersion, shouldSeedSampleResumeVersion } from "./resume-version-seeding";
import { sampleApplications, sampleJobs, sampleResume, sampleResumeVersions } from "./sample-data";
import type { InterviewRound, JobAnalysis, ResumeContent, ResumeOptimizationMeta } from "./types";

export async function ensureSeedData() {
  await ensureSchema();
  const existingResume = await prisma.resume.findFirst({ orderBy: { updatedAt: "desc" } });
  if (existingResume) {
    await ensureSampleResumeVersions(existingResume.id);
    await dedupeTailoredResumeVersions();
    await ensureSettings();
    return;
  }

  const resume = await prisma.resume.create({
    data: {
      name: "原简历",
      content: sampleResume,
    },
  });

  for (const job of sampleJobs) {
    const createdJob = await prisma.job.create({
      data: {
        id: job.id,
        company: job.company,
        title: job.title,
        city: job.company === "字节跳动" ? "北京 / 上海" : "上海",
        source: job.source ?? "企业官网",
        jd: job.jd,
        link: "",
        deadline: job.deadline ? new Date(job.deadline) : null,
        tags: ["实习", "校招"],
        analysis: analyzeJobInput(`${job.company} - ${job.title}\n投递截止日期：${job.deadline}\n${job.jd}`),
      },
    });

    const application = sampleApplications.find((item) => item.jobId === job.id);
    if (!application) continue;

    let resumeVersionId: string | undefined;
    if (application.resumeVersionId) {
      const sampleVersion = sampleResumeVersions.find((item) => item.id === application.resumeVersionId);
      if (sampleVersion && !sampleVersion.jobId) {
        const version = await prisma.resumeVersion.create({
          data: {
            id: application.resumeVersionId,
            resumeId: resume.id,
            jobId: null,
            name: sampleVersion.name,
            summary: sampleVersion.summary,
            content: sampleVersion.content,
          },
        });
        resumeVersionId = version.id;
      }
    }

    await prisma.application.create({
      data: {
        id: application.id,
        jobId: createdJob.id,
        status: application.status as ApplicationStatus,
        resumeVersionId,
        appliedAt: application.appliedAt ? new Date(application.appliedAt) : null,
        stageDate: application.stageDate ? new Date(application.stageDate) : null,
        nextFollowUpAt: application.nextFollowUpAt ? new Date(application.nextFollowUpAt) : null,
        notes: application.notes,
        interviewRound: application.interviewRound ?? "",
      },
    });
  }

  await ensureSampleResumeVersions(resume.id);
  await dedupeTailoredResumeVersions();
  await ensureSettings();
}

export async function resetAppDataToSample() {
  await ensureSchema();
  await prisma.$transaction([
    prisma.followUpLog.deleteMany(),
    prisma.interviewPreparation.deleteMany(),
    prisma.interviewSession.deleteMany(),
    prisma.application.deleteMany(),
    prisma.resumeVersion.deleteMany(),
    prisma.job.deleteMany(),
    prisma.resume.deleteMany(),
    prisma.settings.deleteMany(),
  ]);
  await prisma.$executeRawUnsafe(`DELETE FROM "DeletedSeedResumeVersion"`);
  await ensureSeedData();
  return getAppData();
}

async function ensureSettings() {
  const legacyDefaultModels = new Set<string>(LEGACY_DEFAULT_AI_MODELS);
  const defaultModel = process.env.OPENAI_MODEL && !legacyDefaultModels.has(process.env.OPENAI_MODEL)
    ? process.env.OPENAI_MODEL
    : DEFAULT_AI_MODEL;
  const defaultProvider = getAiProvider(DEFAULT_AI_PROVIDER_ID);
  const defaultBaseUrl = defaultProvider.baseUrl;
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      provider: "openai-compatible",
      model: defaultModel,
      baseUrl: defaultBaseUrl,
      aiProvider: defaultProvider.id,
      aiModel: defaultModel,
      aiBaseUrl: defaultBaseUrl,
      aiApiKey: "",
      aiEnabled: true,
      aiTemperature: 0.3,
      aiLastTestStatus: "untested",
    },
    update: {},
  });

  const maintenancePatch = getAiSettingsMaintenancePatch({
    aiProvider: settings.aiProvider,
    aiModel: settings.aiModel,
    baseUrl: settings.baseUrl,
    aiBaseUrl: settings.aiBaseUrl,
    model: settings.model,
    aiApiKey: settings.aiApiKey,
    aiEnabled: settings.aiEnabled,
  });

  if (maintenancePatch) {
    await prisma.settings.update({
      where: { id: "singleton" },
      data: maintenancePatch,
    });
  }
}

async function ensureSampleResumeVersions(resumeId: string) {
  const jobs = await prisma.job.findMany({ select: { id: true } });
  const jobIds = new Set(jobs.map((job) => job.id));
  const existingVersionIds = new Set(
    (await prisma.resumeVersion.findMany({ select: { id: true } })).map((version) => version.id),
  );
  const deletedSeedVersionIds = await getDeletedSeedResumeVersionIds();

  for (const sampleVersion of sampleResumeVersions) {
    if (sampleVersion.jobId) continue;

    const existing = await prisma.resumeVersion.findUnique({ where: { id: sampleVersion.id } });
    const jobId = sampleVersion.jobId && jobIds.has(sampleVersion.jobId) ? sampleVersion.jobId : null;
    const data = {
      resumeId,
      jobId,
      name: sampleVersion.name,
      summary: sampleVersion.summary,
      content: sampleVersion.content,
    };

    if (existing) {
      if (shouldRefreshSampleResumeVersion(existing.summary)) {
        await prisma.resumeVersion.update({ where: { id: sampleVersion.id }, data });
      }
      continue;
    }

    if (
      !shouldSeedSampleResumeVersion({
        versionId: sampleVersion.id,
        existingVersionIds,
        deletedSeedVersionIds,
      })
    ) {
      continue;
    }

    await prisma.resumeVersion.create({ data: { id: sampleVersion.id, ...data } });
    existingVersionIds.add(sampleVersion.id);
  }
}

function isBuiltInSampleResumeVersion(versionId: string) {
  return sampleResumeVersions.some((version) => version.id === versionId && !version.jobId);
}

async function getDeletedSeedResumeVersionIds() {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "DeletedSeedResumeVersion"`);
  return new Set(rows.map((row) => row.id));
}

async function dedupeTailoredResumeVersions() {
  const versions = await prisma.resumeVersion.findMany({
    where: { jobId: { not: null } },
    select: { id: true, resumeId: true, jobId: true, name: true },
    orderBy: { updatedAt: "desc" },
  });
  const groupedVersionIds = new Map<string, string[]>();

  for (const version of versions) {
    const key = `${version.resumeId}\u0000${version.jobId}\u0000${version.name}`;
    const group = groupedVersionIds.get(key) ?? [];
    group.push(version.id);
    groupedVersionIds.set(key, group);
  }

  for (const group of groupedVersionIds.values()) {
    const [keepVersionId, ...duplicateVersionIds] = group;
    if (!keepVersionId || !duplicateVersionIds.length) continue;

    await prisma.application.updateMany({
      where: { resumeVersionId: { in: duplicateVersionIds } },
      data: { resumeVersionId: keepVersionId },
    });
    await prisma.interviewSession.updateMany({
      where: { resumeVersionId: { in: duplicateVersionIds } },
      data: { resumeVersionId: keepVersionId },
    });
    await prisma.resumeVersion.deleteMany({
      where: { id: { in: duplicateVersionIds } },
    });
  }
}

async function ensureSchema() {
  // ponytail: legacy SQLite files may retain removed columns; use a backup-and-rebuild migration only if physical cleanup is needed.
  const statements = [
    `CREATE TABLE IF NOT EXISTS "Resume" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "content" JSONB NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Job" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "company" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "city" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "jd" TEXT NOT NULL,
      "link" TEXT NOT NULL,
      "deadline" DATETIME,
      "tags" JSONB NOT NULL,
      "analysis" JSONB,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ResumeVersion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "content" JSONB NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resumeId" TEXT NOT NULL,
      "jobId" TEXT,
      CONSTRAINT "ResumeVersion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ResumeVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Application" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "status" TEXT NOT NULL DEFAULT 'READY',
      "appliedAt" DATETIME,
      "stageDate" DATETIME,
      "nextFollowUpAt" DATETIME,
      "notes" TEXT NOT NULL DEFAULT '',
      "interviewRound" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "jobId" TEXT NOT NULL,
      "resumeVersionId" TEXT,
      CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Application_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "FollowUpLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applicationId" TEXT NOT NULL,
      CONSTRAINT "FollowUpLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "InterviewSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "mode" TEXT NOT NULL DEFAULT 'comprehensive',
      "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      "context" JSONB,
      "questions" JSONB NOT NULL,
      "answers" JSONB NOT NULL,
      "feedback" JSONB NOT NULL,
      "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" DATETIME,
      "jobId" TEXT NOT NULL,
      "resumeVersionId" TEXT,
      CONSTRAINT "InterviewSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InterviewSession_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "InterviewPreparation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "mode" TEXT NOT NULL DEFAULT 'comprehensive',
      "resumeKey" TEXT NOT NULL,
      "context" JSONB NOT NULL,
      "content" JSONB NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "jobId" TEXT NOT NULL,
      "resumeVersionId" TEXT,
      CONSTRAINT "InterviewPreparation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "InterviewPreparation_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Settings" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
      "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
        "model" TEXT NOT NULL DEFAULT 'qwen3.7-max',
        "baseUrl" TEXT NOT NULL DEFAULT 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        "aiProvider" TEXT NOT NULL DEFAULT 'qwen',
        "aiModel" TEXT NOT NULL DEFAULT 'qwen3.7-max',
        "aiBaseUrl" TEXT NOT NULL DEFAULT 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      "aiApiKey" TEXT NOT NULL DEFAULT '',
      "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
      "aiTemperature" REAL NOT NULL DEFAULT 0.3,
      "aiLastTestedAt" DATETIME,
      "aiLastTestStatus" TEXT NOT NULL DEFAULT 'untested',
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "DeletedSeedResumeVersion" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  await ensureColumn(
    "ResumeVersion",
    "updatedAt",
    `ALTER TABLE "ResumeVersion" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "ResumeVersion" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" = '1970-01-01 00:00:00'`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Job" SET "source" = 'JD匹配优化' WHERE "source" IN ('岗位匹配优化', '职位匹配优化')`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Application" SET "notes" = '来自 JD匹配优化流程。' WHERE "notes" IN ('来自岗位匹配优化流程。', '来自职位匹配优化流程。')`,
  );
  await ensureColumn("Application", "interviewRound", `ALTER TABLE "Application" ADD COLUMN "interviewRound" TEXT NOT NULL DEFAULT ''`);
  await ensureColumn("Application", "stageDate", `ALTER TABLE "Application" ADD COLUMN "stageDate" DATETIME`);
  await ensureColumn("InterviewSession", "mode", `ALTER TABLE "InterviewSession" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'comprehensive'`);
  await ensureColumn("InterviewSession", "status", `ALTER TABLE "InterviewSession" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS'`);
  await ensureColumn("InterviewSession", "context", `ALTER TABLE "InterviewSession" ADD COLUMN "context" JSONB`);
  await ensureColumn("InterviewSession", "currentQuestionIndex", `ALTER TABLE "InterviewSession" ADD COLUMN "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0`);
  await ensureColumn("InterviewSession", "updatedAt", `ALTER TABLE "InterviewSession" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`);
  await ensureColumn("InterviewSession", "completedAt", `ALTER TABLE "InterviewSession" ADD COLUMN "completedAt" DATETIME`);
  await prisma.$executeRawUnsafe(
    `UPDATE "InterviewSession" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" = '1970-01-01 00:00:00'`,
  );
  await ensureColumn("Settings", "aiProvider", `ALTER TABLE "Settings" ADD COLUMN "aiProvider" TEXT NOT NULL DEFAULT 'qwen'`);
  await ensureColumn("Settings", "aiModel", `ALTER TABLE "Settings" ADD COLUMN "aiModel" TEXT NOT NULL DEFAULT 'qwen3.7-max'`);
  await ensureColumn("Settings", "aiBaseUrl", `ALTER TABLE "Settings" ADD COLUMN "aiBaseUrl" TEXT NOT NULL DEFAULT 'https://dashscope.aliyuncs.com/compatible-mode/v1'`);
  await ensureColumn("Settings", "aiApiKey", `ALTER TABLE "Settings" ADD COLUMN "aiApiKey" TEXT NOT NULL DEFAULT ''`);
  await ensureColumn("Settings", "aiEnabled", `ALTER TABLE "Settings" ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT true`);
  await ensureColumn("Settings", "aiTemperature", `ALTER TABLE "Settings" ADD COLUMN "aiTemperature" REAL NOT NULL DEFAULT 0.3`);
  await ensureColumn("Settings", "aiLastTestedAt", `ALTER TABLE "Settings" ADD COLUMN "aiLastTestedAt" DATETIME`);
  await ensureColumn("Settings", "aiLastTestStatus", `ALTER TABLE "Settings" ADD COLUMN "aiLastTestStatus" TEXT NOT NULL DEFAULT 'untested'`);
}

async function ensureColumn(tableName: string, columnName: string, statement: string) {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${tableName}")`);
  if (!columns.some((column) => column.name === columnName)) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export async function getAppData() {
  await ensureSeedData();

  const [resume, versions, jobs, applications, interviews, interviewPreparations, settings] =
    await Promise.all([
      prisma.resume.findFirst({ orderBy: { updatedAt: "desc" } }),
      prisma.resumeVersion.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.job.findMany({
        where: { source: { not: INTERVIEW_DRAFT_JOB_SOURCE } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.application.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.interviewSession.findMany({
        orderBy: { createdAt: "desc" },
        include: { job: true, resumeVersion: true },
      }),
      prisma.interviewPreparation.findMany({
        orderBy: { createdAt: "desc" },
        include: { job: true, resumeVersion: true },
      }),
      prisma.settings.findUnique({ where: { id: "singleton" } }),
    ]);

  return {
    resume: resume
      ? {
          id: resume.id,
          name: resume.name,
          content: resume.content as ResumeContent,
          updatedAt: resume.updatedAt.toISOString(),
        }
      : null,
    versions: versions.map((version) => ({
      id: version.id,
      jobId: version.jobId,
      name: version.name,
      summary: version.summary,
      content: version.content as ResumeContent,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      company: job.company,
      title: job.title,
      city: job.city,
      source: job.source,
      jd: job.jd,
      link: job.link,
      deadline: toDateInput(job.deadline),
      tags: job.tags as string[],
      analysis: job.analysis as JobAnalysis | null,
      createdAt: job.createdAt.toISOString(),
    })),
    applications: applications.map((application) => ({
      id: application.id,
      jobId: application.jobId,
      status: application.status,
      resumeVersionId: application.resumeVersionId,
      appliedAt: toDateInput(application.appliedAt),
      stageDate: toDateInput(application.stageDate),
      nextFollowUpAt: toDateInput(application.nextFollowUpAt),
      notes: application.notes,
      interviewRound: normalizeApplicationInterviewRound(application.status, application.interviewRound),
      updatedAt: application.updatedAt.toISOString(),
    })),
    interviews: interviews.map(toInterviewSessionRecord),
    interviewPreparations: interviewPreparations.map(toInterviewPreparationRecord),
    settings: settings
      ? {
          provider: settings.provider,
          model: settings.model,
          baseUrl: settings.baseUrl,
          ai: redactAiSettings({
            aiProvider: settings.aiProvider,
            aiModel: settings.aiModel,
            aiBaseUrl: settings.aiBaseUrl,
            aiApiKey: settings.aiApiKey,
            aiEnabled: settings.aiEnabled,
            aiTemperature: settings.aiTemperature,
            aiLastTestedAt: settings.aiLastTestedAt,
            aiLastTestStatus: settings.aiLastTestStatus,
          }),
          updatedAt: settings.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function getAiSettingsPayload() {
  await ensureSeedData();
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings) throw new Error("Settings seed failed.");

  return {
    settings: redactAiSettings(toStoredAiSettings(settings)),
    registry: AI_SETTINGS_REGISTRY,
  };
}

export async function updateAiSettings(input: AiSettingsInput) {
  await ensureSeedData();
  const existing = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const patch = buildAiSettingsPatch(input, { encryptedApiKey: existing?.aiApiKey });
  const keepTestStatus = Boolean(
    existing &&
      existing.aiProvider === patch.aiProvider &&
      existing.aiModel === patch.aiModel &&
      existing.aiBaseUrl === patch.aiBaseUrl &&
      existing.aiApiKey === patch.aiApiKey &&
      existing.aiEnabled === patch.aiEnabled &&
      existing.aiTemperature === patch.aiTemperature,
  );

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      provider: "openai-compatible",
      model: patch.aiModel,
      baseUrl: patch.aiBaseUrl,
      ...patch,
    },
    update: {
      model: patch.aiModel,
      baseUrl: patch.aiBaseUrl,
      ...patch,
      aiLastTestStatus: keepTestStatus && existing ? existing.aiLastTestStatus : patch.aiLastTestStatus,
      aiLastTestedAt: keepTestStatus && existing ? existing.aiLastTestedAt : null,
    },
  });

  return {
    settings: redactAiSettings(toStoredAiSettings(settings)),
    registry: AI_SETTINGS_REGISTRY,
  };
}

export async function getEffectiveAiRuntimeSettings() {
  await ensureSeedData();
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (!settings) throw new Error("Settings seed failed.");
  return getEffectiveAiSettings(toStoredAiSettings(settings));
}

export async function recordAiSettingsTest(status: AiTestStatus) {
  await ensureSeedData();
  const settings = await prisma.settings.update({
    where: { id: "singleton" },
    data: {
      aiLastTestStatus: status,
      aiLastTestedAt: status === "success" ? new Date() : null,
    },
  });

  return {
    settings: redactAiSettings(toStoredAiSettings(settings)),
    registry: AI_SETTINGS_REGISTRY,
  };
}

export async function updateResume(content: ResumeContent) {
  await ensureSeedData();
  const resume = await prisma.resume.findFirst();
  if (!resume) throw new Error("Resume seed failed.");

  return prisma.resume.update({
    where: { id: resume.id },
    data: { content },
  });
}

export async function updateResumeVersionContent(versionId: string, content: ResumeContent) {
  await ensureSeedData();
  return prisma.resumeVersion.update({
    where: { id: versionId },
    data: { content, updatedAt: new Date() },
  });
}

export async function createResumeVersion(input: {
  name: string;
  summary?: string;
  content: ResumeContent;
  baseResume?: ResumeContent;
  optimizationMeta?: ResumeOptimizationMeta;
}) {
  await ensureSeedData();
  const resume = await prisma.resume.findFirst();
  if (!resume) throw new Error("Resume seed failed.");
  const content = input.baseResume
    ? attachTailoringBaseResume(input.content, input.baseResume, input.optimizationMeta)
    : input.content;

  return prisma.resumeVersion.create({
    data: {
      resumeId: resume.id,
      jobId: null,
      name: input.name.trim() || deriveResumeVersionName(content),
      summary: input.summary?.trim() || "原简历版本，可作为 JD匹配优化的基准。",
      content,
    },
  });
}

export async function updateResumeVersion(input: {
  versionId: string;
  name?: string;
  summary?: string;
  content: ResumeContent;
}) {
  await ensureSeedData();
  const data: {
    name?: string;
    summary?: string;
    content: ResumeContent;
    updatedAt: Date;
  } = {
    content: input.content,
    updatedAt: new Date(),
  };
  if (input.name !== undefined) {
    data.name = input.name.trim() || deriveResumeVersionName(input.content);
  }
  if (input.summary !== undefined) {
    data.summary = input.summary.trim();
  }

  return prisma.resumeVersion.update({
    where: { id: input.versionId },
    data,
  });
}

export async function saveJobAnalysis(jobId: string, analysis: JobAnalysis) {
  const company = cleanJobLabel(analysis.company);
  const title = cleanJobLabel(analysis.title);
  return prisma.job.update({
    where: { id: jobId },
    data: {
      analysis,
      ...(company ? { company } : {}),
      ...(title ? { title } : {}),
    },
  });
}

export async function getTailoringBaseResume(input: {
  resumeVersionId?: string;
  resumeContent?: ResumeContent;
}) {
  await ensureSeedData();
  if (input.resumeContent) return input.resumeContent;

  if (input.resumeVersionId) {
    const version = await prisma.resumeVersion.findUnique({
      where: { id: input.resumeVersionId },
      select: { content: true },
    });
    if (version) return version.content as ResumeContent;
  }

  const resume = await prisma.resume.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!resume) throw new Error("找不到可用于优化的简历。");
  return resume.content as ResumeContent;
}

export async function createTailoredVersionForJob(input: {
  jobId: string;
  applicationId?: string;
  resumeVersionId?: string;
  resumeContent?: ResumeContent;
  tailoredContent?: ResumeContent;
  analysis: JobAnalysis;
  optimizationMeta?: ResumeOptimizationMeta;
}) {
  await ensureSeedData();
  const [resume, job] = await Promise.all([
    prisma.resume.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.job.findUnique({ where: { id: input.jobId } }),
  ]);

  if (!resume || !job) throw new Error("找不到原简历或岗位。");

  const baseResume = await getTailoringBaseResume({
    resumeVersionId: input.resumeVersionId,
    resumeContent: input.resumeContent,
  });

  const jobIdentity = {
    company: cleanJobLabel(input.analysis.company) || job.company,
    title: cleanJobLabel(input.analysis.title) || job.title,
  };
  const tailored = buildTailoredResumeVersion({
    masterResume: baseResume,
    job: { id: job.id, company: jobIdentity.company, title: jobIdentity.title },
    analysis: input.analysis,
  });
  const content = attachTailoringBaseResume(input.tailoredContent ?? tailored.content, baseResume, input.optimizationMeta);
  const versionName = input.optimizationMeta?.versionName?.trim() || tailored.name;
  const versionSummary = input.optimizationMeta?.summary?.trim() || tailored.summary;

  const existingVersion = await prisma.resumeVersion.findFirst({
    where: {
      resumeId: resume.id,
      jobId: job.id,
      name: versionName,
    },
    orderBy: { updatedAt: "desc" },
  });

  const version = existingVersion
    ? await prisma.resumeVersion.update({
        where: { id: existingVersion.id },
        data: {
          name: versionName,
          summary: versionSummary,
          content,
          resumeId: resume.id,
          jobId: job.id,
        },
      })
    : await prisma.resumeVersion.create({
        data: {
          name: versionName,
          summary: versionSummary,
          content,
          resumeId: resume.id,
          jobId: job.id,
        },
      });

  if (existingVersion) {
    const duplicateVersions = await prisma.resumeVersion.findMany({
      where: {
        id: { not: version.id },
        resumeId: resume.id,
        jobId: job.id,
        name: versionName,
      },
      select: { id: true },
    });
    const duplicateVersionIds = duplicateVersions.map((duplicate) => duplicate.id);
    if (duplicateVersionIds.length) {
      await prisma.application.updateMany({
        where: { resumeVersionId: { in: duplicateVersionIds } },
        data: { resumeVersionId: version.id },
      });
      await prisma.interviewSession.updateMany({
        where: { resumeVersionId: { in: duplicateVersionIds } },
        data: { resumeVersionId: version.id },
      });
      await prisma.resumeVersion.deleteMany({
        where: { id: { in: duplicateVersionIds } },
      });
    }
  }

  if (input.applicationId) {
    await prisma.application.update({
      where: { id: input.applicationId },
      data: { resumeVersionId: version.id },
    });
  }

  return version;
}

export async function createJobWithApplication(input: {
  company: string;
  title: string;
  city?: string;
  source?: string;
  jd: string;
  link?: string;
  deadline?: string | null;
  applicationStatus?: ApplicationStatus;
  appliedAt?: string | null;
  stageDate?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string;
  interviewRound?: InterviewRound;
}) {
  await ensureSeedData();
  const analysis = analyzeJobInput(`${input.company} - ${input.title}\n${input.jd}`);
  const applicationStatus = input.applicationStatus ?? "READY";
  const interviewRound = normalizeApplicationInterviewRound(applicationStatus, input.interviewRound);
  const stageDate = input.stageDate ?? input.appliedAt ?? null;
  const created = await prisma.job.create({
    data: {
      company: input.company || analysis.company,
      title: input.title || analysis.title,
      city: input.city ?? "待填写",
      source: input.source ?? "官网",
      jd: input.jd,
      link: input.link ?? "",
      deadline: input.deadline ? new Date(input.deadline) : null,
      tags: ["实习"],
      analysis,
      applications: {
        create: {
          status: applicationStatus,
          interviewRound,
          appliedAt: input.appliedAt
            ? new Date(input.appliedAt)
            : applicationStatus === "APPLIED"
              ? stageDate
                ? new Date(stageDate)
                : new Date()
              : null,
          stageDate: stageDate ? new Date(stageDate) : null,
          nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
          notes:
            input.notes ||
            (applicationStatus === "APPLIED"
              ? "已加入投递跟进。"
              : "新岗位，等待匹配优化。"),
        },
      },
    },
    include: { applications: true },
  });
  const { applications: [application], ...job } = created;
  if (!application) throw new Error("岗位创建后未生成投递记录。");
  return { job, application };
}

export async function updateApplication(input: {
  id: string;
  status?: ApplicationStatus;
  stageDate?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string;
  resumeVersionId?: string | null;
  interviewRound?: InterviewRound;
}) {
  await ensureSchema();
  const existingApplication = await prisma.application.findUnique({
    where: { id: input.id },
    select: { status: true, appliedAt: true, interviewRound: true },
  });
  const effectiveStatus = input.status ?? existingApplication?.status;
  const interviewRound = normalizeApplicationInterviewRound(
    effectiveStatus,
    input.interviewRound ?? existingApplication?.interviewRound,
  );
  const application = await prisma.application.update({
    where: { id: input.id },
    data: {
      status: input.status,
      stageDate:
        input.stageDate !== undefined
          ? input.stageDate
            ? new Date(input.stageDate)
            : null
          : input.status && input.status !== existingApplication?.status
            ? new Date()
            : undefined,
      nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : input.nextFollowUpAt,
      notes: input.notes,
      resumeVersionId: input.resumeVersionId,
      interviewRound,
      appliedAt:
        input.status === "APPLIED" && !existingApplication?.appliedAt
          ? input.stageDate
            ? new Date(input.stageDate)
            : new Date()
          : undefined,
    },
  });
  return application;
}

export async function updateJobWithApplication(input: {
  jobId: string;
  applicationId: string;
  company: string;
  title: string;
  city?: string;
  source?: string;
  link?: string;
  jd?: string;
  status?: ApplicationStatus;
  appliedAt?: string | null;
  stageDate?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string;
  interviewRound?: InterviewRound;
}) {
  await ensureSchema();
  const existingApplication = await prisma.application.findUnique({
    where: { id: input.applicationId },
    select: { jobId: true, status: true, interviewRound: true },
  });
  if (existingApplication?.jobId !== input.jobId) throw new Error("投递记录不属于该岗位。");
  const effectiveStatus = input.status ?? existingApplication?.status;
  const interviewRound = normalizeApplicationInterviewRound(
    effectiveStatus,
    input.interviewRound ?? existingApplication?.interviewRound,
  );
  const [job, application] = await prisma.$transaction([
    prisma.job.update({
      where: { id: input.jobId },
      data: {
        company: input.company,
        title: input.title,
        city: input.city,
        source: input.source ?? "官网",
        link: input.link ?? "",
        jd: input.jd ?? "",
      },
    }),
    prisma.application.update({
      where: { id: input.applicationId },
      data: {
        status: input.status,
        appliedAt: input.appliedAt
          ? new Date(input.appliedAt)
          : input.status === "APPLIED" && input.stageDate
            ? new Date(input.stageDate)
            : input.appliedAt,
        stageDate: input.stageDate ? new Date(input.stageDate) : input.stageDate,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : input.nextFollowUpAt,
        notes: input.notes,
        interviewRound,
      },
    }),
  ]);
  return { job, application };
}

export async function deleteJobWithApplications(jobId: string) {
  await ensureSchema();
  return prisma.job.delete({ where: { id: jobId } });
}

export async function deleteResumeVersion(versionId: string) {
  await ensureSchema();
  if (isBuiltInSampleResumeVersion(versionId)) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `INSERT OR REPLACE INTO "DeletedSeedResumeVersion" ("id", "deletedAt") VALUES (?, CURRENT_TIMESTAMP)`,
        versionId,
      );
      return transaction.resumeVersion.delete({ where: { id: versionId } });
    });
  }
  return prisma.resumeVersion.delete({ where: { id: versionId } });
}

export async function deleteOptimizedResumeVersions() {
  await ensureSeedData();
  const versions = await prisma.resumeVersion.findMany({
    select: { id: true, jobId: true, content: true },
  });
  const versionIds = versions
    .filter((version) => version.jobId || hasStoredOptimizationBase(version.content))
    .map((version) => version.id);
  if (!versionIds.length) return { count: 0 };

  return prisma.resumeVersion.deleteMany({ where: { id: { in: versionIds } } });
}

function hasStoredOptimizationBase(content: unknown) {
  return isRecord(content) && isRecord(content._tailoringBaseResume);
}

export const interviewSessionRepository: InterviewRepository = {
  async create(input) {
    await ensureSeedData();
    const jobId = input.jobId || await ensureInterviewDraftJob(input.context.jd);
    const session = await prisma.interviewSession.create({
      data: {
        jobId,
        resumeVersionId: input.resumeVersionId,
        mode: input.mode,
        status: input.status,
        context: toJsonInput(input.context),
        questions: toJsonInput(input.questions),
        answers: toJsonInput(input.answers),
        feedback: {},
        currentQuestionIndex: input.currentQuestionIndex,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
      },
      include: { job: true, resumeVersion: true },
    });
    return toInterviewSessionRecord(session);
  },

  async findById(id) {
    await ensureSeedData();
    const session = await findStoredInterviewSession(id);
    return session ? toInterviewSessionRecord(session) : null;
  },

  async saveProgress(id, input) {
    const session = await prisma.interviewSession.update({
      where: { id },
      data: {
        answers: toJsonInput(input.answers),
        ...(input.currentQuestionIndex === undefined ? {} : { currentQuestionIndex: input.currentQuestionIndex }),
      },
      include: { job: true, resumeVersion: true },
    });
    return toInterviewSessionRecord(session);
  },

  async complete(id, feedback) {
    const session = await prisma.interviewSession.update({
      where: { id },
      data: {
        feedback: toJsonInput(feedback),
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: { job: true, resumeVersion: true },
    });
    return toInterviewSessionRecord(session);
  },

  async deleteSession(id) {
    await prisma.interviewSession.delete({ where: { id } });
    await removeUnusedInterviewDraftJob();
  },

  async clearSessions() {
    const result = await prisma.interviewSession.deleteMany();
    await removeUnusedInterviewDraftJob();
    return result.count;
  },
};

export async function createInterviewPreparationRecord(
  input: CreateInterviewPreparationInput,
  content: InterviewPreparation,
) {
  await ensureSeedData();
  const jobId = input.jobId || await ensureInterviewDraftJob(input.jd);
  const context = interviewPreparationInputSchema.parse(input);
  const record = await prisma.interviewPreparation.create({
    data: {
      jobId,
      resumeVersionId: input.resumeVersionId,
      resumeKey: input.resumeKey,
      mode: input.focus,
      context: toJsonInput(context),
      content: toJsonInput(interviewPreparationSchema.parse(content)),
    },
    include: { job: true, resumeVersion: true },
  });
  return toInterviewPreparationRecord(record);
}

export async function getInterviewPreparationRecord(id: string) {
  await ensureSeedData();
  const record = await findStoredInterviewPreparation(id);
  return record ? toInterviewPreparationRecord(record) : null;
}

export async function deleteInterviewPreparationRecord(id: string) {
  await ensureSeedData();
  await prisma.interviewPreparation.delete({ where: { id } });
  await removeUnusedInterviewDraftJob();
}

export async function clearInterviewPreparationRecords() {
  await ensureSeedData();
  const result = await prisma.interviewPreparation.deleteMany();
  await removeUnusedInterviewDraftJob();
  return result.count;
}

const INTERVIEW_DRAFT_JOB_ID = "interview-draft-job";
const INTERVIEW_DRAFT_JOB_SOURCE = "INTERVIEW_ASSISTANT";

async function ensureInterviewDraftJob(jd: string) {
  const job = await prisma.job.upsert({
    where: { id: INTERVIEW_DRAFT_JOB_ID },
    create: {
      id: INTERVIEW_DRAFT_JOB_ID,
      company: "目标公司",
      title: "目标岗位",
      city: "",
      source: INTERVIEW_DRAFT_JOB_SOURCE,
      jd,
      link: "",
      tags: [],
    },
    update: { jd },
  });
  return job.id;
}

async function removeUnusedInterviewDraftJob() {
  const [sessions, preparations] = await Promise.all([
    prisma.interviewSession.count({ where: { jobId: INTERVIEW_DRAFT_JOB_ID } }),
    prisma.interviewPreparation.count({ where: { jobId: INTERVIEW_DRAFT_JOB_ID } }),
  ]);
  if (!sessions && !preparations) await prisma.job.deleteMany({ where: { id: INTERVIEW_DRAFT_JOB_ID } });
}

type StoredInterviewSession = NonNullable<Awaited<ReturnType<typeof findStoredInterviewSession>>>;

async function findStoredInterviewSession(id: string) {
  return prisma.interviewSession.findUnique({
    where: { id },
    include: { job: true, resumeVersion: true },
  });
}

function toInterviewSessionRecord(session: StoredInterviewSession): InterviewSessionRecord {
  const questions = normalizeInterviewQuestions(session.questions);
  const parsedMode = interviewModeSchema.safeParse(session.mode);
  const parsedReport = interviewReportSchema.safeParse(session.feedback);
  const rawContext = isRecord(session.context) ? session.context : {};
  const context = {
    company: stringValue(rawContext.company) || session.job.company,
    title: stringValue(rawContext.title) || session.job.title,
    jd: stringValue(rawContext.jd) || session.job.jd,
    resumeName: stringValue(rawContext.resumeName) || session.resumeVersion?.name || "历史简历",
    resume: rawContext.resume ?? session.resumeVersion?.content ?? null,
  };
  const answers = normalizeInterviewAnswers(session.answers, questions, session.updatedAt.toISOString());
  const hasLegacyFeedback = isRecord(session.feedback) && Object.keys(session.feedback).length > 0;

  return {
    id: session.id,
    jobId: session.jobId,
    resumeVersionId: session.resumeVersionId,
    mode: parsedMode.success ? parsedMode.data : "comprehensive",
    status:
      session.status === "COMPLETED" || parsedReport.success || hasLegacyFeedback ? "COMPLETED" : "IN_PROGRESS",
    context,
    questions,
    answers,
    feedback: parsedReport.success ? parsedReport.data : null,
    legacyFeedback: parsedReport.success ? null : stringRecord(session.feedback),
    currentQuestionIndex: Math.max(0, Math.min(session.currentQuestionIndex, Math.max(0, questions.length - 1))),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
  };
}

function toJsonInput(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringRecord(value: unknown) {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return entries.length ? Object.fromEntries(entries) : null;
}

function attachTailoringBaseResume(
  content: ResumeContent,
  baseResume: ResumeContent,
  optimizationMeta?: ResumeOptimizationMeta,
): ResumeContent {
  return {
    ...content,
    _tailoringBaseResume: baseResume,
    ...(optimizationMeta ? { _optimizationMeta: optimizationMeta } : {}),
  } as ResumeContent;
}

type StoredInterviewPreparation = NonNullable<Awaited<ReturnType<typeof findStoredInterviewPreparation>>>;

async function findStoredInterviewPreparation(id: string) {
  return prisma.interviewPreparation.findUnique({
    where: { id },
    include: { job: true, resumeVersion: true },
  });
}

function toInterviewPreparationRecord(record: StoredInterviewPreparation): InterviewPreparationRecord {
  const rawContext = isRecord(record.context) ? record.context : {};
  const context = interviewPreparationInputSchema.parse({
    jd: stringValue(rawContext.jd) || record.job.jd,
    resumeName: stringValue(rawContext.resumeName) || record.resumeVersion?.name || "历史简历",
    resume: rawContext.resume ?? record.resumeVersion?.content ?? null,
    focus: rawContext.focus ?? record.mode,
    locale: rawContext.locale ?? "zh-CN",
  });
  return {
    id: record.id,
    jobId: record.jobId,
    resumeVersionId: record.resumeVersionId,
    resumeKey: record.resumeKey,
    mode: context.focus,
    context,
    content: normalizeInterviewPreparation(record.content),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function cleanJobLabel(value?: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (/待|未知|未识别|目标公司|目标岗位/.test(text)) return "";
  return text.length > 100 ? "" : text;
}

function deriveResumeVersionName(content: ResumeContent) {
  return resolveResumeContentTitle(content);
}

export function toDateInput(value: Date | string | null) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function toStoredAiSettings(settings: {
  aiProvider: string;
  aiModel: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiEnabled: boolean;
  aiTemperature: number;
  aiLastTestedAt: Date | null;
  aiLastTestStatus: string;
}) {
  return {
    aiProvider: settings.aiProvider,
    aiModel: settings.aiModel,
    aiBaseUrl: settings.aiBaseUrl,
    aiApiKey: settings.aiApiKey,
    aiEnabled: settings.aiEnabled,
    aiTemperature: settings.aiTemperature,
    aiLastTestedAt: settings.aiLastTestedAt,
    aiLastTestStatus: settings.aiLastTestStatus,
  };
}
