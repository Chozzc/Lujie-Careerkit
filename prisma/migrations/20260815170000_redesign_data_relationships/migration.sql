PRAGMA foreign_keys=OFF;

-- Each ordinary resume card becomes its own Resume root. Optimized versions
-- remain attached to the root whose saved content matches their base snapshot.
INSERT OR IGNORE INTO "Resume" ("id", "name", "content", "createdAt", "updatedAt")
SELECT
  'resume-' || "id",
  "name",
  "content",
  "createdAt",
  "updatedAt"
FROM "ResumeVersion"
WHERE "jobId" IS NULL
  AND json_type("content", '$._tailoringBaseResume') IS NULL;

UPDATE "ResumeVersion"
SET "resumeId" = 'resume-' || "id"
WHERE "jobId" IS NULL
  AND json_type("content", '$._tailoringBaseResume') IS NULL;

UPDATE "ResumeVersion" AS optimized
SET "resumeId" = (
  SELECT base."resumeId"
  FROM "ResumeVersion" AS base
  WHERE base."jobId" IS NULL
    AND json_type(base."content", '$._tailoringBaseResume') IS NULL
    AND json(base."content") = json_extract(optimized."content", '$._tailoringBaseResume')
  LIMIT 1
)
WHERE json_type(optimized."content", '$._tailoringBaseResume') = 'object'
  AND EXISTS (
    SELECT 1
    FROM "ResumeVersion" AS base
    WHERE base."jobId" IS NULL
      AND json_type(base."content", '$._tailoringBaseResume') IS NULL
      AND json(base."content") = json_extract(optimized."content", '$._tailoringBaseResume')
  );

DELETE FROM "Resume"
WHERE NOT EXISTS (
  SELECT 1 FROM "ResumeVersion" WHERE "ResumeVersion"."resumeId" = "Resume"."id"
);

-- The former interview assistant reused one fixed Job and overwrote its JD.
-- Give every affected artifact an independent, immutable job record first.
INSERT OR IGNORE INTO "Job" (
  "id", "company", "title", "city", "source", "jd", "link", "deadline",
  "tags", "analysis", "createdAt", "updatedAt"
)
SELECT
  'interview-preparation-job-' || "id",
  COALESCE(NULLIF(json_extract("content", '$.meta.company'), ''), '目标公司'),
  COALESCE(NULLIF(json_extract("content", '$.meta.title'), ''), '目标岗位'),
  '', '面试助手', COALESCE(json_extract("context", '$.jd'), ''), '', NULL,
  '[]', NULL, "createdAt", "updatedAt"
FROM "InterviewPreparation"
WHERE "jobId" = 'interview-draft-job';

UPDATE "InterviewPreparation"
SET "jobId" = 'interview-preparation-job-' || "id"
WHERE "jobId" = 'interview-draft-job';

INSERT OR IGNORE INTO "Job" (
  "id", "company", "title", "city", "source", "jd", "link", "deadline",
  "tags", "analysis", "createdAt", "updatedAt"
)
SELECT
  'interview-session-job-' || "id",
  COALESCE(NULLIF(json_extract("context", '$.company'), ''), '目标公司'),
  COALESCE(NULLIF(json_extract("context", '$.title'), ''), '目标岗位'),
  '', '面试助手', COALESCE(json_extract("context", '$.jd'), ''), '', NULL,
  '[]', NULL, "createdAt", "updatedAt"
FROM "InterviewSession"
WHERE "jobId" = 'interview-draft-job'
  AND NOT EXISTS (
    SELECT 1 FROM "Job"
    WHERE "Job"."source" = '面试助手'
      AND "Job"."jd" = COALESCE(json_extract("InterviewSession"."context", '$.jd'), '')
  );

UPDATE "InterviewSession"
SET "jobId" = (
  SELECT "Job"."id" FROM "Job"
  WHERE "Job"."source" = '面试助手'
    AND "Job"."jd" = COALESCE(json_extract("InterviewSession"."context", '$.jd'), '')
  LIMIT 1
)
WHERE "jobId" = 'interview-draft-job';

DELETE FROM "Job" WHERE "id" = 'interview-draft-job';

ALTER TABLE "Resume" DROP COLUMN "content";
ALTER TABLE "Job" DROP COLUMN "tags";

-- READY rows were created by JD matching even when the user never applied.
DELETE FROM "Application" WHERE "status" = 'READY';

CREATE UNIQUE INDEX IF NOT EXISTS "Application_jobId_key" ON "Application"("jobId");
CREATE INDEX IF NOT EXISTS "Application_resumeVersionId_idx" ON "Application"("resumeVersionId");
CREATE INDEX IF NOT EXISTS "Application_updatedAt_idx" ON "Application"("updatedAt");
CREATE INDEX IF NOT EXISTS "Resume_updatedAt_idx" ON "Resume"("updatedAt");
CREATE INDEX IF NOT EXISTS "ResumeVersion_resumeId_idx" ON "ResumeVersion"("resumeId");
CREATE INDEX IF NOT EXISTS "ResumeVersion_jobId_idx" ON "ResumeVersion"("jobId");
CREATE INDEX IF NOT EXISTS "ResumeVersion_updatedAt_idx" ON "ResumeVersion"("updatedAt");
CREATE INDEX IF NOT EXISTS "Job_company_idx" ON "Job"("company");
CREATE INDEX IF NOT EXISTS "Job_createdAt_idx" ON "Job"("createdAt");

ALTER TABLE "InterviewSession" RENAME TO "_InterviewSession_old";
CREATE TABLE "InterviewSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "mode" TEXT NOT NULL DEFAULT 'comprehensive',
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "context" JSONB,
  "questions" JSONB NOT NULL,
  "answers" JSONB NOT NULL,
  "feedback" JSONB NOT NULL,
  "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME,
  "jobId" TEXT,
  "resumeVersionId" TEXT,
  CONSTRAINT "InterviewSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InterviewSession_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "InterviewSession" (
  "id", "mode", "status", "context", "questions", "answers", "feedback",
  "currentQuestionIndex", "createdAt", "updatedAt", "completedAt", "jobId", "resumeVersionId"
)
SELECT
  "id", "mode", "status", "context", "questions", "answers", "feedback",
  "currentQuestionIndex", "createdAt", "updatedAt", "completedAt", "jobId", "resumeVersionId"
FROM "_InterviewSession_old";
DROP TABLE "_InterviewSession_old";
CREATE INDEX "InterviewSession_jobId_idx" ON "InterviewSession"("jobId");
CREATE INDEX "InterviewSession_resumeVersionId_idx" ON "InterviewSession"("resumeVersionId");
CREATE INDEX "InterviewSession_createdAt_idx" ON "InterviewSession"("createdAt");

ALTER TABLE "InterviewPreparation" RENAME TO "_InterviewPreparation_old";
CREATE TABLE "InterviewPreparation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "mode" TEXT NOT NULL DEFAULT 'comprehensive',
  "context" JSONB NOT NULL,
  "content" JSONB NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "jobId" TEXT,
  "resumeVersionId" TEXT,
  CONSTRAINT "InterviewPreparation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InterviewPreparation_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "InterviewPreparation" (
  "id", "mode", "context", "content", "createdAt", "updatedAt", "jobId", "resumeVersionId"
)
SELECT
  "id", "mode", "context", "content", "createdAt", "updatedAt", "jobId", "resumeVersionId"
FROM "_InterviewPreparation_old";
DROP TABLE "_InterviewPreparation_old";
CREATE INDEX "InterviewPreparation_jobId_idx" ON "InterviewPreparation"("jobId");
CREATE INDEX "InterviewPreparation_resumeVersionId_idx" ON "InterviewPreparation"("resumeVersionId");
CREATE INDEX "InterviewPreparation_createdAt_idx" ON "InterviewPreparation"("createdAt");

UPDATE "Settings"
SET
  "aiModel" = CASE WHEN "aiModel" = '' THEN "model" ELSE "aiModel" END,
  "aiBaseUrl" = CASE WHEN "aiBaseUrl" = '' THEN "baseUrl" ELSE "aiBaseUrl" END;
ALTER TABLE "Settings" DROP COLUMN "provider";
ALTER TABLE "Settings" DROP COLUMN "model";
ALTER TABLE "Settings" DROP COLUMN "baseUrl";

DROP TABLE IF EXISTS "DeletedSeedResumeVersion";
DROP TABLE IF EXISTS "FollowUpLog";

PRAGMA foreign_keys=ON;
