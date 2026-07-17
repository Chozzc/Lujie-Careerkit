CREATE TABLE "InterviewPreparation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "mode" TEXT NOT NULL DEFAULT 'comprehensive',
  "resumeKey" TEXT NOT NULL,
  "context" JSON NOT NULL,
  "content" JSON NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "jobId" TEXT NOT NULL,
  "resumeVersionId" TEXT,
  CONSTRAINT "InterviewPreparation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InterviewPreparation_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
