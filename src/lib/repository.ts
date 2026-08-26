import type { ApplicationStatus } from "@prisma/client";

import { Prisma } from "@prisma/client";

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
import { normalizeApplicationInterviewRound, resolveApplicationAppliedAt } from "./application";
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
import {
  sampleApplications,
  sampleInterviewPreparation,
  sampleInterviewSession,
  sampleJobs,
  sampleResumeVersions,
  sampleTailoredResumeVersion,
} from "./sample-data";
import type { InterviewRound, JobAnalysis, ResumeContent, ResumeOptimizationMeta } from "./types";

export async function ensureSeedData() {
  const existingResume = await prisma.resume.findFirst();
  if (existingResume) {
    await ensureSettings();
    return;
  }
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { sampleDataCleared: true },
  });
  if (settings?.sampleDataCleared) {
    await ensureSettings();
    return;
  }

  const sampleVersion = sampleResumeVersions[0];
  const resume = await prisma.resume.create({ data: { name: sampleVersion?.name ?? "示例简历" } });
  if (sampleVersion) {
    await prisma.resumeVersion.create({
      data: {
        id: sampleVersion.id,
        resumeId: resume.id,
        jobId: null,
        name: sampleVersion.name,
        summary: sampleVersion.summary,
        content: sampleVersion.content,
      },
    });
  }

  for (const job of sampleJobs) {
    await prisma.job.create({
      data: {
        id: job.id,
        company: job.company,
        title: job.title,
        city: job.city ?? "待填写",
        source: job.source ?? "企业官网",
        jd: job.jd,
        link: job.link ?? "",
        deadline: job.deadline ? new Date(job.deadline) : null,
        analysis: analyzeJobInput(`${job.company} - ${job.title}\n投递截止日期：${job.deadline}\n${job.jd}`),
      },
    });
  }

  await prisma.resumeVersion.create({
    data: {
      id: sampleTailoredResumeVersion.id,
      resumeId: resume.id,
      jobId: sampleTailoredResumeVersion.jobId,
      name: sampleTailoredResumeVersion.name,
      summary: sampleTailoredResumeVersion.summary,
      content: sampleTailoredResumeVersion.content,
    },
  });

  for (const application of sampleApplications) {
    await prisma.application.create({
      data: {
        id: application.id,
        jobId: application.jobId,
        status: application.status as ApplicationStatus,
        resumeVersionId: application.resumeVersionId,
        appliedAt: application.appliedAt ? new Date(application.appliedAt) : null,
        stageDate: application.stageDate ? new Date(application.stageDate) : null,
        nextFollowUpAt: application.nextFollowUpAt ? new Date(application.nextFollowUpAt) : null,
        notes: application.notes,
        interviewRound: application.interviewRound ?? "",
      },
    });
  }

  await prisma.interviewPreparation.create({
    data: {
      id: sampleInterviewPreparation.id,
      jobId: sampleInterviewPreparation.jobId,
      resumeVersionId: sampleInterviewPreparation.resumeVersionId,
      mode: sampleInterviewPreparation.mode,
      context: toJsonInput(sampleInterviewPreparation.context),
      content: toJsonInput(sampleInterviewPreparation.content),
    },
  });
  await prisma.interviewSession.create({
    data: {
      id: sampleInterviewSession.id,
      jobId: sampleInterviewSession.jobId,
      resumeVersionId: sampleInterviewSession.resumeVersionId,
      mode: sampleInterviewSession.mode,
      status: sampleInterviewSession.status,
      context: toJsonInput(sampleInterviewSession.context),
      questions: toJsonInput(sampleInterviewSession.questions),
      answers: toJsonInput(sampleInterviewSession.answers),
      feedback: toJsonInput(sampleInterviewSession.feedback),
      currentQuestionIndex: sampleInterviewSession.currentQuestionIndex,
      completedAt: new Date(sampleInterviewSession.completedAt),
    },
  });

  await ensureSettings();
}
export async function resetAppDataToSample() {
  await prisma.$transaction([
    prisma.agentThread.deleteMany(),
    prisma.interviewPreparation.deleteMany(),
    prisma.interviewSession.deleteMany(),
    prisma.application.deleteMany(),
    prisma.resumeVersion.deleteMany(),
    prisma.job.deleteMany(),
    prisma.resume.deleteMany(),
    prisma.settings.deleteMany(),
  ]);
  await ensureSeedData();
  return getAppData();
}

export async function clearSampleData() {
  await ensureSettings();
  const sampleApplicationIds = sampleApplications.map((application) => application.id);
  const sampleJobIds = sampleJobs.map((job) => job.id);
  const resumeVersionIds = [
    ...sampleResumeVersions.map((version) => version.id),
    sampleTailoredResumeVersion.id,
  ];
  const resumeRoots = await prisma.resumeVersion.findMany({
    where: { id: { in: resumeVersionIds } },
    select: { resumeId: true },
  });

  await prisma.$transaction(async (transaction) => {
    const jobsWithUserData = await transaction.job.findMany({
      where: {
        id: { in: sampleJobIds },
        OR: [
          { applications: { some: { id: { notIn: sampleApplicationIds } } } },
          { versions: { some: { id: { notIn: resumeVersionIds } } } },
          { interviewPreparations: { some: { id: { not: sampleInterviewPreparation.id } } } },
          { interviews: { some: { id: { not: sampleInterviewSession.id } } } },
        ],
      },
    });
    for (const job of jobsWithUserData) {
      const replacementJob = await transaction.job.create({
        data: {
          company: job.company,
          title: job.title,
          city: job.city,
          source: job.source,
          jd: job.jd,
          link: job.link,
          deadline: job.deadline,
          analysis: job.analysis === null ? Prisma.JsonNull : toJsonInput(job.analysis),
        },
      });
      await transaction.application.updateMany({
        where: { jobId: job.id, id: { notIn: sampleApplicationIds } },
        data: { jobId: replacementJob.id },
      });
      await transaction.resumeVersion.updateMany({
        where: { jobId: job.id, id: { notIn: resumeVersionIds } },
        data: { jobId: replacementJob.id },
      });
      await transaction.interviewPreparation.updateMany({
        where: { jobId: job.id, id: { not: sampleInterviewPreparation.id } },
        data: { jobId: replacementJob.id },
      });
      await transaction.interviewSession.updateMany({
        where: { jobId: job.id, id: { not: sampleInterviewSession.id } },
        data: { jobId: replacementJob.id },
      });
    }
    await transaction.interviewPreparation.deleteMany({ where: { id: sampleInterviewPreparation.id } });
    await transaction.interviewSession.deleteMany({ where: { id: sampleInterviewSession.id } });
    await transaction.application.deleteMany({
      where: { id: { in: sampleApplicationIds } },
    });
    await transaction.resumeVersion.deleteMany({ where: { id: { in: resumeVersionIds } } });
    await transaction.job.deleteMany({ where: { id: { in: sampleJobIds } } });
    for (const { resumeId } of resumeRoots) {
      await transaction.resume.deleteMany({ where: { id: resumeId, versions: { none: {} } } });
    }
    await transaction.settings.update({
      where: { id: "singleton" },
      data: { sampleDataCleared: true },
    });
  });

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
    aiBaseUrl: settings.aiBaseUrl,
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

export async function getAppData() {
  await ensureSeedData();

  const [versions, jobs, applications, interviews, interviewPreparations, settings] =
    await Promise.all([
      prisma.resumeVersion.findMany({ orderBy: { updatedAt: "desc" } }),
      prisma.job.findMany({ orderBy: { createdAt: "desc" } }),
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
  const primaryVersion = versions.find((version) => !version.jobId && !hasStoredOptimizationBase(version.content)) ?? null;
  const remainingVersions = primaryVersion
    ? versions.filter((version) => version.id !== primaryVersion.id)
    : versions;

  return {
    resume: primaryVersion
      ? {
          id: primaryVersion.id,
          resumeId: primaryVersion.resumeId,
          name: primaryVersion.name,
          summary: primaryVersion.summary,
          content: primaryVersion.content as ResumeContent,
          updatedAt: primaryVersion.updatedAt.toISOString(),
        }
      : null,
    versions: remainingVersions.map((version) => ({
      id: version.id,
      resumeId: version.resumeId,
      jobId: version.jobId,
      name: version.name,
      summary: version.summary,
      content: version.content as ResumeContent,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      isSample: sampleJobs.some((sampleJob) => sampleJob.id === job.id),
      company: job.company,
      title: job.title,
      city: job.city,
      source: job.source,
      jd: job.jd,
      link: job.link,
      deadline: toDateInput(job.deadline),
      analysis: job.analysis as JobAnalysis | null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
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
      ...patch,
    },
    update: {
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

export async function updateResume(versionId: string, content: ResumeContent, name?: string) {
  await ensureSeedData();
  const version = await prisma.resumeVersion.update({
    where: { id: versionId },
    data: {
      content,
      ...(name !== undefined ? { name: name.trim() || deriveResumeVersionName(content) } : {}),
    },
    include: { resume: true },
  });
  if (name !== undefined && version.resume.name !== version.name) {
    await prisma.resume.update({ where: { id: version.resumeId }, data: { name: version.name } });
  }
  return version;
}

export async function createResumeVersion(input: {
  name: string;
  summary?: string;
  content: ResumeContent;
  baseResume?: ResumeContent;
  optimizationMeta?: ResumeOptimizationMeta;
  sourceResumeId?: string;
}) {
  await ensureSeedData();
  const content = input.baseResume
    ? attachTailoringBaseResume(input.content, input.baseResume, input.optimizationMeta)
    : input.content;
  const name = input.name.trim() || deriveResumeVersionName(content);
  const summary = input.summary?.trim() || "原简历版本，可作为 JD匹配优化的基准。";

  if (input.baseResume) {
    if (!input.sourceResumeId) throw new Error("优化版本缺少来源简历。");
    return prisma.resumeVersion.create({
      data: { resumeId: input.sourceResumeId, jobId: null, name, summary, content },
    });
  }

  return prisma.$transaction(async (transaction) => {
    const resume = await transaction.resume.create({ data: { name } });
    return transaction.resumeVersion.create({
      data: { resumeId: resume.id, jobId: null, name, summary, content },
    });
  });
}

export async function updateResumeVersion(input: {
  versionId: string;
  name?: string;
  summary?: string;
  content: ResumeContent;
}) {
  await ensureSeedData();
  const existing = await prisma.resumeVersion.findUnique({
    where: { id: input.versionId },
    select: { resumeId: true, jobId: true, content: true },
  });
  if (!existing) throw new Error("找不到要更新的简历。");
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

  const version = await prisma.resumeVersion.update({
    where: { id: input.versionId },
    data,
  });
  if (input.name !== undefined && !existing.jobId && !hasStoredOptimizationBase(existing.content)) {
    await prisma.resume.update({ where: { id: existing.resumeId }, data: { name: version.name } });
  }
  return version;
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
    throw new Error("找不到所选简历版本。");
  }
  const version = await prisma.resumeVersion.findFirst({
    where: { jobId: null },
    orderBy: { updatedAt: "desc" },
    select: { content: true },
  });
  if (!version) throw new Error("找不到可用于优化的简历。");
  return version.content as ResumeContent;
}

async function resolveResumeSource(input: {
  resumeVersionId?: string;
  resumeContent?: ResumeContent;
}) {
  await ensureSeedData();
  if (input.resumeVersionId) {
    const version = await prisma.resumeVersion.findUnique({
      where: { id: input.resumeVersionId },
      select: { id: true, resumeId: true, content: true },
    });
    if (version) return { versionId: version.id, resumeId: version.resumeId, content: version.content as ResumeContent };
  }

  if (input.resumeContent) {
    const content = input.resumeContent;
    const name = deriveResumeVersionName(content);
    return prisma.$transaction(async (transaction) => {
      const resume = await transaction.resume.create({ data: { name } });
      const version = await transaction.resumeVersion.create({
        data: {
          resumeId: resume.id,
          jobId: null,
          name,
          summary: "导入后用于岗位优化的基础简历。",
          content,
        },
      });
      return { versionId: version.id, resumeId: resume.id, content };
    });
  }

  const version = await prisma.resumeVersion.findFirst({
    where: { jobId: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, resumeId: true, content: true },
  });
  if (!version) throw new Error("找不到可用于优化的简历。");
  return { versionId: version.id, resumeId: version.resumeId, content: version.content as ResumeContent };
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
  const [job, application] = await Promise.all([
    prisma.job.findUnique({ where: { id: input.jobId } }),
    input.applicationId
      ? prisma.application.findUnique({ where: { id: input.applicationId }, select: { jobId: true } })
      : null,
  ]);
  if (!job) throw new Error("找不到目标岗位。");
  if (input.applicationId && application?.jobId !== input.jobId) {
    throw new Error("投递记录不属于该岗位。");
  }
  const source = await resolveResumeSource({
    resumeVersionId: input.resumeVersionId,
    resumeContent: input.resumeContent,
  });
  const baseResume = source.content;

  const jobIdentity = {
    company: preserveConfirmedJobLabel(job.company, input.analysis.company),
    title: preserveConfirmedJobLabel(job.title, input.analysis.title),
  };
  const tailored = buildTailoredResumeVersion({
    masterResume: baseResume,
    job: { id: job.id, company: jobIdentity.company, title: jobIdentity.title },
    analysis: input.analysis,
  });
  const content = attachTailoringBaseResume(input.tailoredContent ?? tailored.content, baseResume, input.optimizationMeta);
  const versionName = input.optimizationMeta?.versionName?.trim() || tailored.name;
  const versionSummary = input.optimizationMeta?.summary?.trim() || tailored.summary;

  return prisma.$transaction(async (transaction) => {
    await transaction.job.update({
      where: { id: job.id },
      data: {
        analysis: input.analysis,
        company: jobIdentity.company,
        title: jobIdentity.title,
      },
    });
    const version = await transaction.resumeVersion.create({
      data: {
        name: versionName,
        summary: versionSummary,
        content,
        resumeId: source.resumeId,
        jobId: job.id,
      },
    });
    if (input.applicationId) {
      await transaction.application.update({
        where: { id: input.applicationId },
        data: { resumeVersionId: version.id },
      });
    }
    return version;
  });
}

type CreateJobInput = {
  company: string;
  title: string;
  city?: string;
  source?: string;
  jd: string;
  link?: string;
  deadline?: string | null;
};

export async function createJob(input: CreateJobInput) {
  await ensureSeedData();
  // ponytail: exact-JD reuse is sufficient for a local personal database; add a normalized JD hash if this grows large.
  const existing = await prisma.job.findFirst({ where: { jd: input.jd }, orderBy: { updatedAt: "desc" } });
  if (existing) return existing;
  const analysis = analyzeJobInput(`${input.company} - ${input.title}\n${input.jd}`);
  return prisma.job.create({
    data: {
      company: input.company || analysis.company,
      title: input.title || analysis.title,
      city: input.city ?? "待填写",
      source: input.source ?? "官网",
      jd: input.jd,
      link: input.link ?? "",
      deadline: input.deadline ? new Date(input.deadline) : null,
      analysis,
    },
  });
}

export async function createApplication(input: {
  jobId: string;
  status?: ApplicationStatus;
  resumeVersionId?: string | null;
  appliedAt?: string | null;
  stageDate?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string;
  interviewRound?: InterviewRound;
}) {
  await ensureSeedData();
  const existing = await prisma.application.findUnique({ where: { jobId: input.jobId } });
  if (existing) return existing;
  const applicationStatus = input.status ?? "APPLIED";
  const interviewRound = normalizeApplicationInterviewRound(applicationStatus, input.interviewRound);
  const stageDate = input.stageDate ?? input.appliedAt ?? null;
  return prisma.application.create({
    data: {
      jobId: input.jobId,
      status: applicationStatus,
      resumeVersionId: input.resumeVersionId,
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
      notes: input.notes || "已加入投递跟进。",
    },
  });
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
      appliedAt: resolveApplicationAppliedAt({
        status: input.status,
        stageDate: input.stageDate,
        existingAppliedAt: existingApplication?.appliedAt,
      }),
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
  const existingApplication = await prisma.application.findUnique({
    where: { id: input.applicationId },
    select: { jobId: true, status: true, appliedAt: true, interviewRound: true },
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
        appliedAt: resolveApplicationAppliedAt({
          status: input.status,
          appliedAt: input.appliedAt,
          stageDate: input.stageDate,
          existingAppliedAt: existingApplication.appliedAt,
        }),
        stageDate: input.stageDate ? new Date(input.stageDate) : input.stageDate,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : input.nextFollowUpAt,
        notes: input.notes,
        interviewRound,
      },
    }),
  ]);
  return { job, application };
}

export async function updateJobIdentity(jobId: string, company: string, title: string) {
  return prisma.job.update({ where: { id: jobId }, data: { company, title } });
}

export async function deleteJobWithApplications(jobId: string) {
  return prisma.$transaction(async (transaction) => {
    const interviewPreparations = await transaction.interviewPreparation.deleteMany({ where: { jobId } });
    const interviews = await transaction.interviewSession.deleteMany({ where: { jobId } });
    const applications = await transaction.application.deleteMany({ where: { jobId } });
    const resumeVersions = await transaction.resumeVersion.deleteMany({ where: { jobId } });
    await transaction.job.delete({ where: { id: jobId } });
    return {
      interviewPreparations: interviewPreparations.count,
      interviews: interviews.count,
      applications: applications.count,
      resumeVersions: resumeVersions.count,
    };
  });
}

export async function clearJobAnalysis(jobId: string) {
  return prisma.job.update({ where: { id: jobId }, data: { jd: "", analysis: Prisma.DbNull } });
}

export async function updateJobDescription(jobId: string, jd: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: { jd, analysis: Prisma.DbNull },
  });
}

export async function deleteApplication(applicationId: string) {
  return prisma.application.delete({ where: { id: applicationId } });
}

export async function deleteResumeVersion(versionId: string) {
  const version = await prisma.resumeVersion.findUnique({
    where: { id: versionId },
    select: { id: true, resumeId: true, jobId: true, content: true },
  });
  if (!version) return { deletedIds: [] };
  if (!version.jobId && !hasStoredOptimizationBase(version.content)) {
    const related = await prisma.resumeVersion.findMany({
      where: { resumeId: version.resumeId },
      select: { id: true },
    });
    await prisma.resume.delete({ where: { id: version.resumeId } });
    return { deletedIds: related.map((item) => item.id) };
  }
  await prisma.resumeVersion.delete({ where: { id: versionId } });
  return { deletedIds: [versionId] };
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
    const job = await resolveInterviewJob(input.jobId, input.context);
    const session = await prisma.interviewSession.create({
      data: {
        jobId: job.id,
        resumeVersionId: input.resumeVersionId,
        mode: input.mode,
        status: input.status,
        context: toJsonInput({ ...input.context, company: job.company, title: job.title }),
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
    if (!input.answer && input.currentQuestionIndex === undefined) {
      const current = await findStoredInterviewSession(id);
      if (!current) throw new Error("未找到这次面试练习。");
      return toInterviewSessionRecord(current);
    }

    let count: number;
    if (input.answer) {
      const answerPatch = JSON.stringify({ [input.answer.questionId]: input.answer });
      count = input.currentQuestionIndex === undefined
        ? await prisma.$executeRaw`
            UPDATE "InterviewSession"
            SET "answers" = json_patch(COALESCE("answers", '{}'), json(${answerPatch})),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${id} AND "status" = 'IN_PROGRESS'
          `
        : await prisma.$executeRaw`
            UPDATE "InterviewSession"
            SET "answers" = json_patch(COALESCE("answers", '{}'), json(${answerPatch})),
                "currentQuestionIndex" = ${input.currentQuestionIndex},
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${id} AND "status" = 'IN_PROGRESS'
          `;
    } else {
      count = await prisma.$executeRaw`
        UPDATE "InterviewSession"
        SET "currentQuestionIndex" = ${input.currentQuestionIndex},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id} AND "status" = 'IN_PROGRESS'
      `;
    }
    if (!count) throw new Error("这次面试练习不存在或已经完成。");

    const session = await findStoredInterviewSession(id);
    if (!session) throw new Error("未找到这次面试练习。");
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
  },

  async clearSessions() {
    const result = await prisma.interviewSession.deleteMany();
    return result.count;
  },
};

export async function createInterviewPreparationRecord(
  input: CreateInterviewPreparationInput,
  content: InterviewPreparation,
) {
  await ensureSeedData();
  const job = await resolveInterviewJob(input.jobId, {
    company: content.meta.company,
    title: content.meta.title,
    jd: input.jd,
  });
  const context = interviewPreparationInputSchema.parse(input);
  const normalizedContent = interviewPreparationSchema.parse({
    ...content,
    meta: { ...content.meta, company: job.company, title: job.title },
  });
  const record = await prisma.interviewPreparation.create({
    data: {
      jobId: job.id,
      resumeVersionId: input.resumeVersionId,
      mode: input.focus,
      context: toJsonInput(context),
      content: toJsonInput(normalizedContent),
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

export async function updateInterviewPreparationRecord(id: string, content: InterviewPreparation) {
  await ensureSeedData();
  const record = await prisma.interviewPreparation.update({
    where: { id },
    data: { content: toJsonInput(interviewPreparationSchema.parse(content)) },
    include: { job: true, resumeVersion: true },
  });
  return toInterviewPreparationRecord(record);
}

export async function updateInterviewSessionRecord(
  id: string,
  input: Pick<InterviewSessionRecord, "context" | "questions" | "answers" | "feedback">,
) {
  await ensureSeedData();
  const session = await prisma.interviewSession.update({
    where: { id },
    data: {
      context: toJsonInput(input.context),
      questions: toJsonInput(input.questions),
      answers: toJsonInput(input.answers),
      feedback: toJsonInput(input.feedback ?? {}),
    },
    include: { job: true, resumeVersion: true },
  });
  return toInterviewSessionRecord(session);
}

export async function deleteInterviewSessionSection(id: string, section: "questions" | "feedback") {
  await ensureSeedData();
  const existing = await prisma.interviewSession.findUnique({ where: { id } });
  if (!existing) throw new Error("未找到这次面试练习。");

  const questions = normalizeInterviewQuestions(existing.questions);
  const hasFeedback = interviewReportSchema.safeParse(existing.feedback).success
    || (isRecord(existing.feedback) && Object.keys(existing.feedback).length > 0);
  const removeSession = section === "questions" ? !hasFeedback : questions.length === 0;

  if (removeSession) {
    await prisma.interviewSession.delete({ where: { id } });
    return null;
  }

  const session = await prisma.interviewSession.update({
    where: { id },
    data: section === "questions"
      ? { questions: [], answers: {}, currentQuestionIndex: 0 }
      : { feedback: {} },
    include: { job: true, resumeVersion: true },
  });
  return toInterviewSessionRecord(session);
}

export async function deleteInterviewPreparationRecord(id: string) {
  await ensureSeedData();
  await prisma.interviewPreparation.delete({ where: { id } });
}

export async function clearInterviewPreparationRecords() {
  await ensureSeedData();
  const result = await prisma.interviewPreparation.deleteMany();
  return result.count;
}

async function resolveInterviewJob(
  requestedJobId: string | null | undefined,
  context: { company?: string; title?: string; jd: string },
) {
  if (requestedJobId) {
    const requested = await prisma.job.findUnique({ where: { id: requestedJobId } });
    if (requested) return requested;
  }
  const byJd = await prisma.job.findFirst({ where: { jd: context.jd }, orderBy: { updatedAt: "desc" } });
  if (byJd) return byJd;
  const company = cleanJobLabel(context.company) || "目标公司";
  const title = cleanJobLabel(context.title) || "目标岗位";
  return prisma.job.create({
    data: { company, title, city: "", source: "面试助手", jd: context.jd, link: "" },
  });
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
    company: stringValue(rawContext.company) || session.job?.company || "目标公司",
    title: stringValue(rawContext.title) || session.job?.title || "目标岗位",
    jd: stringValue(rawContext.jd) || session.job?.jd || "",
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
    jd: stringValue(rawContext.jd) || record.job?.jd || "",
    resumeName: stringValue(rawContext.resumeName) || record.resumeVersion?.name || "历史简历",
    resume: rawContext.resume ?? record.resumeVersion?.content ?? null,
    focus: rawContext.focus ?? record.mode,
    locale: rawContext.locale ?? "zh-CN",
  });
  return {
    id: record.id,
    jobId: record.jobId,
    resumeVersionId: record.resumeVersionId,
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

export function preserveConfirmedJobLabel(current: string, proposed?: string | null) {
  const placeholder = /^(?:待填写公司|待分析岗位|目标公司|目标岗位|未知公司|未知岗位|未识别公司|未识别岗位)$/u;
  if (current.trim() && !placeholder.test(current.trim())) return current;
  return cleanJobLabel(proposed) || current;
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
