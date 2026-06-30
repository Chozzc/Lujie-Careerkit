import {
  generateInterviewQuestionPackWithAI,
  generateInterviewReportWithAI,
} from "./ai/interview-tasks";
import { createInterviewService } from "./interview-service";
import { getEffectiveAiRuntimeSettings, interviewSessionRepository } from "./repository";

export const interviewService = createInterviewService({
  repository: interviewSessionRepository,
  async generateQuestions(input) {
    const settings = await getEffectiveAiRuntimeSettings();
    const result = await generateInterviewQuestionPackWithAI(settings, {
      mode: input.mode,
      company: input.context.company,
      title: input.context.title,
      jd: input.context.jd,
      resume: input.context.resume,
    });
    if (result.source !== "ai") throw new Error(result.message);
    return result.data.questions;
  },
  async generateReport(session) {
    const settings = await getEffectiveAiRuntimeSettings();
    const result = await generateInterviewReportWithAI(settings, {
      context: session.context,
      questions: session.questions,
      answers: session.answers,
    });
    if (result.source !== "ai") throw new Error(result.message);
    return result.data;
  },
});
