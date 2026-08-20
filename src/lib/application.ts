import type { ApplicationStatus, InterviewRound } from "./types";

export function normalizeApplicationInterviewRound(
  status: ApplicationStatus | undefined,
  value: unknown,
): InterviewRound {
  if (status !== "INTERVIEW") return "";
  return value === "FIRST" || value === "SECOND" || value === "THIRD" || value === "HR" ? value : "FIRST";
}

export function resolveApplicationAppliedAt(input: {
  status?: ApplicationStatus;
  appliedAt?: string | null;
  stageDate?: string | null;
  existingAppliedAt?: Date | null;
  now?: Date;
}) {
  if (input.appliedAt !== undefined) return input.appliedAt ? new Date(input.appliedAt) : null;
  if (input.status !== "APPLIED" || input.existingAppliedAt) return undefined;
  return input.stageDate ? new Date(input.stageDate) : input.now ?? new Date();
}
