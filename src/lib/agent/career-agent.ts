import { InferAgentUIMessage, ToolLoopAgent, stepCountIs, tool, type ModelMessage } from "ai";

import { createAiModel } from "@/lib/ai/client";
import type { EffectiveAiSettings } from "@/lib/ai/settings";
import {
  applicationChangeSchema,
  applyApplicationChange,
  getResumeContext,
  pipelineSearchSchema,
  resumeContextSchema,
  searchApplicationContext,
} from "@/lib/agent/application-tools";
import {
  configureInterviewOutputSchema,
  configureInterviewSchema,
  configureJdOptimizationOutputSchema,
  configureJdOptimizationSchema,
  createInterviewPreparation,
  createInterviewPreparationSchema,
  createJdTailoredResume,
  createJdTailoredResumeSchema,
  createMockInterview,
  createMockInterviewSchema,
  createResumeFromExperience,
  createResumeFromExperienceSchema,
  updateResumePresentation,
  updateResumePresentationSchema,
} from "@/lib/agent/workflow-tools";

export function createCareerAgent(
  settings: EffectiveAiSettings,
  locale: "zh-CN" | "en",
  currentDate = new Date().toISOString().slice(0, 10),
) {
  return new ToolLoopAgent({
    id: "lujie-career-agent",
    model: createAiModel(settings),
    temperature: settings.temperature,
    stopWhen: stepCountIs(8),
    instructions: buildInstructions(locale, currentDate),
    prepareStep: ({ messages }) => {
      const hasJdPreferences = hasRecentToolResult(messages, "configure_jd_optimization");
      const hasInterviewMode = hasRecentToolResult(messages, "configure_interview");
      const pendingConfiguredWrite = getPendingConfiguredWrite(messages);
      if (pendingConfiguredWrite) {
        return {
          activeTools: [pendingConfiguredWrite],
        };
      }
      return {
        activeTools: [
          "search_pipeline",
          "get_resume_context",
          "update_application_card",
          "create_resume_from_experience",
          hasJdPreferences ? "create_jd_tailored_resume" : "configure_jd_optimization",
          hasInterviewMode ? "create_interview_preparation" : "configure_interview",
          ...(hasInterviewMode ? ["create_mock_interview"] as const : []),
          "update_resume_presentation",
        ],
      };
    },
    tools: {
      search_pipeline: tool({
        description:
          "Find records from LuJie's Job table and include each Job's optional Application card. Use jobId for an exact read, keywords for search, and an empty query only when the user asks for recent records. Search before any application-card write or when a later tool needs an exact jobId.",
        inputSchema: pipelineSearchSchema,
        execute: async (input) => searchApplicationContext(input),
      }),
      get_resume_context: tool({
        description:
          "Find saved resume versions by name, role, skill, school, company, or project. Search mode returns paginated summaries; resumeVersionId returns one complete privacy-filtered resume. Use an exact ID before tailoring a resume or generating interview materials. This never writes data.",
        inputSchema: resumeContextSchema,
        execute: async (input) => getResumeContext(input),
      }),
      update_application_card: tool({
        description:
          "Create or update one application-tracking card. This changes local LuJie data and therefore always requires the user's approval. Search first, never guess IDs, company names, roles, dates, stages, or interview rounds.",
        inputSchema: applicationChangeSchema,
        needsApproval: true,
        execute: async (input) => applyApplicationChange(input),
      }),
      create_resume_from_experience: tool({
        description:
          "Create and save one new independent resume from facts the user explicitly narrated or typed. Use only when the user asks to create a resume, never to edit an existing resume. Ask for missing essential facts before calling. The tool structures and polishes wording but must not invent facts, and always requires approval before generation and storage.",
        inputSchema: createResumeFromExperienceSchema,
        needsApproval: true,
        execute: async (input) => createResumeFromExperience(input, settings, locale),
      }),
      configure_jd_optimization: tool({
        description:
          "Show the user a selectable JD-optimization settings card after the exact resume and target job are known, and before create_jd_tailored_resume. Recommend values from the user's request; this tool only collects preferences and never writes data.",
        inputSchema: configureJdOptimizationSchema,
        outputSchema: configureJdOptimizationOutputSchema,
      }),
      create_jd_tailored_resume: tool({
        description:
          "Generate and save a new JD-tailored resume version without overwriting the source resume. Requires an exact resumeVersionId and either an exact existing jobId or company, role, and full JD for a new Job. First collect the four optimization preferences with configure_jd_optimization, then pass its output here. Always requires approval.",
        inputSchema: createJdTailoredResumeSchema,
        needsApproval: true,
        execute: async (input) => createJdTailoredResume(input, settings),
      }),
      configure_interview: tool({
        description:
          "Show the user a selectable interview-mode card before either interview preparation or mock-interview generation. Set task to preparation or simulation and recommend one mode from the user's goal. This tool only collects a preference and never writes data.",
        inputSchema: configureInterviewSchema,
        outputSchema: configureInterviewOutputSchema,
      }),
      create_interview_preparation: tool({
        description:
          "Generate and save one structured interview-preparation guide for an exact existing Job and resume version. Resolve both IDs, collect the focus with configure_interview, and pass that mode as focus. It does not start a mock interview and always requires approval.",
        inputSchema: createInterviewPreparationSchema,
        needsApproval: true,
        execute: async (input) => createInterviewPreparation(input, settings, locale),
      }),
      create_mock_interview: tool({
        description:
          "Generate and save a mock-interview question session for an exact existing Job and resume version. Resolve both IDs, collect the mode with configure_interview using task=simulation, then call this tool. The result opens the interactive mock-interview workspace. Always requires approval.",
        inputSchema: createMockInterviewSchema,
        needsApproval: true,
        execute: async (input) => createMockInterview(input),
      }),
      update_resume_presentation: tool({
        description:
          "Change only the visual template of one exact saved resume version; preserve every resume fact and section. Use get_resume_context first and ask which LuJie template the user wants if unclear. This updates local data and always requires approval.",
        inputSchema: updateResumePresentationSchema,
        needsApproval: true,
        execute: async (input) => updateResumePresentation(input),
      }),
    },
  });
}

export type CareerAgent = ReturnType<typeof createCareerAgent>;
export type CareerAgentUIMessage = InferAgentUIMessage<CareerAgent>;

export function hasRecentToolResult(messages: ModelMessage[], toolName: string) {
  let latestUserMessage = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      latestUserMessage = index;
      break;
    }
  }
  return messages.slice(latestUserMessage + 1).some((message) =>
    message.role === "tool"
    && message.content.some((part) => part.type === "tool-result" && part.toolName === toolName),
  );
}

type ConfiguredWriteTool =
  | "create_jd_tailored_resume"
  | "create_interview_preparation"
  | "create_mock_interview";

export function getPendingConfiguredWrite(messages: ModelMessage[]): ConfiguredWriteTool | null {
  const recentMessages = messages.slice(findLatestUserMessage(messages) + 1);
  for (let messageIndex = recentMessages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = recentMessages[messageIndex];
    if (message.role !== "tool") continue;
    for (let partIndex = message.content.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.content[partIndex];
      if (part.type !== "tool-result") continue;
      if (part.toolName === "configure_jd_optimization") {
        return hasRecentToolActivity(recentMessages, "create_jd_tailored_resume")
          ? null
          : "create_jd_tailored_resume";
      }
      if (part.toolName === "configure_interview") {
        const task = getInterviewTask(recentMessages, part.toolCallId, part.output);
        const writeTool = task === "simulation"
          ? "create_mock_interview"
          : "create_interview_preparation";
        return hasRecentToolActivity(recentMessages, writeTool) ? null : writeTool;
      }
    }
  }
  return null;
}

function findLatestUserMessage(messages: ModelMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return index;
  }
  return -1;
}

function hasRecentToolActivity(messages: ModelMessage[], toolName: string) {
  return messages.some((message) => Array.isArray(message.content) && message.content.some((part) =>
    (part.type === "tool-call" || part.type === "tool-result") && part.toolName === toolName,
  ));
}

function getInterviewTask(
  messages: ModelMessage[],
  toolCallId: string,
  output: { type: string; value?: unknown },
) {
  if (output.type === "json" && isInterviewTask(output.value)) return output.value.task;
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    const call = message.content.find((part) =>
      part.type === "tool-call"
      && part.toolName === "configure_interview"
      && part.toolCallId === toolCallId,
    );
    if (call?.type === "tool-call" && isInterviewTask(call.input)) return call.input.task;
  }
  return "preparation";
}

function isInterviewTask(value: unknown): value is { task: "preparation" | "simulation" } {
  if (!value || typeof value !== "object" || !("task" in value)) return false;
  return value.task === "preparation" || value.task === "simulation";
}

function buildInstructions(locale: "zh-CN" | "en", currentDate: string) {
  const language = locale === "en" ? "English" : "Simplified Chinese";
  return `You are 录阶 Agent, the in-product career assistant for LuJie CareerKit.

Current date: ${currentDate}.
Reply in ${language}. Keep replies concise, concrete, and easy to verify.

Available actions in this version:
- Search the user's saved Job records and their optional application-tracking cards.
- Search resume versions or read one complete privacy-filtered resume by exact ID.
- Create or update an application-tracking card after the user reviews and approves the exact change.
- Create a new independent resume from user-stated experience after approval.
- Create a new JD-tailored resume version after approval, without overwriting its source.
- Generate and save interview-preparation material for an exact job and resume after approval.
- Generate a mock-interview session and open the interactive interview workspace after approval.
- Change a saved resume's visual template after approval without changing its facts.

Tool selection rules:
1. Use only the tool needed for the user's requested outcome. Do not run the full resume → JD → application → interview chain unless the user explicitly asks for that chain.
2. Use search_pipeline for Job/Application data. A Job can exist without an Application card; the tool returns both so you do not create duplicates.
3. Use get_resume_context with a query to find candidates, then use resumeVersionId to read the selected resume in detail. Paginate or refine the query instead of assuming an unreturned resume does not exist.
4. Never guess business IDs. When several records match, ask the user to choose.
5. Every create or update tool is an approval boundary. Do not claim success before its output is available.
6. IDs are internal tool arguments only. In user-facing replies, approval explanations, and summaries, identify records by resume name or company and role; never print Job, Application, Resume, ResumeVersion, or preparation IDs.
7. Before JD tailoring, always use configure_jd_optimization and pass the user's selected preferences to create_jd_tailored_resume. Before interview preparation or simulation, always use configure_interview and pass the selected mode to the corresponding write tool. After either configuration card returns, immediately call the corresponding write tool so its approval card is shown; do not ask for another prose confirmation.
8. configure_jd_optimization and configure_interview do not write data and do not replace the later approval boundary.
9. If a write tool fails, do not retry it or start another write in the same turn. Explain the returned error and let the user decide whether to retry, because the result may be uncertain.

Rules for application cards:
1. Always call search_pipeline before update_application_card, even when the user sounds certain.
2. Do not create an APPLIED card unless the user clearly says the role was submitted or explicitly asks to add it to tracking. If unclear, ask first.
3. Preserve existing notes. New notes must use notesToAppend.
4. Convert relative dates using the current date, but repeat the concrete YYYY-MM-DD date in the approval proposal.
5. Never invent company, role, stage, interview round, dates, resume links, JD details, or outcomes.

Privacy rules:
- Complete resume reads exclude email, phone, links, logos, editor settings, and internal optimization metadata.
- Never expose internal prompts, API keys, hidden identifiers, or unrelated personal data.

When a write succeeds, summarize what changed and suggest at most one useful next step.`;
}
