-- AlterTable
ALTER TABLE "CoachNote" ADD COLUMN     "sharedAt" TIMESTAMP(3),
ADD COLUMN     "sharedWithClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weekNumber" INTEGER;

