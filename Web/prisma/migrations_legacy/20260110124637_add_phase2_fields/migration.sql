-- Add new optional fields
ALTER TABLE "Entry"
  ADD COLUMN "sleepQuality" INTEGER,
  ADD COLUMN "perceivedEffort" INTEGER,
  ADD COLUMN "notes" TEXT;

-- Add check constraints for ranges
ALTER TABLE "Entry"
  ADD CONSTRAINT "sleepQuality_range" CHECK ("sleepQuality" IS NULL OR ("sleepQuality" >= 1 AND "sleepQuality" <= 10)),
  ADD CONSTRAINT "perceivedEffort_range" CHECK ("perceivedEffort" IS NULL OR ("perceivedEffort" >= 1 AND "perceivedEffort" <= 10));
