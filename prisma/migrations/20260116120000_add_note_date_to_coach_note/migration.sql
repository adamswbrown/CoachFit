-- AlterTable
-- First add column as nullable
ALTER TABLE "CoachNote" ADD COLUMN "noteDate" DATE;

-- Set noteDate to weekStart for existing notes
UPDATE "CoachNote" SET "noteDate" = "weekStart" WHERE "noteDate" IS NULL;

-- Now make it NOT NULL with default
ALTER TABLE "CoachNote" ALTER COLUMN "noteDate" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CoachNote_noteDate_idx" ON "CoachNote"("noteDate");
