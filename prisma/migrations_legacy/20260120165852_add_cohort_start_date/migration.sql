-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN IF NOT EXISTS "cohortStartDate" DATE,
ADD COLUMN     "durationConfig" TEXT NOT NULL DEFAULT 'six-week',
ADD COLUMN     "durationWeeks" INTEGER;

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "bodyFatPercentage" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "bodyFatHighPercent" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
ADD COLUMN     "bodyFatLowPercent" DOUBLE PRECISION NOT NULL DEFAULT 12.5,
ADD COLUMN     "bodyFatMediumPercent" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
ADD COLUMN     "bodyFatVeryHighPercent" DOUBLE PRECISION NOT NULL DEFAULT 37.5,
ADD COLUMN     "defaultCarbsPercent" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
ADD COLUMN     "defaultFatPercent" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
ADD COLUMN     "defaultProteinPercent" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
ADD COLUMN     "maxDailyCalories" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "maxProteinPerLb" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
ADD COLUMN     "minDailyCalories" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "minProteinPerLb" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
ADD COLUMN     "stepsHeavy" INTEGER NOT NULL DEFAULT 12500,
ADD COLUMN     "stepsLight" INTEGER NOT NULL DEFAULT 7500,
ADD COLUMN     "stepsModerate" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "stepsNotMuch" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "workoutHeavy" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "workoutLight" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "workoutModerate" INTEGER NOT NULL DEFAULT 225,
ADD COLUMN     "workoutNotMuch" INTEGER NOT NULL DEFAULT 75;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activityLevel" TEXT,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "primaryGoal" TEXT;

-- CreateTable
CREATE TABLE "UserGoals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentWeightKg" DOUBLE PRECISION,
    "targetWeightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "dailyCaloriesKcal" INTEGER,
    "proteinGrams" DOUBLE PRECISION,
    "carbGrams" DOUBLE PRECISION,
    "fatGrams" DOUBLE PRECISION,
    "waterIntakeMl" INTEGER,
    "dailyStepsTarget" INTEGER,
    "weeklyWorkoutMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGoals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightUnit" TEXT NOT NULL DEFAULT 'lbs',
    "measurementUnit" TEXT NOT NULL DEFAULT 'inches',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/dd/yyyy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGoals_userId_key" ON "UserGoals"("userId");

-- CreateIndex
CREATE INDEX "UserGoals_userId_idx" ON "UserGoals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "CoachInvite_coachId_idx" ON "CoachInvite"("coachId");

-- CreateIndex
CREATE INDEX "CoachInvite_email_idx" ON "CoachInvite"("email");

-- CreateIndex
CREATE INDEX "Cohort_coachId_idx" ON "Cohort"("coachId");

-- CreateIndex
CREATE INDEX "Cohort_createdAt_idx" ON "Cohort"("createdAt");

-- CreateIndex
CREATE INDEX "CohortInvite_cohortId_idx" ON "CohortInvite"("cohortId");

-- CreateIndex
CREATE INDEX "CohortInvite_email_idx" ON "CohortInvite"("email");

-- CreateIndex
CREATE INDEX "User_invitedByCoachId_idx" ON "User"("invitedByCoachId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_roles_idx" ON "User"("roles");

-- AddForeignKey
ALTER TABLE "UserGoals" ADD CONSTRAINT "UserGoals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
