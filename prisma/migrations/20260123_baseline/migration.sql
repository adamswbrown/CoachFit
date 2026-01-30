-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'COACH', 'ADMIN');

-- CreateEnum
CREATE TYPE "CohortType" AS ENUM ('TIMED', 'ONGOING', 'CHALLENGE', 'CUSTOM');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "CohortType",
    "customTypeLabel" TEXT,
    "customCohortTypeId" TEXT,
    "cohortStartDate" DATE,
    "durationConfig" TEXT NOT NULL DEFAULT 'six-week',
    "durationWeeks" INTEGER,
    "membershipDurationMonths" INTEGER,
    "checkInFrequencyDays" INTEGER,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachCohortMembership" (
    "coachId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachCohortMembership_pkey" PRIMARY KEY ("coachId","cohortId")
);

-- CreateTable
CREATE TABLE "CohortInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMembership" (
    "userId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,

    CONSTRAINT "CohortMembership_pkey" PRIMARY KEY ("userId","cohortId")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weightLbs" DOUBLE PRECISION,
    "steps" INTEGER,
    "calories" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heightInches" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sleepQuality" INTEGER,
    "perceivedStress" INTEGER,
    "notes" TEXT,
    "customResponses" JSONB,
    "dataSources" JSONB DEFAULT '[]',
    "bodyFatPercentage" DOUBLE PRECISION,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutType" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationSecs" INTEGER NOT NULL,
    "caloriesActive" INTEGER,
    "distanceMeters" DOUBLE PRECISION,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "sourceDevice" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalSleepMins" INTEGER NOT NULL,
    "inBedMins" INTEGER,
    "awakeMins" INTEGER,
    "asleepCoreMins" INTEGER,
    "asleepDeepMins" INTEGER,
    "asleepREMMins" INTEGER,
    "sleepStart" TIMESTAMP(3),
    "sleepEnd" TIMESTAMP(3),
    "sourceDevices" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "clientId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "roles" "Role"[] DEFAULT ARRAY['CLIENT']::"Role"[],
    "isTestUser" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedByCoachId" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "gender" TEXT,
    "dateOfBirth" DATE,
    "activityLevel" TEXT,
    "primaryGoal" TEXT,
    "checkInFrequencyDays" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "CoachNote" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "noteDate" DATE NOT NULL,

    CONSTRAINT "CoachNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyCoachResponse" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "loomUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyCoachResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortCheckInConfig" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "enabledPrompts" TEXT[],
    "customPrompt1" TEXT,
    "customPrompt1Type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortCheckInConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminInsight" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "priority" TEXT NOT NULL DEFAULT 'green',
    "actionable" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AdminInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttentionScore" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT[],
    "metadata" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AttentionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "reason" TEXT,
    "insightId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "maxClientsPerCoach" INTEGER NOT NULL DEFAULT 50,
    "minClientsPerCoach" INTEGER NOT NULL DEFAULT 10,
    "recentActivityDays" INTEGER NOT NULL DEFAULT 14,
    "lowEngagementEntries" INTEGER NOT NULL DEFAULT 7,
    "noActivityDays" INTEGER NOT NULL DEFAULT 14,
    "criticalNoActivityDays" INTEGER NOT NULL DEFAULT 30,
    "shortTermWindowDays" INTEGER NOT NULL DEFAULT 7,
    "longTermWindowDays" INTEGER NOT NULL DEFAULT 30,
    "defaultCheckInFrequencyDays" INTEGER NOT NULL DEFAULT 7,
    "notificationTimeUtc" TEXT NOT NULL DEFAULT '09:00',
    "adminOverrideEmail" TEXT,
    "healthkitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "iosIntegrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adherenceGreenMinimum" INTEGER NOT NULL DEFAULT 6,
    "adherenceAmberMinimum" INTEGER NOT NULL DEFAULT 3,
    "attentionMissedCheckinsPolicy" TEXT NOT NULL DEFAULT 'option_a',
    "bodyFatLowPercent" DOUBLE PRECISION NOT NULL DEFAULT 12.5,
    "bodyFatMediumPercent" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    "bodyFatHighPercent" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "bodyFatVeryHighPercent" DOUBLE PRECISION NOT NULL DEFAULT 37.5,
    "minDailyCalories" INTEGER NOT NULL DEFAULT 1000,
    "maxDailyCalories" INTEGER NOT NULL DEFAULT 5000,
    "minProteinPerLb" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "maxProteinPerLb" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "defaultCarbsPercent" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "defaultProteinPercent" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "defaultFatPercent" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    "stepsNotMuch" INTEGER NOT NULL DEFAULT 5000,
    "stepsLight" INTEGER NOT NULL DEFAULT 7500,
    "stepsModerate" INTEGER NOT NULL DEFAULT 10000,
    "stepsHeavy" INTEGER NOT NULL DEFAULT 12500,
    "workoutNotMuch" INTEGER NOT NULL DEFAULT 75,
    "workoutLight" INTEGER NOT NULL DEFAULT 150,
    "workoutModerate" INTEGER NOT NULL DEFAULT 225,
    "workoutHeavy" INTEGER NOT NULL DEFAULT 300,
    "showPersonalizedPlan" BOOLEAN NOT NULL DEFAULT true,
    "termsContentHtml" TEXT NOT NULL DEFAULT '',
    "privacyContentHtml" TEXT NOT NULL DEFAULT '',
    "dataProcessingContentHtml" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsAccepted" TIMESTAMP(3) NOT NULL,
    "privacyAccepted" TIMESTAMP(3) NOT NULL,
    "dataProcessing" TIMESTAMP(3) NOT NULL,
    "marketing" TIMESTAMP(3),
    "version" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subjectTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "textTemplate" TEXT NOT NULL,
    "availableTokens" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "QuestionnaireBundle" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "bundleJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyQuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "responseJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyQuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomCohortType" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomCohortType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "CoachInvite_coachId_idx" ON "CoachInvite"("coachId");

-- CreateIndex
CREATE INDEX "CoachInvite_email_idx" ON "CoachInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CoachInvite_email_coachId_key" ON "CoachInvite"("email", "coachId");

-- CreateIndex
CREATE INDEX "Cohort_coachId_idx" ON "Cohort"("coachId");

-- CreateIndex
CREATE INDEX "Cohort_createdAt_idx" ON "Cohort"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_coachId_name_key" ON "Cohort"("coachId", "name");

-- CreateIndex
CREATE INDEX "CoachCohortMembership_coachId_idx" ON "CoachCohortMembership"("coachId");

-- CreateIndex
CREATE INDEX "CoachCohortMembership_cohortId_idx" ON "CoachCohortMembership"("cohortId");

-- CreateIndex
CREATE INDEX "CohortInvite_cohortId_idx" ON "CohortInvite"("cohortId");

-- CreateIndex
CREATE INDEX "CohortInvite_email_idx" ON "CohortInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CohortInvite_email_cohortId_key" ON "CohortInvite"("email", "cohortId");

-- CreateIndex
CREATE INDEX "CohortMembership_userId_idx" ON "CohortMembership"("userId");

-- CreateIndex
CREATE INDEX "CohortMembership_cohortId_idx" ON "CohortMembership"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMembership_userId_key" ON "CohortMembership"("userId");

-- CreateIndex
CREATE INDEX "Entry_userId_date_idx" ON "Entry"("userId", "date");

-- CreateIndex
CREATE INDEX "Entry_date_idx" ON "Entry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_userId_date_key" ON "Entry"("userId", "date");

-- CreateIndex
CREATE INDEX "Workout_userId_idx" ON "Workout"("userId");

-- CreateIndex
CREATE INDEX "Workout_userId_startTime_idx" ON "Workout"("userId", "startTime");

-- CreateIndex
CREATE INDEX "Workout_startTime_idx" ON "Workout"("startTime");

-- CreateIndex
CREATE INDEX "SleepRecord_userId_idx" ON "SleepRecord"("userId");

-- CreateIndex
CREATE INDEX "SleepRecord_userId_date_idx" ON "SleepRecord"("userId", "date");

-- CreateIndex
CREATE INDEX "SleepRecord_date_idx" ON "SleepRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SleepRecord_userId_date_key" ON "SleepRecord"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PairingCode_code_key" ON "PairingCode"("code");

-- CreateIndex
CREATE INDEX "PairingCode_code_idx" ON "PairingCode"("code");

-- CreateIndex
CREATE INDEX "PairingCode_coachId_idx" ON "PairingCode"("coachId");

-- CreateIndex
CREATE INDEX "PairingCode_expiresAt_idx" ON "PairingCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_invitedByCoachId_idx" ON "User"("invitedByCoachId");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_roles_idx" ON "User"("roles");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "CoachNote_coachId_clientId_idx" ON "CoachNote"("coachId", "clientId");

-- CreateIndex
CREATE INDEX "CoachNote_noteDate_idx" ON "CoachNote"("noteDate");

-- CreateIndex
CREATE UNIQUE INDEX "CoachNote_coachId_clientId_weekStart_key" ON "CoachNote"("coachId", "clientId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyCoachResponse_coachId_clientId_idx" ON "WeeklyCoachResponse"("coachId", "clientId");

-- CreateIndex
CREATE INDEX "WeeklyCoachResponse_weekStart_idx" ON "WeeklyCoachResponse"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCoachResponse_coachId_clientId_weekStart_key" ON "WeeklyCoachResponse"("coachId", "clientId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "CohortCheckInConfig_cohortId_key" ON "CohortCheckInConfig"("cohortId");

-- CreateIndex
CREATE INDEX "CohortCheckInConfig_cohortId_idx" ON "CohortCheckInConfig"("cohortId");

-- CreateIndex
CREATE INDEX "AdminInsight_entityType_entityId_idx" ON "AdminInsight"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminInsight_priority_createdAt_idx" ON "AdminInsight"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "AdminInsight_insightType_severity_idx" ON "AdminInsight"("insightType", "severity");

-- CreateIndex
CREATE INDEX "AdminInsight_createdAt_idx" ON "AdminInsight"("createdAt");

-- CreateIndex
CREATE INDEX "AttentionScore_priority_score_idx" ON "AttentionScore"("priority", "score");

-- CreateIndex
CREATE INDEX "AttentionScore_calculatedAt_idx" ON "AttentionScore"("calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttentionScore_entityType_entityId_key" ON "AttentionScore"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAction_adminId_idx" ON "AdminAction"("adminId");

-- CreateIndex
CREATE INDEX "AdminAction_targetType_targetId_idx" ON "AdminAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAction_actionType_idx" ON "AdminAction"("actionType");

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_insightId_idx" ON "AdminAction"("insightId");

-- CreateIndex
CREATE INDEX "SystemSettings_createdAt_idx" ON "SystemSettings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_key" ON "UserConsent"("userId");

-- CreateIndex
CREATE INDEX "UserConsent_userId_idx" ON "UserConsent"("userId");

-- CreateIndex
CREATE INDEX "UserConsent_createdAt_idx" ON "UserConsent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "EmailTemplate_key_idx" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "EmailTemplate_enabled_idx" ON "EmailTemplate"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "UserGoals_userId_key" ON "UserGoals"("userId");

-- CreateIndex
CREATE INDEX "UserGoals_userId_idx" ON "UserGoals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireBundle_cohortId_key" ON "QuestionnaireBundle"("cohortId");

-- CreateIndex
CREATE INDEX "QuestionnaireBundle_cohortId_idx" ON "QuestionnaireBundle"("cohortId");

-- CreateIndex
CREATE INDEX "WeeklyQuestionnaireResponse_userId_idx" ON "WeeklyQuestionnaireResponse"("userId");

-- CreateIndex
CREATE INDEX "WeeklyQuestionnaireResponse_cohortId_idx" ON "WeeklyQuestionnaireResponse"("cohortId");

-- CreateIndex
CREATE INDEX "WeeklyQuestionnaireResponse_cohortId_weekNumber_idx" ON "WeeklyQuestionnaireResponse"("cohortId", "weekNumber");

-- CreateIndex
CREATE INDEX "WeeklyQuestionnaireResponse_status_idx" ON "WeeklyQuestionnaireResponse"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyQuestionnaireResponse_userId_cohortId_weekNumber_key" ON "WeeklyQuestionnaireResponse"("userId", "cohortId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomCohortType_label_key" ON "CustomCohortType"("label");

-- CreateIndex
CREATE INDEX "CustomCohortType_createdBy_idx" ON "CustomCohortType"("createdBy");

-- CreateIndex
CREATE INDEX "CustomCohortType_createdAt_idx" ON "CustomCohortType"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvite" ADD CONSTRAINT "CoachInvite_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_customCohortTypeId_fkey" FOREIGN KEY ("customCohortTypeId") REFERENCES "CustomCohortType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachCohortMembership" ADD CONSTRAINT "CoachCohortMembership_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachCohortMembership" ADD CONSTRAINT "CoachCohortMembership_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortInvite" ADD CONSTRAINT "CohortInvite_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMembership" ADD CONSTRAINT "CohortMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepRecord" ADD CONSTRAINT "SleepRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitedByCoachId_fkey" FOREIGN KEY ("invitedByCoachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCoachResponse" ADD CONSTRAINT "WeeklyCoachResponse_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCoachResponse" ADD CONSTRAINT "WeeklyCoachResponse_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortCheckInConfig" ADD CONSTRAINT "CohortCheckInConfig_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGoals" ADD CONSTRAINT "UserGoals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireBundle" ADD CONSTRAINT "QuestionnaireBundle_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyQuestionnaireResponse" ADD CONSTRAINT "WeeklyQuestionnaireResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyQuestionnaireResponse" ADD CONSTRAINT "WeeklyQuestionnaireResponse_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomCohortType" ADD CONSTRAINT "CustomCohortType_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

