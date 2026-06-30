import {
  interviewReportSchema,
  mergeInterviewAnswer,
  parseInterviewQuestionPack,
  type InterviewAnswer,
  type InterviewAnswers,
  type InterviewContext,
  type InterviewMode,
  type InterviewQuestion,
  type InterviewReport,
} from "./interview";

export type InterviewSessionStatus = "IN_PROGRESS" | "COMPLETED";

export type InterviewSessionRecord = {
  id: string;
  jobId: string;
  resumeVersionId: string | null;
  mode: InterviewMode;
  status: InterviewSessionStatus;
  context: InterviewContext;
  questions: InterviewQuestion[];
  answers: InterviewAnswers;
  feedback: InterviewReport | null;
  legacyFeedback?: Record<string, string> | null;
  currentQuestionIndex: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type CreateSessionInput = {
  jobId: string;
  resumeVersionId: string | null;
  mode: InterviewMode;
  context: InterviewContext;
};

type SaveProgressInput = {
  answer?: InterviewAnswer;
  currentQuestionIndex?: number;
};

export type InterviewRepository = {
  create(
    input: Omit<InterviewSessionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<InterviewSessionRecord>;
  findById(id: string): Promise<InterviewSessionRecord | null>;
  saveProgress(
    id: string,
    input: Pick<InterviewSessionRecord, "answers"> & Partial<Pick<InterviewSessionRecord, "currentQuestionIndex">>,
  ): Promise<InterviewSessionRecord>;
  complete(id: string, feedback: InterviewReport): Promise<InterviewSessionRecord>;
  deleteSession(id: string): Promise<void>;
  clearSessions(): Promise<number>;
};

export function createInterviewService(dependencies: {
  repository: InterviewRepository;
  generateQuestions(input: CreateSessionInput): Promise<InterviewQuestion[]>;
  generateReport(session: InterviewSessionRecord): Promise<InterviewReport>;
}) {
  return {
    async createSession(input: CreateSessionInput) {
      const generated = await dependencies.generateQuestions(input);
      const questions = parseInterviewQuestionPack(input.mode, { questions: generated });
      return dependencies.repository.create({
        jobId: input.jobId,
        resumeVersionId: input.resumeVersionId,
        mode: input.mode,
        status: "IN_PROGRESS",
        context: input.context,
        questions,
        answers: {},
        feedback: null,
        currentQuestionIndex: 0,
        completedAt: null,
      });
    },

    async getSession(id: string) {
      return requireSession(dependencies.repository, id);
    },

    async saveProgress(id: string, input: SaveProgressInput) {
      const session = await requireSession(dependencies.repository, id);
      if (session.status === "COMPLETED") throw new Error("已完成的面试记录不能继续修改。");
      const answers = input.answer ? mergeInterviewAnswer(session.answers, input.answer) : session.answers;
      const lastIndex = Math.max(0, session.questions.length - 1);
      const currentQuestionIndex = input.currentQuestionIndex === undefined
        ? undefined
        : Math.max(0, Math.min(input.currentQuestionIndex, lastIndex));
      return dependencies.repository.saveProgress(id, {
        answers,
        ...(currentQuestionIndex === undefined ? {} : { currentQuestionIndex }),
      });
    },

    async finishSession(id: string) {
      const session = await requireSession(dependencies.repository, id);
      if (session.status === "COMPLETED" && session.feedback) return session;
      const hasAnswer = Object.values(session.answers).some(
        (answer) => !answer.skipped && Boolean(answer.content.trim()),
      );
      if (!hasAnswer) throw new Error("请至少完成一道题后再生成复盘报告。");
      const feedback = interviewReportSchema.parse(await dependencies.generateReport(session));
      return dependencies.repository.complete(id, feedback);
    },

    async deleteSession(id: string) {
      await requireSession(dependencies.repository, id);
      await dependencies.repository.deleteSession(id);
    },

    async clearSessions() {
      return dependencies.repository.clearSessions();
    },
  };
}

async function requireSession(repository: InterviewRepository, id: string) {
  const session = await repository.findById(id);
  if (!session) throw new Error("未找到这次面试练习。");
  return session;
}
