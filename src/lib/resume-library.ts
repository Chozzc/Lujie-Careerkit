import { TEMPLATES } from "@/lib/constants";
import { resolveResumeContentTitle } from "@/lib/resume-naming";
import { normalizeOptimizedResumeVersionName } from "@/lib/resume-versioning";
import type { ResumeContent } from "@/lib/types";

export type ResumeLibrarySortMode = "recent" | "recentOptimized";
export type ResumeLibraryCardKind = "原简历" | "优化后简历";
export type ResumeLibrarySaveTarget = { kind: "main" } | { kind: "version"; id: string };

export type ResumeLibraryVersion = {
  id: string;
  name: string;
  summary: string;
  content: ResumeContent;
  createdAt: string;
  updatedAt?: string;
  jobId?: string | null;
};

export type ResumeLibraryCard = {
  id: string;
  kind: ResumeLibraryCardKind;
  title: string;
  detail: string;
  template: string;
  updatedAt: string;
  timestamp: number;
  content: ResumeContent;
  target: ResumeLibrarySaveTarget;
};

export const resumeTemplateLabels: Record<string, string> = {
  classic: "经典",
  modern: "现代",
  minimal: "极简",
  professional: "专业",
  "two-column": "双栏",
  creative: "创意",
  ats: "ATS",
  academic: "学术",
  elegant: "优雅",
  executive: "高管",
  developer: "开发者",
  designer: "设计师",
  startup: "创业",
  formal: "正式",
  infographic: "信息图",
  compact: "紧凑",
  euro: "欧式",
  clean: "清爽",
  bold: "醒目",
  timeline: "时间线",
  nordic: "北欧",
  corporate: "企业",
  consultant: "咨询",
  finance: "金融",
  medical: "医疗",
  gradient: "渐变",
  metro: "都市",
  material: "材料",
  coder: "代码",
  blocks: "块面",
  magazine: "杂志",
  artistic: "艺术",
  retro: "复古",
  neon: "霓虹",
  watercolor: "水彩",
  swiss: "瑞士",
  japanese: "日式",
  berlin: "柏林",
  luxe: "奢雅",
  rose: "玫瑰",
  architect: "建筑",
  legal: "法律",
  teacher: "教师",
  scientist: "科研",
  engineer: "工程师",
  sidebar: "侧栏",
  card: "卡片",
  zigzag: "折线",
  ribbon: "丝带",
  mosaic: "马赛克",
};

export function buildResumeLibraryCards({
  resume,
  mainResumeUpdatedAt,
  versions,
  search,
  sortMode,
}: {
  resume: ResumeContent;
  mainResumeUpdatedAt?: string;
  versions: ResumeLibraryVersion[];
  search: string;
  sortMode: ResumeLibrarySortMode;
}): ResumeLibraryCard[] {
  const mainCard: ResumeLibraryCard | null = hasResumeContent(resume)
    ? {
        id: "main",
        kind: "原简历",
        title: buildResumeTitle(resume),
        detail: `${resume.profile.title || "目标岗位待填写"} · 主简历`,
        template: resumeTemplateLabels[getValidResumeTemplate(resume.editor?.template)] ?? "现代",
        updatedAt: formatResumeEditedAt(mainResumeUpdatedAt),
        timestamp: toTimestamp(mainResumeUpdatedAt),
        content: resume,
        target: { kind: "main" },
      }
    : null;

  const versionCards: ResumeLibraryCard[] = versions.map((version) => {
    const editedAt = version.updatedAt ?? version.createdAt;
    const isOptimized = Boolean(version.jobId);
    return {
      id: version.id,
      kind: isOptimized ? "优化后简历" : "原简历",
      title: isOptimized ? normalizeOptimizedResumeVersionName(version.name) : version.name || "未命名原简历",
      detail: version.summary || (isOptimized ? "基于 JD 生成的优化后简历" : "原简历版本，可作为优化基准"),
      template: resumeTemplateLabels[getValidResumeTemplate(version.content.editor?.template)] ?? "现代",
      updatedAt: version.updatedAt ? formatResumeEditedAt(editedAt) : formatResumeCreatedAt(editedAt),
      timestamp: toTimestamp(editedAt),
      content: version.content,
      target: { kind: "version", id: version.id },
    };
  });

  const keyword = search.trim().toLowerCase();
  const optimizedVersionIds = new Set(versions.filter((version) => version.jobId).map((version) => version.id));
  return [mainCard, ...versionCards]
    .filter((card): card is ResumeLibraryCard => Boolean(card))
    .filter((card) => {
      if (!keyword) return true;
      return `${card.title} ${card.detail} ${card.template} ${card.kind}`.toLowerCase().includes(keyword);
    })
    .sort((a, b) => {
      if (sortMode === "recentOptimized") {
        const aOptimized = a.target.kind === "version" && optimizedVersionIds.has(a.id);
        const bOptimized = b.target.kind === "version" && optimizedVersionIds.has(b.id);
        if (Boolean(aOptimized) !== Boolean(bOptimized)) return aOptimized ? -1 : 1;
      }
      return b.timestamp - a.timestamp;
    });
}

export function buildResumeTitle(content: ResumeContent) {
  return resolveResumeContentTitle(content);
}

export function buildResumeEditorPath(target: ResumeLibrarySaveTarget) {
  return target.kind === "version" ? `/resume/edit?version=${encodeURIComponent(target.id)}` : "/resume/edit";
}

export function getValidResumeTemplate(template?: string) {
  return TEMPLATES.includes(template as (typeof TEMPLATES)[number]) ? template! : "modern";
}

export function formatResumeEditedAt(value?: string) {
  return formatResumeDate(value, "最近编辑于", "最近编辑时间未知");
}

function formatResumeCreatedAt(value?: string) {
  return formatResumeDate(value, "创建于", "创建时间未知");
}

function formatResumeDate(value: string | undefined, prefix: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${prefix} ${date.toLocaleDateString("zh-CN")}`;
}

function toTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function hasResumeContent(content: ResumeContent) {
  return Boolean(
    content.basics.name.trim() ||
      content.editor?.displayName?.trim() ||
      content.basics.email.trim() ||
      content.basics.phone.trim() ||
      content.basics.city.trim() ||
      content.profile.title.trim() ||
      content.profile.summary.trim() ||
      content.education.length ||
      content.experiences.length ||
      content.internships.length ||
      content.projects.length ||
      content.skills.length ||
      content.awards.length ||
      content.selfReview.trim(),
  );
}
