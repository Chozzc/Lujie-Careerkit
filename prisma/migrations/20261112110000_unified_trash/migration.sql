ALTER TABLE "ResumeVersion" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Application" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "InterviewSession" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "InterviewPreparation" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "AgentThread" ADD COLUMN "deletedAt" DATETIME;
CREATE TABLE "TrashSnapshot" ("id" TEXT NOT NULL PRIMARY KEY, "kind" TEXT NOT NULL, "recordId" TEXT NOT NULL, "name" TEXT NOT NULL, "content" JSONB NOT NULL, "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "TrashSnapshot_deletedAt_idx" ON "TrashSnapshot"("deletedAt");
