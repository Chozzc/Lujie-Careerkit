import type { ApplicationStatus, InterviewRound } from "./types";

export function normalizeApplicationInterviewRound(
  status: ApplicationStatus | undefined,
  value: unknown,
): InterviewRound {
  if (status !== "INTERVIEW") return "";
  return value === "FIRST" || value === "SECOND" || value === "THIRD" || value === "HR" ? value : "FIRST";
}
