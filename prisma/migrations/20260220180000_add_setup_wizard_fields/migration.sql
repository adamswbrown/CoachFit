-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN "setupComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSettings" ADD COLUMN "organisationName" TEXT NOT NULL DEFAULT 'CoachFit';
ALTER TABLE "SystemSettings" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "SystemSettings" ADD COLUMN "unitSystem" TEXT NOT NULL DEFAULT 'metric';

-- Mark existing deployments as setup complete so the wizard doesn't trigger
UPDATE "SystemSettings" SET "setupComplete" = true WHERE "setupComplete" = false;
