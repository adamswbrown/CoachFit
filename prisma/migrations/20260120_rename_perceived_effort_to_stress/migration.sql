-- Rename perceivedEffort column to perceivedStress (if it exists)
-- This handles the case where the column may have already been renamed or doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Entry' AND column_name = 'perceivedEffort'
  ) THEN
    ALTER TABLE "Entry" RENAME COLUMN "perceivedEffort" TO "perceivedStress";
  END IF;
END $$;

-- Drop and recreate the check constraint with new name (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'Entry' AND constraint_name = 'perceivedEffort_range'
  ) THEN
    ALTER TABLE "Entry" DROP CONSTRAINT "perceivedEffort_range";
  END IF;
END $$;

-- Add the new constraint (if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'Entry' AND constraint_name = 'perceivedStress_range'
  ) THEN
    ALTER TABLE "Entry" ADD CONSTRAINT "perceivedStress_range" CHECK ("perceivedStress" IS NULL OR ("perceivedStress" >= 1 AND "perceivedStress" <= 10));
  END IF;
END $$;
