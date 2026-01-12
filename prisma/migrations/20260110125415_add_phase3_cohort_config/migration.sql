-- Add custom responses to Entry (PostgreSQL JSONB)
ALTER TABLE "Entry"
  ADD COLUMN "customResponses" JSONB;

-- Create cohort check-in config table
CREATE TABLE "CohortCheckInConfig" (
  "id" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "enabledPrompts" TEXT[],
  "customPrompt1" TEXT,
  "customPrompt1Type" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CohortCheckInConfig_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint and index
CREATE UNIQUE INDEX "CohortCheckInConfig_cohortId_key" ON "CohortCheckInConfig"("cohortId");
CREATE INDEX "CohortCheckInConfig_cohortId_idx" ON "CohortCheckInConfig"("cohortId");

-- Add foreign key
ALTER TABLE "CohortCheckInConfig" 
  ADD CONSTRAINT "CohortCheckInConfig_cohortId_fkey" 
  FOREIGN KEY ("cohortId") 
  REFERENCES "Cohort"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;
