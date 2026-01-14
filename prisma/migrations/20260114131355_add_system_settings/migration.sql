-- AlterTable
ALTER TABLE "CoachNote" ALTER COLUMN "noteDate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "dataSources" JSONB DEFAULT '[]';

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "CohortMembership_userId_idx" ON "CohortMembership"("userId");

-- CreateIndex
CREATE INDEX "CohortMembership_cohortId_idx" ON "CohortMembership"("cohortId");

-- CreateIndex
CREATE INDEX "Entry_date_idx" ON "Entry"("date");

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepRecord" ADD CONSTRAINT "SleepRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAction" ADD CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
