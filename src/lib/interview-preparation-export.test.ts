import { describe, expect, it, vi } from "vitest";

import {
  buildInterviewPreparationFileName,
  buildInterviewPreparationPrintHtml,
  exportInterviewPreparationDocx,
  printInterviewPreparation,
  type InterviewPreparationExportLabels,
} from "@/lib/interview-preparation-export";
import type { InterviewPreparation } from "@/lib/interview-preparation";

const preparation: InterviewPreparation = {
  meta: {
    company: "A/B <公司>",
    title: "AI 工程师",
    roleFamily: "技术",
    roleSummary: "负责 <Agent> 开发",
    assumptions: ["岗位信息待确认"],
  },
  capabilityProfile: {
    overview: "能力概览",
    dimensions: [{
      label: "工程能力",
      requirementLevel: "core",
      evidenceLevel: "partial",
      evidenceSummary: "有项目证据",
      nextStep: "准备项目细节",
    }],
  },
  evidenceMatrix: [{
    requirement: "Agent 开发",
    resumeEvidence: ["项目 A"],
    state: "direct",
    assessment: "已有证据",
    action: "准备复盘",
  }],
  knowledgeTopics: [{
    topic: "RAG",
    priority: "must",
    whyRelevant: "岗位要求",
    explanation: "检索增强生成",
    currentEvidence: "项目 A",
    targetLevel: "能够说明取舍",
    selfCheckQuestions: ["为何使用 RAG？", "如何评估？"],
  }],
  deepDives: [{
    resumeItem: "项目 A",
    whyRelevant: "对应岗位要求",
    personalContributionFocus: "说明个人贡献",
    likelyFollowUps: ["遇到什么问题？", "如何解决？"],
    factsToConfirm: ["指标口径"],
  }],
  targetedQuestions: [{
    question: "请介绍项目 A",
    category: "项目",
    preparationDirection: "按背景、行动、结果回答",
    priority: "must",
  }],
  preparationPlan: {
    mustPrepare: ["项目 A"],
    shouldPrepare: ["RAG"],
    optional: [],
  },
  selfIntroduction: "这是一段足够长的面试自我介绍内容，用于导出测试。",
  reverseQuestions: ["团队当前的重点是什么？", "岗位如何衡量成功？", "后续流程是什么？"],
};

const labels: InterviewPreparationExportLabels = {
  documentTitle: "面试准备资料",
  basedOn: "基于目标 JD 与测试简历生成",
  roleFamily: "岗位方向",
  assumptions: "资料假设",
  sections: {
    overview: "资料概览",
    capability: "能力画像",
    evidence: "证据与差距",
    knowledge: "核心知识",
    deepDives: "经历深挖",
    questions: "针对性问题",
    plan: "准备计划",
  },
  requirementLevel: "要求级别",
  evidenceLevel: "证据水平",
  nextStep: "下一步",
  resumeEvidence: "简历依据",
  action: "准备动作",
  explanation: "知识讲解",
  currentEvidence: "现有基础",
  targetLevel: "面试前目标",
  selfCheck: "自测问题",
  contribution: "个人贡献",
  followUps: "可能追问",
  factsToConfirm: "需要确认",
  category: "问题类别",
  preparationDirection: "准备方向",
  introduction: "定制自我介绍",
  reverseQuestions: "反问建议",
  stateLabels: { direct: "直接证据", transferable: "可迁移经历", "not-shown": "简历未体现", gap: "当前缺口", confirm: "待确认" },
  priorityLabels: { must: "必须准备", should: "建议准备", optional: "有余力再准备" },
  requirementLabels: { core: "核心要求", important: "重要要求", bonus: "加分项" },
  evidenceLabels: { strong: "证据充分", partial: "部分证据", limited: "证据有限", unknown: "尚未体现" },
};

describe("interview preparation export", () => {
  it("waits for print content to load without opening a popup, then cleans up", () => {
    const oldFrame = { remove: vi.fn() };
    const frameEvents = new Map<string, () => void>();
    const printEvents = new Map<string, () => void>();
    const printWindow = { focus: vi.fn(), print: vi.fn(), addEventListener: (event: string, fn: () => void) => printEvents.set(event, fn) };
    const frame = { style: {}, setAttribute: vi.fn(), remove: vi.fn(), contentWindow: printWindow, srcdoc: "", addEventListener: (event: string, fn: () => void) => frameEvents.set(event, fn) };
    const append = vi.fn(() => {
      expect(frame.srcdoc).toContain("负责 &lt;Agent&gt; 开发");
      expect(frameEvents.has("load")).toBe(true);
    });
    vi.stubGlobal("document", { getElementById: () => oldFrame, createElement: () => frame, body: { appendChild: append } });
    try {
      printInterviewPreparation(preparation, labels);
      expect(oldFrame.remove).toHaveBeenCalledOnce();
      expect(append).toHaveBeenCalledOnce();
      expect(printWindow.print).not.toHaveBeenCalled();
      frameEvents.get("load")!();
      expect(printWindow.print).toHaveBeenCalledOnce();
      expect(frame.remove).not.toHaveBeenCalled();
      printEvents.get("afterprint")!();
      expect(frame.remove).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });

  it("builds a filesystem-safe export name", () => {
    expect(buildInterviewPreparationFileName(preparation)).toBe("A-B-公司-AI 工程师-面试准备资料");
  });

  it("includes every section and escapes user-controlled HTML", () => {
    const html = buildInterviewPreparationPrintHtml(preparation, labels);

    expect(html).toContain("资料概览");
    expect(html).toContain("反问建议");
    expect(html).toContain("负责 &lt;Agent&gt; 开发");
    expect(html).not.toContain("负责 <Agent> 开发");
  });

  it("generates a non-empty editable Word document", async () => {
    const click = vi.fn();
    vi.stubGlobal("document", {
      createElement: () => ({ href: "", download: "", click }),
    });
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:interview-preparation",
      revokeObjectURL: vi.fn(),
    });

    const blob = await exportInterviewPreparationDocx(preparation, labels);

    expect(blob.size).toBeGreaterThan(1_000);
    expect(click).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
