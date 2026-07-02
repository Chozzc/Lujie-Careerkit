"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FileText } from "lucide-react";

import { ZoomableResumeCanvas } from "@/components/preview/zoomable-resume-canvas";
import { WorkflowStepper } from "@/components/shared/workflow-stepper";
import { contentToJadeResume } from "@/lib/resume-adapter";
import { buildResumeDisplayName } from "@/lib/resume-naming";
import type { JobAnalysis, ResumeContent, ResumeOptimizationMeta } from "@/lib/types";

export type ResumeDiffSection = {
  key: string;
  title: string;
  previewTitles: string[];
  detail: string;
};

type OptimizationSummaryItem = {
  label: string;
  value: string;
};

type SummaryOptions = {
  mode?: "jd" | "general";
  analysis?: JobAnalysis;
  meta?: ResumeOptimizationMeta;
};

export function ResumeOptimizationResult({
  workflowLabels,
  title,
  description,
  before,
  after,
  summaryItems,
  backLabel,
  onBack,
  openEditorLabel = "进入编辑器修改",
  onOpenEditor,
}: {
  workflowLabels: string[];
  title: string;
  description: string;
  before: ResumeContent;
  after: ResumeContent;
  summaryItems: OptimizationSummaryItem[];
  backLabel?: string;
  onBack?: () => void;
  openEditorLabel?: string;
  onOpenEditor: () => void;
}) {
  const diffSections = buildResumeDiffSections(before, after);

  return (
    <div className="space-y-5">
      <WorkflowStepper labels={workflowLabels} current={2} />
      <section className="rounded-lg border border-line bg-surface p-5 shadow-[0_18px_50px_rgba(49,48,48,0.05)] lg:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-medium text-primary">优化结果总结</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="flex gap-3">
            {backLabel && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-low"
              >
                {backLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenEditor}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white"
            >
              {openEditorLabel}
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded-lg bg-surface-low px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm leading-6 text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid items-stretch gap-5 xl:grid-cols-2">
        <ResumeDocumentComparePane
          title="原简历"
          subtitle={buildResumeDisplayName(before, "未命名简历")}
          resume={before}
        />
        <ResumeDocumentComparePane
          title="优化后"
          subtitle="已生成优化后简历，可进入编辑器继续微调。"
          resume={after}
          optimized
          changedSections={diffSections}
          action={
            <button
              type="button"
              onClick={onOpenEditor}
              aria-label="进入编辑器修改优化后简历"
              title="进入编辑器修改"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-primary hover:bg-primary-soft"
            >
              <FileText className="h-5 w-5" />
            </button>
          }
        />
      </section>
    </div>
  );
}

function isNearlyWhiteCssColor(color: string) {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return false;
  const values = match[1].split(",").map((part) => Number(part.trim()));
  const [red, green, blue] = values;
  const alpha = values[3] ?? 1;
  return alpha > 0.45 && red >= 235 && green >= 235 && blue >= 235;
}

function resetHighlightedReadableText(root: HTMLElement) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-match-readable-text='true']"));
  for (const node of nodes) {
    node.style.color = "";
    node.removeAttribute("data-match-readable-text");
  }
}

function makeHighlightedTextReadable(section: HTMLElement) {
  const nodes = Array.from(section.querySelectorAll<HTMLElement>("h1,h2,h3,p,span,li,strong,em,div"));
  for (const node of nodes) {
    if (!node.textContent?.trim()) continue;
    if (!isNearlyWhiteCssColor(window.getComputedStyle(node).color)) continue;
    node.style.color = "#111827";
    node.setAttribute("data-match-readable-text", "true");
  }
}

function ResumeDocumentComparePane({
  title,
  subtitle,
  resume,
  optimized,
  changedSections = [],
  action,
}: {
  title: string;
  subtitle: string;
  resume: ResumeContent;
  optimized?: boolean;
  changedSections?: ResumeDiffSection[];
  action?: ReactNode;
}) {
  const previewRootRef = useRef<HTMLDivElement>(null);
  const previewResume = useMemo(() => contentToJadeResume(resume), [resume]);
  const [canvasZoom, setCanvasZoom] = useState(68);
  const changedPreviewTitles = useMemo(
    () => new Set(changedSections.flatMap((section) => section.previewTitles.map(normalizeDiffText))),
    [changedSections],
  );

  useLayoutEffect(() => {
    const root = previewRootRef.current;
    if (!root || !optimized) return undefined;

    const applyHighlights = () => {
      resetHighlightedReadableText(root);
      const sectionNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-section]"));
      for (const section of sectionNodes) {
        section.style.outline = "";
        section.style.background = "";
        section.style.borderRadius = "";
        section.style.boxShadow = "";
      }

      const headerNodes = Array.from(root.querySelectorAll<HTMLElement>("h1"));
      for (const node of headerNodes) {
        node.style.background = "";
        node.style.boxShadow = "";
        node.style.borderRadius = "";
      }

      if (!changedPreviewTitles.size) return;

      for (const section of sectionNodes) {
        const heading = normalizeDiffText(section.querySelector("h2")?.textContent ?? "");
        if (!changedPreviewTitles.has(heading)) continue;
        section.style.outline = "1px solid rgba(245, 158, 11, 0.32)";
        section.style.background = "rgba(255, 251, 235, 0.72)";
        section.style.borderRadius = "10px";
        section.style.boxShadow = "0 0 0 5px rgba(255, 251, 235, 0.64)";
        makeHighlightedTextReadable(section);
      }
    };

    applyHighlights();
    const frame = window.requestAnimationFrame(applyHighlights);
    const timers = [120, 400, 1000].map((delay) => window.setTimeout(applyHighlights, delay));
    const observer = new MutationObserver(applyHighlights);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      resetHighlightedReadableText(root);
    };
  }, [changedPreviewTitles, optimized, previewResume]);

  return (
    <section className="flex h-[820px] min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_18px_50px_rgba(49,48,48,0.04)]">
      <div className="relative flex min-h-[76px] items-center justify-center border-b border-line px-14 py-4">
        <div className="min-w-0 text-center">
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          <p className="sr-only">{subtitle}</p>
        </div>
        <div className="absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {action ?? <FileText className="h-5 w-5 shrink-0 text-primary" />}
        </div>
      </div>
      <ZoomableResumeCanvas
        resume={previewResume}
        zoom={canvasZoom}
        onZoomChange={setCanvasZoom}
        smartOnePage={false}
        previewRootRef={previewRootRef}
        initialZoom={68}
        minZoom={30}
        maxZoom={160}
      />
    </section>
  );
}

export function buildResumeDiffSections(before: ResumeContent, after: ResumeContent): ResumeDiffSection[] {
  const diffs: ResumeDiffSection[] = [];

  if (
    before.basics.name !== after.basics.name ||
    before.basics.email !== after.basics.email ||
    before.basics.phone !== after.basics.phone ||
    before.basics.city !== after.basics.city ||
    stringifyForDiff(before.basics.links) !== stringifyForDiff(after.basics.links) ||
    before.profile.title !== after.profile.title
  ) {
    diffs.push({
      key: "header",
      title: "顶部信息",
      previewTitles: ["顶部信息"],
      detail: "姓名、联系方式、城市、链接或求职方向发生变化。",
    });
  }

  if (before.profile.summary !== after.profile.summary || before.selfReview !== after.selfReview) {
    diffs.push({
      key: "summary",
      title: "自我评价",
      previewTitles: ["自我评价", "求职摘要"],
      detail: "求职摘要或自我评价经过改写。",
    });
  }

  if (stringifyForDiff(before.education) !== stringifyForDiff(after.education)) {
    diffs.push({
      key: "education",
      title: "教育背景",
      previewTitles: ["教育背景"],
      detail: "教育经历内容发生调整。",
    });
  }

  if (stringifyForDiff(before.experiences) !== stringifyForDiff(after.experiences)) {
    diffs.push({
      key: "experiences",
      title: "工作经历",
      previewTitles: ["工作经历"],
      detail: "工作经历表达或排序发生调整。",
    });
  }

  if (stringifyForDiff(before.internships) !== stringifyForDiff(after.internships)) {
    diffs.push({
      key: "internships",
      title: "实习经历",
      previewTitles: ["实习经历"],
      detail: "实习经历表达或排序发生调整。",
    });
  }

  if (stringifyForDiff(before.projects) !== stringifyForDiff(after.projects)) {
    diffs.push({
      key: "projects",
      title: "项目经历",
      previewTitles: ["项目经历"],
      detail: "项目经历的职责、行动或结果表达发生调整。",
    });
  }

  if (stringifyForDiff(before.awards) !== stringifyForDiff(after.awards)) {
    diffs.push({
      key: "awards",
      title: "资格证书",
      previewTitles: ["资格证书", "奖项证书"],
      detail: "奖项或证书内容发生调整。",
    });
  }

  if (stringifyForDiff(before.skills) !== stringifyForDiff(after.skills)) {
    diffs.push({
      key: "skills",
      title: "技能特长",
      previewTitles: ["技能特长", "核心技能"],
      detail: "技能顺序或关键词覆盖发生调整。",
    });
  }

  if (stringifyForDiff(before.customSections ?? []) !== stringifyForDiff(after.customSections ?? [])) {
    diffs.push({
      key: "customSections",
      title: "自定义模块",
      previewTitles: uniqueTitles([...(before.customSections ?? []), ...(after.customSections ?? [])]),
      detail: "自定义模块正文发生调整，标题保持用户原始命名。",
    });
  }

  return diffs;
}

export function buildOptimizationSummary(
  before: ResumeContent,
  after: ResumeContent,
  options: SummaryOptions = {},
): OptimizationSummaryItem[] {
  const diffSections = buildResumeDiffSections(before, after);
  const metaChanges = normalizeMetaItems(options.meta?.changes);
  const isGeneral = options.mode === "general";
  const changedSections = buildDisplayChangedSections(diffSections, metaChanges, isGeneral);
  const keywords = normalizeMetaItems(options.meta?.keywords);

  return [
    {
      label: isGeneral ? "能力关键词" : "岗位关键词",
      value: isGeneral
        ? keywords.slice(0, 5).join("、") || "表达清晰度、信息密度、成果呈现"
        : keywords.slice(0, 5).join("、") || options.analysis?.keywords?.slice(0, 5).join("、") || "待补充岗位关键词",
    },
    {
      label: "调整范围",
      value: formatDisplayChangeList(changedSections) || "保留原结构，仅调整表达重点。",
    },
    {
      label: "事实边界",
      value: "只重排和改写原简历已有事实，不新增经历或数据。",
    },
  ];
}

export function buildOptimizationDescription(
  before: ResumeContent,
  after: ResumeContent,
  options: SummaryOptions = {},
) {
  const diffSections = buildResumeDiffSections(before, after);
  const changedSections = buildDisplayChangedSections(diffSections, normalizeMetaItems(options.meta?.changes), options.mode === "general");
  const summary = cleanMetaSummary(options.meta?.summary);
  const leadingSections = formatDisplayChangeList(changedSections, 4);
  const suffix = changedSections.length
    ? "右侧简历中浅黄色区域为本次优化产生或调整的模块，可以进入编辑器继续微调。"
    : "右侧简历没有明显高亮模块，可以进入编辑器继续复核。";

  if (!changedSections.length) {
    return options.mode === "jd"
      ? `已完成 JD 匹配检查，本次未发现明显结构变化。${suffix}`
      : `已完成 AI 优化检查，本次未发现明显结构变化。${suffix}`;
  }

  if (summary) {
    return `${summary}${summary.endsWith("。") ? "" : "。"}${suffix}`;
  }

  return options.mode === "jd"
    ? `已基于职位描述重新组织简历重点，本次主要调整了${leadingSections}。${suffix}`
    : `已基于当前简历优化表达与信息呈现，本次主要调整了${leadingSections}。${suffix}`;
}

function stringifyForDiff(value: unknown) {
  return JSON.stringify(normalizeForVisibleDiff(value));
}

function normalizeDiffText(value: string) {
  return value.replace(/\s+/g, "").replace(/[：:]/g, "");
}

function uniqueTitles(sections: Array<{ title: string }>) {
  return Array.from(new Set(sections.map((section) => section.title.trim()).filter(Boolean)));
}

function normalizeMetaItems(value?: string[]) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)))
    : [];
}

function buildDisplayChangedSections(diffSections: ResumeDiffSection[], metaChanges: string[], isGeneral: boolean) {
  const diffTitles = diffSections.map((section) => section.title);
  const metaTitles = normalizeDisplayChangeTitles(metaChanges);

  if (!isGeneral) return metaTitles.length ? metaTitles : diffTitles;
  if (!diffTitles.length) return [];
  if (!metaTitles.length) return diffTitles;

  const diffKeys = new Set(diffTitles.map(canonicalDisplayChange));
  const usedKeys = new Set<string>();
  const orderedMetaTitles = metaTitles.filter((title) => {
    const key = canonicalDisplayChange(title);
    if (!diffKeys.has(key)) return false;
    usedKeys.add(key);
    return true;
  });
  return uniqueTextList([
    ...orderedMetaTitles,
    ...diffTitles.filter((title) => !usedKeys.has(canonicalDisplayChange(title))),
  ]);
}

function normalizeDisplayChangeTitles(items: string[]) {
  return uniqueTextList(items.map(humanizeDisplayChange).filter(Boolean));
}

function humanizeDisplayChange(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/^(自我评价|项目经历|工作经历|实习经历|教育背景|技能特长|自定义模块|奖项证书)$/.test(text)) return text;
  if (/profile\.summary|selfReview|求职摘要|核心能力|自我评价/.test(text)) return "自我评价与核心能力";
  if (/projects?(\.|$)|项目/.test(text)) return "项目经历";
  if (/experiences?(\.|$)|工作/.test(text)) return "工作经历";
  if (/internships?(\.|$)|实习/.test(text)) return "实习经历";
  if (/education(\.|$)|教育/.test(text)) return "教育背景";
  if (/customSections?(\.|$)|自定义|主要优势/.test(text)) return "自定义模块";
  if (/skills?(\.|$)|技能|技术栈/.test(text)) return "技能特长";
  if (/awards?(\.|$)|奖项|证书|认证/.test(text)) return "奖项证书";
  if (/[a-zA-Z]+\.[a-zA-Z]+/.test(text)) return "";
  return text.replace(/[。；;].*$/, "").slice(0, 18);
}

function canonicalDisplayChange(value: string) {
  if (/自我评价|核心能力|求职摘要/.test(value)) return "summary";
  if (/项目/.test(value)) return "projects";
  if (/工作/.test(value)) return "experiences";
  if (/实习/.test(value)) return "internships";
  if (/教育/.test(value)) return "education";
  if (/技能|技术栈/.test(value)) return "skills";
  if (/奖项|证书|认证/.test(value)) return "awards";
  if (/自定义|主要优势/.test(value)) return "customSections";
  return value;
}

function formatDisplayChangeList(items: string[], limit = 3) {
  const visible = items.slice(0, limit);
  if (!visible.length) return "";
  return `${visible.join("、")}${items.length > limit ? "等模块" : ""}`;
}

function cleanMetaSummary(value?: string) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (/[a-zA-Z]+\.[a-zA-Z]+/.test(text)) return "";
  return text
    .replace(/\bcustomSections\b/g, "自定义模块")
    .replace(/\bprojects\.highlights\b/g, "项目经历")
    .replace(/\bprofile\.summary\b/g, "自我评价")
    .replace(/\bselfReview\b/g, "自我评价")
    .replace(/\bskills\b/g, "技能特长")
    .replace(/\bawards\b/g, "奖项证书");
}

function uniqueTextList(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function normalizeForVisibleDiff(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) return value.map(normalizeForVisibleDiff);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeForVisibleDiff(item)]),
  );
}
