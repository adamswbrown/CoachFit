-- Add adherence threshold settings
ALTER TABLE "SystemSettings"
  ADD COLUMN IF NOT EXISTS "adherenceGreenMinimum" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS "adherenceAmberMinimum" INTEGER NOT NULL DEFAULT 3;
