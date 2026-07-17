-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" JSON NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSON NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT,
    CONSTRAINT "ResumeVersion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResumeVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "jd" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "deadline" DATETIME,
    "tags" JSON NOT NULL,
    "analysis" JSON,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "appliedAt" DATETIME,
    "stageDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "nextFollowUpAt" DATETIME,
    "notes" TEXT NOT NULL DEFAULT '',
    "interviewRound" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    "resumeVersionId" TEXT,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUpLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationId" TEXT NOT NULL,
    CONSTRAINT "FollowUpLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL DEFAULT 'comprehensive',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "context" JSON,
    "questions" JSON NOT NULL,
    "answers" JSON NOT NULL,
    "feedback" JSON NOT NULL,
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "jobId" TEXT NOT NULL,
    "resumeVersionId" TEXT,
    CONSTRAINT "InterviewSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterviewSession_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "provider" TEXT NOT NULL DEFAULT 'openai-compatible',
    "model" TEXT NOT NULL DEFAULT 'gpt-5.5',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "aiModel" TEXT NOT NULL DEFAULT 'gpt-5.5',
    "aiBaseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "aiApiKey" TEXT NOT NULL DEFAULT '',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiTemperature" REAL NOT NULL DEFAULT 0.3,
    "aiLastTestedAt" DATETIME,
    "aiLastTestStatus" TEXT NOT NULL DEFAULT 'untested',
    "updatedAt" DATETIME NOT NULL
);
