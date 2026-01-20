-- Rename perceivedEffort column to perceivedStress
ALTER TABLE "Entry" RENAME COLUMN "perceivedEffort" TO "perceivedStress";

-- Drop and recreate the check constraint with new name
ALTER TABLE "Entry" DROP CONSTRAINT "perceivedEffort_range";
ALTER TABLE "Entry" ADD CONSTRAINT "perceivedStress_range" CHECK ("perceivedStress" IS NULL OR ("perceivedStress" >= 1 AND "perceivedStress" <= 10));
