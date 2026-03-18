DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CohortType') THEN
    CREATE TYPE "CohortType" AS ENUM ('TIMED','ONGOING','CHALLENGE','CUSTOM');
  END IF;
END $$;

ALTER TABLE "Cohort"
  ADD COLUMN IF NOT EXISTS "type" "CohortType",
  ADD COLUMN IF NOT EXISTS "customTypeLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "customCohortTypeId" TEXT;

CREATE TABLE IF NOT EXISTS "CustomCohortType" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomCohortType_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomCohortType_createdBy_fkey') THEN
    ALTER TABLE "CustomCohortType"
      ADD CONSTRAINT "CustomCohortType_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cohort_customCohortTypeId_fkey') THEN
    ALTER TABLE "Cohort"
      ADD CONSTRAINT "Cohort_customCohortTypeId_fkey" FOREIGN KEY ("customCohortTypeId") REFERENCES "CustomCohortType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CustomCohortType_label_key" ON "CustomCohortType"("label");
CREATE INDEX IF NOT EXISTS "CustomCohortType_createdBy_idx" ON "CustomCohortType"("createdBy");
CREATE INDEX IF NOT EXISTS "CustomCohortType_createdAt_idx" ON "CustomCohortType"("createdAt");
