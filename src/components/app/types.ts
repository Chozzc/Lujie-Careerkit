import type { RedactedAiSettings } from "@/lib/ai/settings";
import type { InterviewSessionRecord } from "@/lib/interview-service";
import type { InterviewPreparationRecord } from "@/lib/interview-preparation";
import type { ApplicationStatus, InterviewRound, JobAnalysis, ResumeContent } from "@/lib/types";

export type JobView = {
  id: string;
  isSample?: boolean;
  company: string;
  title: string;
  city: string;
  source: string;
  jd: string;
  link: string;
  deadline: string | null;
  analysis: JobAnalysis | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationView = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  interviewRound: InterviewRound;
  resumeVersionId: string | null;
  appliedAt: string | null;
  stageDate: string | null;
  nextFollowUpAt: string | null;
  notes: string;
  updatedAt: string;
};

export type ResumeVersionView = {
  id: string;
  resumeId: string;
  jobId: string | null;
  name: string;
  summary: string;
  content: ResumeContent;
  createdAt: string;
  updatedAt: string;
};

export type InitialData = {
  resume: { id: string; resumeId: string; name: string; summary: string; content: ResumeContent; updatedAt: string } | null;
  versions: ResumeVersionView[];
  jobs: JobView[];
  applications: ApplicationView[];
  interviews: InterviewSessionRecord[];
  interviewPreparations: InterviewPreparationRecord[];
  settings: {
    ai: RedactedAiSettings;
    updatedAt: string;
  } | null;
};
