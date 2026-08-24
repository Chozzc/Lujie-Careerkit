import type {
  ApplicationView,
  InitialData,
  JobView,
  ResumeVersionView,
} from "@/components/app/types";
import type { InterviewPreparationRecord } from "@/lib/interview-preparation";
import type { InterviewSessionRecord } from "@/lib/interview-service";
import { readGeneralResumeOptimizationStages } from "@/lib/resume-optimization-state";
import type { ApplicationStatus, ResumeContent } from "@/lib/types";

export type CareerLibraryGroup = "job" | "type";
export type CareerArtifactKind =
  | "general-resume"
  | "tailored-resume"
  | "job-analysis"
  | "interview-preparation"
  | "interview-session";
export type CareerArtifactCategory = "resume" | "analysis" | "interview";

export type CareerArtifactSource =
  | { type: "resume-version"; value: ResumeVersionView }
  | { type: "job"; value: JobView }
  | { type: "interview-preparation"; value: InterviewPreparationRecord }
  | { type: "interview-session"; value: InterviewSessionRecord };

export type CareerArtifact = {
  id: string;
  key: string;
  kind: CareerArtifactKind;
  category: CareerArtifactCategory;
  name: string;
  company: string;
  role: string;
  jobId: string | null;
  jobArchiveId: string | null;
  updatedAt: string;
  metrics: number[];
  source: CareerArtifactSource;
};

export type CareerJobArchive = {
  id: string;
  jobId: string | null;
  isSample: boolean;
  company: string;
  role: string;
  city: string;
  status: ApplicationStatus | null;
  updatedAt: string;
  artifacts: CareerArtifact[];
  counts: {
    analyses: number;
    tailoredResumes: number;
    preparations: number;
    interviews: number;
  };
};

export type CareerCompanyGroup = {
  id: string;
  name: string;
  archives: CareerJobArchive[];
};

export type CareerLibraryTarget =
  | { type: "job"; id: string }
  | { type: "artifact"; kind: CareerArtifactKind; id: string };

export type CareerTreeNode = {
  id: string;
  children?: CareerTreeNode[];
};

const ARTIFACT_KINDS = new Set<CareerArtifactKind>([
  "general-resume",
  "tailored-resume",
  "job-analysis",
  "interview-preparation",
  "interview-session",
]);

const RESUME_SECTION_IDS = [
  "profile",
  "education",
  "experiences",
  "internships",
  "projects",
  "skills",
  "awards",
  "customSections",
] as const;

type CareerLibraryData = Pick<
  InitialData,
  "versions" | "jobs" | "applications" | "interviews" | "interviewPreparations"
>;

export function buildCareerArtifacts(data: CareerLibraryData): CareerArtifact[] {
  const jobsById = new Map(data.jobs.map((job) => [job.id, job]));
  const versionsById = new Map(data.versions.map((version) => [version.id, version]));
  const jobsByJd = new Map<string, JobView[]>();
  for (const job of data.jobs) {
    const jd = normalizeJobDescription(job.jd);
    if (jd) jobsByJd.set(jd, [...(jobsByJd.get(jd) ?? []), job]);
  }
  const resolveJob = ({
    jobId,
    resumeVersionId,
    jd,
    createdAt,
  }: {
    jobId: string | null;
    resumeVersionId: string | null;
    jd: string;
    createdAt: string;
  }) =>
    (jobId ? jobsById.get(jobId) : undefined) ??
    (resumeVersionId ? jobsById.get(versionsById.get(resumeVersionId)?.jobId ?? "") : undefined) ??
    closestJob(jobsByJd.get(normalizeJobDescription(jd)) ?? [], createdAt);
  const artifacts: CareerArtifact[] = [];

  for (const version of data.versions) {
    const hasOptimizationBase = Boolean(readTailoringBaseResume(version.content));
    if (!version.jobId && !hasOptimizationBase) continue;
    const meta = readOptimizationMeta(version.content);
    const job = version.jobId ? jobsById.get(version.jobId) : undefined;
    const company = job?.company ?? meta.company;
    const role = job?.title ?? meta.role;
    const kind: CareerArtifactKind = version.jobId ? "tailored-resume" : "general-resume";
    const archiveId = version.jobId ? job?.id ?? virtualArchiveId(company, role) : null;
    const stages = version.jobId ? undefined : readGeneralResumeOptimizationStages(version.content);
    artifacts.push({
      id: version.id,
      key: `${kind}:${version.id}`,
      kind,
      category: "resume",
      name: version.name,
      company,
      role,
      jobId: job?.id ?? null,
      jobArchiveId: archiveId,
      updatedAt: version.updatedAt,
      metrics: [
        stages?.diagnosis?.issues.length ?? 0,
        changedResumeSections(version.content).length,
        stages?.acceptedChangeIds?.length ?? readOptimizationChangeCount(version.content),
      ],
      source: { type: "resume-version", value: version },
    });
  }

  for (const job of data.jobs) {
    if (!job.jd.trim()) continue;
    artifacts.push({
      id: job.id,
      key: `job-analysis:${job.id}`,
      kind: "job-analysis",
      category: "analysis",
      name: `${job.company} · ${job.title}`,
      company: job.company,
      role: job.title,
      jobId: job.id,
      jobArchiveId: job.id,
      updatedAt: job.updatedAt ?? job.createdAt,
      metrics: [1],
      source: { type: "job", value: job },
    });
  }

  for (const preparation of data.interviewPreparations) {
    const job = resolveJob({
      jobId: preparation.jobId,
      resumeVersionId: preparation.resumeVersionId,
      jd: preparation.context.jd,
      createdAt: preparation.createdAt,
    });
    const company = job?.company ?? preparation.content.meta.company;
    const role = job?.title ?? preparation.content.meta.title;
    artifacts.push({
      id: preparation.id,
      key: `interview-preparation:${preparation.id}`,
      kind: "interview-preparation",
      category: "interview",
      name: `${company} · ${role}`,
      company,
      role,
      jobId: job?.id ?? null,
      jobArchiveId: job?.id ?? virtualArchiveId(company, role),
      updatedAt: preparation.updatedAt,
      metrics: [
        preparation.content.knowledgeTopics.length,
        preparation.content.targetedQuestions.length,
        preparation.content.deepDives.length,
      ],
      source: { type: "interview-preparation", value: preparation },
    });
  }

  for (const interview of data.interviews) {
    const job = resolveJob({
      jobId: interview.jobId,
      resumeVersionId: interview.resumeVersionId,
      jd: interview.context.jd,
      createdAt: interview.createdAt,
    });
    const company = job?.company ?? interview.context.company;
    const role = job?.title ?? interview.context.title;
    artifacts.push({
      id: interview.id,
      key: `interview-session:${interview.id}`,
      kind: "interview-session",
      category: "interview",
      name: `${company} · ${role}`,
      company,
      role,
      jobId: job?.id ?? null,
      jobArchiveId: job?.id ?? virtualArchiveId(company, role),
      updatedAt: interview.updatedAt,
      metrics: [
        interview.questions.length,
        interview.questions.filter((question) => interview.answers[question.id]?.content.trim()).length,
        interview.feedback || interview.legacyFeedback ? 1 : 0,
      ],
      source: { type: "interview-session", value: interview },
    });
  }

  return artifacts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function buildCareerJobArchives(
  data: Pick<CareerLibraryData, "jobs" | "applications">,
  artifacts: CareerArtifact[],
): CareerJobArchive[] {
  const jobsById = new Map(data.jobs.map((job) => [job.id, job]));
  const applicationsByJobId = newestApplicationsByJob(data.applications);
  const grouped = new Map<string, CareerArtifact[]>();

  for (const artifact of artifacts) {
    if (!artifact.jobArchiveId) continue;
    const group = grouped.get(artifact.jobArchiveId) ?? [];
    group.push(artifact);
    grouped.set(artifact.jobArchiveId, group);
  }

  return [...grouped.entries()]
    .map(([id, group]) => {
      const jobId = group.find((artifact) => artifact.jobId)?.jobId ?? null;
      const job = jobId ? jobsById.get(jobId) : undefined;
      const latest = group.reduce((current, artifact) =>
        artifact.updatedAt.localeCompare(current.updatedAt) > 0 ? artifact : current,
      );
      const status = jobId ? applicationsByJobId.get(jobId)?.status ?? null : null;
      return {
        id,
        jobId,
        isSample: job?.isSample ?? false,
        company: job?.company ?? latest.company,
        role: job?.title ?? latest.role,
        city: job?.city ?? "",
        status,
        updatedAt: latest.updatedAt,
        artifacts: group.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        counts: {
          analyses: group.filter((artifact) => artifact.kind === "job-analysis").length,
          tailoredResumes: group.filter((artifact) => artifact.kind === "tailored-resume").length,
          preparations: group.filter((artifact) => artifact.kind === "interview-preparation").length,
          interviews: group.filter((artifact) => artifact.kind === "interview-session").length,
        },
      } satisfies CareerJobArchive;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function filterCareerArtifacts(artifacts: CareerArtifact[], query: string) {
  const normalized = normalizeSearch(query);
  if (!normalized) return artifacts;
  return artifacts.filter((artifact) =>
    normalizeSearch([artifact.name, artifact.company, artifact.role].join(" ")).includes(normalized),
  );
}

export function filterCareerJobArchives(archives: CareerJobArchive[], query: string) {
  const normalized = normalizeSearch(query);
  if (!normalized) return archives;
  return archives.filter((archive) =>
    normalizeSearch([archive.company, archive.role, archive.city].join(" ")).includes(normalized),
  );
}

export function groupCareerJobArchivesByCompany(archives: CareerJobArchive[]): CareerCompanyGroup[] {
  const groups = new Map<string, CareerCompanyGroup>();
  for (const archive of archives) {
    const identity = normalizeCompanyIdentity(archive.company);
    const id = identity && !isPlaceholderCompany(archive.company) ? identity : archive.id;
    const group = groups.get(id);
    if (group) {
      group.archives.push(archive);
      if (archive.company.length < group.name.length) group.name = archive.company;
    } else {
      groups.set(id, { id, name: archive.company, archives: [archive] });
    }
  }
  return [...groups.values()];
}

export function normalizeCompanyIdentity(company: string) {
  return company
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[（(](?:中国|china|北京|上海|深圳|杭州|广州|香港|hongkong|hk)[)）]/giu, "")
    .replace(/[\s·•._—–,，。-]+/g, "")
    .replace(/(?:股份有限公司|有限责任公司|集团有限公司|集团公司|有限公司|公司)$/u, "")
    .replace(/(?:companylimited|coltd|corporation|incorporated|limited|corp|inc|ltd|llc|plc)$/u, "");
}

export function buildCareerArtifactTree(artifact: CareerArtifact): CareerTreeNode[] {
  switch (artifact.source.type) {
      case "resume-version": {
        return [{ id: "overview" }];
      }
    case "job": {
      return [{ id: "original-jd" }];
    }
    case "interview-preparation": {
      const content = artifact.source.value.content;
      return compactTree([
        { id: "overview" },
        { id: "capability-profile" },
        { id: "evidence-gaps" },
        content.knowledgeTopics.length ? { id: "core-knowledge" } : undefined,
        content.deepDives.length ? { id: "experience-deep-dives" } : undefined,
        content.targetedQuestions.length ? { id: "targeted-questions" } : undefined,
        content.preparationPlan.mustPrepare.length ||
        content.preparationPlan.shouldPrepare.length ||
        content.preparationPlan.optional.length
          ? { id: "preparation-plan" }
          : undefined,
      ]);
    }
    case "interview-session": {
      const interview = artifact.source.value;
      return compactTree([
        interview.questions.length ? { id: "questions" } : undefined,
        interview.feedback || interview.legacyFeedback ? { id: "feedback" } : undefined,
      ]);
    }
  }
}

export function parseCareerLibraryTarget(pathname: string): CareerLibraryTarget | null {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== "library") return null;
  if (parts[1] === "jobs" && parts[2] && parts.length === 3) return { type: "job", id: parts[2] };
  if (parts[1] === "artifacts" && parts[2] && parts[3] && parts.length === 4) {
    const kind = parts[2] as CareerArtifactKind;
    return ARTIFACT_KINDS.has(kind) ? { type: "artifact", kind, id: parts[3] } : null;
  }
  return null;
}

export function careerLibraryTargetPath(target: CareerLibraryTarget) {
  if (target.type === "job") return `/library/jobs/${encodeURIComponent(target.id)}`;
  return `/library/artifacts/${target.kind}/${encodeURIComponent(target.id)}`;
}

export function readCareerLibraryGroup(value: string | null | undefined): CareerLibraryGroup {
  return value === "type" ? "type" : "job";
}

function compactTree(nodes: Array<CareerTreeNode | undefined>): CareerTreeNode[] {
  return nodes.filter((node): node is CareerTreeNode => Boolean(node));
}

function readOptimizationMeta(content: ResumeContent) {
  const value = (content as ResumeContent & { _optimizationMeta?: unknown })._optimizationMeta;
  if (!value || typeof value !== "object" || Array.isArray(value)) return { company: "", role: "" };
  const record = value as Record<string, unknown>;
  return {
    company: typeof record.company === "string" ? record.company : "",
    role:
      typeof record.title === "string"
        ? record.title
        : typeof record.role === "string"
          ? record.role
          : "",
  };
}

function readOptimizationChangeCount(content: ResumeContent) {
  const value = (content as ResumeContent & { _optimizationMeta?: unknown })._optimizationMeta;
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const changes = (value as Record<string, unknown>).changes;
  return Array.isArray(changes) ? changes.length : 0;
}

function changedResumeSections(content: ResumeContent): string[] {
  const base = readTailoringBaseResume(content);
  if (!base || typeof base !== "object" || Array.isArray(base)) return [];
  const baseRecord = base as Record<string, unknown>;
  const contentRecord = content as unknown as Record<string, unknown>;
  return RESUME_SECTION_IDS.filter(
    (section) => JSON.stringify(baseRecord[section] ?? null) !== JSON.stringify(contentRecord[section] ?? null),
  );
}

function readTailoringBaseResume(content: ResumeContent) {
  const base = (content as ResumeContent & { _tailoringBaseResume?: unknown })._tailoringBaseResume;
  return base && typeof base === "object" && !Array.isArray(base) ? base : null;
}

function newestApplicationsByJob(applications: ApplicationView[]) {
  const byJob = new Map<string, ApplicationView>();
  for (const application of applications) {
    const current = byJob.get(application.jobId);
    if (!current || application.updatedAt.localeCompare(current.updatedAt) > 0) {
      byJob.set(application.jobId, application);
    }
  }
  return byJob;
}

function jobIdentity(company: string, role: string) {
  return `${normalizeCompanyIdentity(company)}\u0000${role.trim().toLocaleLowerCase()}`;
}

function virtualArchiveId(company: string, role: string) {
  const identity = jobIdentity(company, role);
  let hash = 5381;
  for (const character of identity) hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  return `virtual-${(hash >>> 0).toString(36)}`;
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

function normalizeJobDescription(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function closestJob(jobs: JobView[], createdAt: string) {
  if (!jobs.length) return undefined;
  const target = Date.parse(createdAt);
  if (!Number.isFinite(target)) return jobs[0];
  const previous = jobs
    .filter((job) => Date.parse(job.createdAt) <= target)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  if (previous[0]) return previous[0];
  return [...jobs].sort(
    (left, right) => Math.abs(Date.parse(left.createdAt) - target) - Math.abs(Date.parse(right.createdAt) - target),
  )[0];
}

function isPlaceholderCompany(company: string) {
  return /待填写|未知|未识别|unknown|target company/i.test(company);
}
