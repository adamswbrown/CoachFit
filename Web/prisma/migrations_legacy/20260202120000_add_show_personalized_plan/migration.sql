-- Add showPersonalizedPlan flag to SystemSettings
ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "showPersonalizedPlan" BOOLEAN NOT NULL DEFAULT true;
