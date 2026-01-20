-- CreateTable
CREATE TABLE IF NOT EXISTS "QuestionnaireBundle" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "bundleJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyQuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "responseJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyQuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN IF NOT EXISTS "cohortStartDate" DATE;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionnaireBundle_cohortId_key" ON "QuestionnaireBundle"("cohortId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuestionnaireBundle_cohortId_idx" ON "QuestionnaireBundle"("cohortId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyQuestionnaireResponse_userId_idx" ON "WeeklyQuestionnaireResponse"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyQuestionnaireResponse_cohortId_idx" ON "WeeklyQuestionnaireResponse"("cohortId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyQuestionnaireResponse_cohortId_weekNumber_idx" ON "WeeklyQuestionnaireResponse"("cohortId", "weekNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WeeklyQuestionnaireResponse_status_idx" ON "WeeklyQuestionnaireResponse"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyQuestionnaireResponse_userId_cohortId_weekNumber_key" ON "WeeklyQuestionnaireResponse"("userId", "cohortId", "weekNumber");

-- AddForeignKey
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QuestionnaireBundle_cohortId_fkey'
  ) THEN
    ALTER TABLE "QuestionnaireBundle" ADD CONSTRAINT "QuestionnaireBundle_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyQuestionnaireResponse_userId_fkey'
  ) THEN
    ALTER TABLE "WeeklyQuestionnaireResponse" ADD CONSTRAINT "WeeklyQuestionnaireResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyQuestionnaireResponse_cohortId_fkey'
  ) THEN
    ALTER TABLE "WeeklyQuestionnaireResponse" ADD CONSTRAINT "WeeklyQuestionnaireResponse_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
