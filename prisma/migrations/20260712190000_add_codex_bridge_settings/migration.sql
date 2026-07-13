ALTER TABLE "Settings" ADD COLUMN "aiRuntimeMode" TEXT NOT NULL DEFAULT 'api';
ALTER TABLE "Settings" ADD COLUMN "codexModel" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Settings" ADD COLUMN "codexReasoning" TEXT NOT NULL DEFAULT 'medium';
