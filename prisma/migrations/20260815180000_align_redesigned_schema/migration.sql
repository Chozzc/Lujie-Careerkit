-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "appliedAt" DATETIME,
    "stageDate" DATETIME,
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
INSERT INTO "new_Application" ("appliedAt", "createdAt", "id", "interviewRound", "jobId", "nextFollowUpAt", "notes", "resumeVersionId", "stageDate", "status", "updatedAt") SELECT "appliedAt", "createdAt", "id", "interviewRound", "jobId", "nextFollowUpAt", "notes", "resumeVersionId", "stageDate", "status", "updatedAt" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE INDEX "Application_resumeVersionId_idx" ON "Application"("resumeVersionId");
CREATE INDEX "Application_updatedAt_idx" ON "Application"("updatedAt");
CREATE UNIQUE INDEX "Application_jobId_key" ON "Application"("jobId");
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "jd" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "deadline" DATETIME,
    "analysis" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Job" ("analysis", "city", "company", "createdAt", "deadline", "id", "jd", "link", "source", "title", "updatedAt") SELECT "analysis", "city", "company", "createdAt", "deadline", "id", "jd", "link", "source", "title", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_company_idx" ON "Job"("company");
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");
CREATE TABLE "new_Resume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Resume" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Resume";
DROP TABLE "Resume";
ALTER TABLE "new_Resume" RENAME TO "Resume";
CREATE INDEX "Resume_updatedAt_idx" ON "Resume"("updatedAt");
CREATE TABLE "new_ResumeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT,
    CONSTRAINT "ResumeVersion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResumeVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ResumeVersion" ("content", "createdAt", "id", "jobId", "name", "resumeId", "summary", "updatedAt") SELECT "content", "createdAt", "id", "jobId", "name", "resumeId", "summary", "updatedAt" FROM "ResumeVersion";
DROP TABLE "ResumeVersion";
ALTER TABLE "new_ResumeVersion" RENAME TO "ResumeVersion";
CREATE INDEX "ResumeVersion_resumeId_idx" ON "ResumeVersion"("resumeId");
CREATE INDEX "ResumeVersion_jobId_idx" ON "ResumeVersion"("jobId");
CREATE INDEX "ResumeVersion_updatedAt_idx" ON "ResumeVersion"("updatedAt");
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "aiProvider" TEXT NOT NULL DEFAULT 'deepseek',
    "aiModel" TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
    "aiBaseUrl" TEXT NOT NULL DEFAULT 'https://api.deepseek.com/v1',
    "aiApiKey" TEXT NOT NULL DEFAULT '',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiTemperature" REAL NOT NULL DEFAULT 0.3,
    "aiLastTestedAt" DATETIME,
    "aiLastTestStatus" TEXT NOT NULL DEFAULT 'untested',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("aiApiKey", "aiBaseUrl", "aiEnabled", "aiLastTestStatus", "aiLastTestedAt", "aiModel", "aiProvider", "aiTemperature", "id", "updatedAt") SELECT "aiApiKey", "aiBaseUrl", "aiEnabled", "aiLastTestStatus", "aiLastTestedAt", "aiModel", "aiProvider", "aiTemperature", "id", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
