import { z } from "zod";

export const interviewPreparationInputSchema = z.object({
  company: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(100),
  jd: z.string().trim().min(1).max(50_000),
  resumeName: z.string().trim().min(1).max(200),
  resume: z.unknown(),
  focus: z.enum(["comprehensive", "project", "behavioral", "hr"]).default("comprehensive"),
  locale: z.enum(["zh-CN", "en"]).default("zh-CN"),
});

export const createInterviewPreparationInputSchema = interviewPreparationInputSchema.extend({
  jobId: z.string().trim().optional().default(""),
  resumeKey: z.string().trim().min(1),
  resumeVersionId: z.string().trim().min(1).nullable(),
});

const evidenceStateSchema = z.enum(["direct", "transferable", "not-shown", "gap", "confirm"]);
const prioritySchema = z.enum(["must", "should", "optional"]);
const requirementLevelSchema = z.enum(["core", "important", "bonus"]);
const evidenceLevelSchema = z.enum(["strong", "partial", "limited", "unknown"]);

export const interviewPreparationSchema = z.object({
  meta: z.object({
    company: z.string().trim().min(1),
    title: z.string().trim().min(1),
    roleFamily: z.string().trim().min(2),
    roleSummary: z.string().trim().min(2),
    assumptions: z.array(z.string().trim().min(2)).max(5),
  }),
  capabilityProfile: z.object({
    overview: z.string().trim().min(2),
    dimensions: z.array(
      z.object({
        label: z.string().trim().min(2).max(12),
        requirementLevel: requirementLevelSchema,
        evidenceLevel: evidenceLevelSchema,
        evidenceSummary: z.string().trim().min(2),
        nextStep: z.string().trim().min(2),
      }),
    ).min(5).max(7),
  }),
  evidenceMatrix: z.array(
    z.object({
      requirement: z.string().trim().min(2),
      resumeEvidence: z.array(z.string().trim().min(2)).max(5),
      state: evidenceStateSchema,
      assessment: z.string().trim().min(2),
      action: z.string().trim().min(2),
    }),
  ).min(3).max(10),
  knowledgeTopics: z.array(
    z.object({
      topic: z.string().trim().min(2),
      priority: prioritySchema,
      whyRelevant: z.string().trim().min(2),
      explanation: z.string().trim().min(2),
      currentEvidence: z.string().trim().min(2),
      targetLevel: z.string().trim().min(2),
      selfCheckQuestions: z.array(z.string().trim().min(2)).min(2).max(3),
    }),
  ).min(3).max(8),
  deepDives: z.array(
    z.object({
      resumeItem: z.string().trim().min(2),
      whyRelevant: z.string().trim().min(2),
      personalContributionFocus: z.string().trim().min(2),
      likelyFollowUps: z.array(z.string().trim().min(2)).min(2).max(5),
      factsToConfirm: z.array(z.string().trim().min(2)).max(5),
    }),
  ).max(4),
  targetedQuestions: z.array(
    z.object({
      question: z.string().trim().min(2),
      category: z.string().trim().min(2),
      preparationDirection: z.string().trim().min(2),
      priority: prioritySchema,
    }),
  ).min(6).max(10),
  preparationPlan: z.object({
    mustPrepare: z.array(z.string().trim().min(2)).min(2).max(8),
    shouldPrepare: z.array(z.string().trim().min(2)).max(8),
    optional: z.array(z.string().trim().min(2)).max(8),
  }),
  selfIntroduction: z.string().trim().min(20),
  reverseQuestions: z.array(z.string().trim().min(2)).min(3).max(8),
});

export type InterviewPreparationInput = z.infer<typeof interviewPreparationInputSchema>;
export type InterviewPreparation = z.infer<typeof interviewPreparationSchema>;
export type CreateInterviewPreparationInput = z.infer<typeof createInterviewPreparationInputSchema>;

export type InterviewPreparationRecord = {
  id: string;
  jobId: string;
  resumeVersionId: string | null;
  resumeKey: string;
  mode: InterviewPreparationInput["focus"];
  context: InterviewPreparationInput;
  content: InterviewPreparation;
  createdAt: string;
  updatedAt: string;
};

export function normalizeInterviewPreparation(input: unknown): InterviewPreparation {
  const parsed = interviewPreparationSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  if (!isRecord(input) || isRecord(input.capabilityProfile)) return interviewPreparationSchema.parse(input);

  const evidenceItems = Array.isArray(input.evidenceMatrix) ? input.evidenceMatrix.filter(isRecord) : [];
  const knowledgeItems = Array.isArray(input.knowledgeTopics) ? input.knowledgeTopics.filter(isRecord) : [];
  const dimensions = evidenceItems.slice(0, 5).map((item, index) => ({
    label: shortLabel(item.requirement, `要求${index + 1}`),
    requirementLevel: index < 2 ? "core" as const : "important" as const,
    evidenceLevel: legacyEvidenceLevel(item.state),
    evidenceSummary: textValue(item.assessment) || "需要结合简历进一步确认。",
    nextStep: textValue(item.action) || "补充可验证的经历与准备要点。",
  }));
  for (const item of knowledgeItems) {
    if (dimensions.length >= 5) break;
    dimensions.push({
      label: shortLabel(item.topic, `知识${dimensions.length + 1}`),
      requirementLevel: "important",
      evidenceLevel: "unknown",
      evidenceSummary: textValue(item.currentEvidence) || "当前资料未形成明确证据。",
      nextStep: textValue(item.targetLevel) || "按岗位要求完成基础准备。",
    });
  }

  return interviewPreparationSchema.parse({
    ...input,
    capabilityProfile: {
      overview: isRecord(input.meta) ? textValue(input.meta.roleSummary) || "根据 JD 与简历整理的能力证据概览。" : "根据 JD 与简历整理的能力证据概览。",
      dimensions,
    },
  });
}

function legacyEvidenceLevel(value: unknown): "strong" | "partial" | "limited" | "unknown" {
  if (value === "direct") return "strong";
  if (value === "transferable") return "partial";
  if (value === "gap") return "limited";
  return "unknown";
}

function shortLabel(value: unknown, fallback: string) {
  const label = textValue(value).replace(/[，。；：,.!！?？]/g, " ").trim();
  return (label || fallback).slice(0, 12);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
