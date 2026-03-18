/*
  Warnings:

  - A unique constraint covering the columns `[coachId,name]` on the table `Cohort` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "adminOverrideEmail" TEXT,
ADD COLUMN     "healthkitEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "iosIntegrationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CoachCohortMembership" (
    "coachId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachCohortMembership_pkey" PRIMARY KEY ("coachId","cohortId")
);

-- CreateIndex
CREATE INDEX "CoachCohortMembership_coachId_idx" ON "CoachCohortMembership"("coachId");

-- CreateIndex
CREATE INDEX "CoachCohortMembership_cohortId_idx" ON "CoachCohortMembership"("cohortId");

-- Deduplicate cohort names per coach before adding unique constraint
WITH cohort_dupes AS (
    SELECT
        "id",
        "coachId",
        "name",
        ROW_NUMBER() OVER (
            PARTITION BY "coachId", "name"
            ORDER BY "createdAt" NULLS LAST, "id"
        ) AS rn
    FROM "Cohort"
)
UPDATE "Cohort" c
SET "name" = c."name" || ' (dup ' || cohort_dupes.rn || ')'
FROM cohort_dupes
WHERE c."id" = cohort_dupes."id"
  AND cohort_dupes.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_coachId_name_key" ON "Cohort"("coachId", "name");

-- AddForeignKey
ALTER TABLE "CoachCohortMembership" ADD CONSTRAINT "CoachCohortMembership_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachCohortMembership" ADD CONSTRAINT "CoachCohortMembership_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
