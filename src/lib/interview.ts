import { z } from "zod";

export type InterviewMode = "comprehensive" | "project" | "behavioral" | "hr";

export const interviewModeSchema = z.enum(["comprehensive", "project", "behavioral", "hr"]);

export const interviewQuestionSchema = z.object({
  id: z.string().trim().min(1),
  category: z.enum([
    "general",
    "self-introduction",
    "motivation",
    "project",
    "professional",
    "behavioral",
    "failure",
    "reverse-question",
    "hr",
  ]),
  prompt: z.string().trim().min(2),
  focus: z.string().trim().min(2),
  order: z.number().int().min(0),
});

export const interviewQuestionPackSchema = z.object({
  questions: z.array(interviewQuestionSchema),
});

export const interviewAnswerSchema = z.object({
  questionId: z.string().trim().min(1),
  content: z.string(),
  skipped: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const interviewContextSchema = z.object({
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  jd: z.string().trim().min(10),
  resumeName: z.string().trim().min(1),
  resume: z.unknown(),
});

export const createInterviewSessionInputSchema = z.object({
  jobId: z.string().trim().optional().default(""),
  resumeVersionId: z.string().trim().min(1).nullable(),
  mode: interviewModeSchema,
  context: interviewContextSchema,
});

export const saveInterviewProgressInputSchema = z.object({
  answer: interviewAnswerSchema.optional(),
  currentQuestionIndex: z.number().int().min(0).optional(),
}).refine((input) => input.answer || input.currentQuestionIndex !== undefined, {
  message: "回答或题目位置至少需要提供一项。",
});

export const interviewReportSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  dimensions: z.object({
    jobFit: z.number().int().min(0).max(100),
    structure: z.number().int().min(0).max(100),
    evidence: z.number().int().min(0).max(100),
    star: z.number().int().min(0).max(100),
  }),
  strengths: z.array(z.string().trim().min(2)).min(1),
  improvements: z.array(z.string().trim().min(2)).min(1),
  questionReviews: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        diagnosis: z.string().trim().min(2),
        suggestion: z.string().trim().min(2),
        improvedAnswer: z.string().trim().min(2),
      }),
    )
    .min(1),
  nextActions: z.array(z.string().trim().min(2)).min(1),
});

export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewAnswer = z.infer<typeof interviewAnswerSchema>;
export type InterviewContext = z.infer<typeof interviewContextSchema>;
export type InterviewReport = z.infer<typeof interviewReportSchema>;
export type InterviewAnswers = Record<string, InterviewAnswer>;

export function questionCountForMode(mode: InterviewMode) {
  return mode === "comprehensive" ? 8 : 6;
}

export function parseInterviewQuestionPack(mode: InterviewMode, input: unknown) {
  const { questions } = interviewQuestionPackSchema.parse(input);
  const expectedCount = questionCountForMode(mode);
  if (questions.length !== expectedCount) {
    throw new Error(`${mode === "comprehensive" ? "综合模拟" : "专项模拟"}需要生成 ${expectedCount} 道题。`);
  }
  const hasInvalidIdentity = questions.some(
    (question, index) => question.id !== `q-${index + 1}` || question.order !== index,
  );
  if (hasInvalidIdentity) throw new Error("题目编号或顺序无效，请重新生成。");
  assertModeCategoryCoverage(mode, questions);
  return questions;
}

function assertModeCategoryCoverage(mode: InterviewMode, questions: InterviewQuestion[]) {
  if (mode === "comprehensive") return;
  const count = (category: InterviewQuestion["category"]) =>
    questions.filter((question) => question.category === category).length;

  if (mode === "project" && count("project") < 4) {
    throw new Error("项目深挖至少需要 4 道项目题，请重新生成。");
  }
  if (mode === "behavioral" && count("behavioral") < 3) {
    throw new Error("行为面试至少需要 3 道行为题，请重新生成。");
  }
  if (mode === "hr" && count("hr") + count("motivation") < 3) {
    throw new Error("HR 面至少需要 3 道 HR 或动机题，请重新生成。");
  }
}

export function createInterviewRetryInput(session: {
  jobId: string;
  resumeVersionId: string | null;
  mode: InterviewMode;
  context: InterviewContext;
}) {
  return {
    jobId: session.jobId,
    resumeVersionId: session.resumeVersionId,
    mode: session.mode,
    context: { ...session.context },
  };
}

export function mergeInterviewAnswer(answers: InterviewAnswers, answer: InterviewAnswer) {
  const parsed = interviewAnswerSchema.parse(answer);
  return { ...answers, [parsed.questionId]: parsed };
}

export function normalizeInterviewQuestions(input: unknown): InterviewQuestion[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item, index) => {
    if (typeof item === "string" && item.trim()) {
      return [
        {
          id: `legacy-${index + 1}`,
          category: "general" as const,
          prompt: item.trim(),
          focus: "历史面试题",
          order: index,
        },
      ];
    }
    const parsed = interviewQuestionSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function normalizeInterviewAnswers(
  input: unknown,
  questions: InterviewQuestion[],
  fallbackUpdatedAt = "1970-01-01T00:00:00.000Z",
): InterviewAnswers {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const questionByPrompt = new Map(questions.map((question) => [question.prompt, question]));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const answers: InterviewAnswers = {};

  for (const [key, value] of Object.entries(input)) {
    const parsed = interviewAnswerSchema.safeParse(value);
    if (parsed.success) {
      answers[parsed.data.questionId] = parsed.data;
      continue;
    }
    if (typeof value !== "string") continue;
    const question = questionById.get(key) ?? questionByPrompt.get(key);
    if (!question) continue;
    answers[question.id] = {
      questionId: question.id,
      content: value,
      skipped: false,
      updatedAt: fallbackUpdatedAt,
    };
  }

  return answers;
}

export function screenForInterviewSession(session: { status: string; feedback: unknown }) {
  return session.status === "COMPLETED" && session.feedback ? "report" : "session";
}

export function interviewQuestionNavTitle(question: { prompt: string; category: string }) {
  const prompt = question.prompt;
  const rules: Array<[RegExp, string]> = [
    [/介绍自己|自我介绍/, "自我介绍"],
    [/承担.*角色|负责.*部分|个人贡献/, "项目职责"],
    [/关键词|最有把握|专业能力/, "核心能力"],
    [/困难|压力|时间限制/, "困难处理"],
    [/反问|还有什么问题/, "面试反问"],
    [/为什么选择|求职动机|岗位动机/, "岗位动机"],
    [/失败|没有达到预期/, "失败复盘"],
    [/意见不一致|协作|团队合作/, "团队协作"],
    [/职业规划|未来.*年/, "职业规划"],
    [/如何看待|应用前景|发展趋势|模型效率/, "技术趋势"],
  ];
  const matched = rules.find(([pattern]) => pattern.test(prompt));
  if (matched) return matched[1];

  const categoryTitle: Record<string, string> = {
    "self-introduction": "自我介绍",
    motivation: "岗位动机",
    project: "项目深挖",
    professional: "专业能力",
    behavioral: "行为面试",
    failure: "失败复盘",
    "reverse-question": "面试反问",
    hr: "HR 面试",
  };
  if (categoryTitle[question.category]) return categoryTitle[question.category];
  return prompt.replace(/[，。？！：；、“”‘’「」【】\s]/g, "").slice(0, 10) || "面试问题";
}
