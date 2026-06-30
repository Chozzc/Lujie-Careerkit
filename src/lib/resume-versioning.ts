import type { JobAnalysis, ResumeContent } from "./types";

type BuildTailoredResumeVersionInput = {
  masterResume: ResumeContent;
  job: {
    id: string;
    company: string;
    title: string;
  };
  analysis: JobAnalysis;
};

const OPTIMIZED_RESUME_PREFIX = "JD匹配优化-";

export function buildTailoredResumeVersion({
  masterResume,
  job,
  analysis,
}: BuildTailoredResumeVersionInput) {
  const content = structuredClone(masterResume);
  const keywords = analysis.keywords.slice(0, 5);
  const keywordText = keywords.join("、") || "岗位相关能力";
  const originalSummary = content.profile.summary.trim();

  content.profile.summary =
    originalSummary ||
    `本版本仅基于原简历已有内容调整表达重点，面向 ${job.company}${job.title} 优先呈现 ${keywordText} 相关信息。`;

  content.skills = reorderByKeywords(content.skills, keywords);

  return {
    id: `rv-${job.id}-${Date.now()}`,
    jobId: job.id,
    name: buildOptimizedResumeVersionName(masterResume, job.title),
    summary: `围绕 ${keywordText} 调整了摘要和已有技能排序。${
      analysis.suggestions[0] ? ` ${analysis.suggestions[0]}` : ""
    }`,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function buildOptimizedResumeVersionName(resume: ResumeContent, jobTitle: string) {
  const displayName = resume.editor?.displayName?.trim().replace(/的简历$/, "") ?? "";
  const resumeName = resume.basics.name.trim() || displayName;
  const cleanJobTitle = jobTitle.trim();
  const nameParts = [resumeName || "未命名简历", cleanJobTitle || "未命名岗位"];
  return `${OPTIMIZED_RESUME_PREFIX}${nameParts.join("-")}`;
}

export function normalizeOptimizedResumeVersionName(name: string) {
  const cleanName = name.trim();
  if (!cleanName) return `${OPTIMIZED_RESUME_PREFIX}未命名简历-未命名岗位`;
  if (cleanName.startsWith(OPTIMIZED_RESUME_PREFIX)) return cleanName;
  return `${OPTIMIZED_RESUME_PREFIX}${cleanName.replace(/^JD匹配优化：/, "").replace(/\s*定制版\s*$/, "").trim()}`;
}

function reorderByKeywords(skills: string[], keywords: string[]) {
  if (!keywords.length) return skills;
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return [...skills].sort((left, right) => {
    const leftRank = getKeywordRank(left, normalizedKeywords);
    const rightRank = getKeywordRank(right, normalizedKeywords);
    return leftRank - rightRank;
  });
}

function getKeywordRank(skill: string, normalizedKeywords: string[]) {
  const normalizedSkill = skill.toLowerCase();
  const rank = normalizedKeywords.findIndex((keyword) => normalizedSkill.includes(keyword));
  return rank === -1 ? Number.POSITIVE_INFINITY : rank;
}
