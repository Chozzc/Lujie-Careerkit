export type ApplicationStatus =
  | "READY"
  | "APPLIED"
  | "ASSESSMENT"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "ARCHIVED";

export type InterviewRound = "" | "FIRST" | "SECOND" | "THIRD" | "HR";
export type ApplicationPriority = "HIGH" | "NORMAL" | "LOW";

export type ResumeContent = {
  editor?: ResumeEditorSettings;
  basics: {
    name: string;
    email: string;
    phone: string;
    city: string;
    links: string[];
  };
  profile: {
    title: string;
    summary: string;
  };
  education: Array<{
    school: string;
    degree: string;
    major: string;
    start: string;
    end: string;
    highlights: string[];
  }>;
  experiences: Array<{
    company: string;
    role: string;
    start: string;
    end: string;
    highlights: string[];
  }>;
  internships: Array<{
    company: string;
    role: string;
    start: string;
    end: string;
    highlights: string[];
  }>;
  projects: Array<{
    name: string;
    role: string;
    highlights: string[];
  }>;
  skills: string[];
  awards: string[];
  selfReview: string;
};

export type ResumeEditorSettings = {
  displayName?: string;
  template?: string;
  themeConfig?: {
    primaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    fontSize?: string;
    lineSpacing?: number;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    sectionSpacing?: number;
    avatarStyle?: "circle" | "oneInch";
  };
};

export type JobAnalysis = {
  company: string;
  title: string;
  deadline: string | null;
  requirements: string[];
  keywords: string[];
  bonusPoints: string[];
  risks: string[];
  suggestions: string[];
};

export type JobRecord = {
  id: string;
  company: string;
  title: string;
  deadline: string | null;
  jd: string;
};

export type ApplicationRecord = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  interviewRound?: InterviewRound;
  resumeVersionId: string | null;
  appliedAt: string | null;
  stageDate: string | null;
  priority: ApplicationPriority;
  nextFollowUpAt: string | null;
  notes: string;
};
