-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "resendEmailId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL,
    "eventData" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coachInviteId" TEXT,
    "cohortInviteId" TEXT,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEvent_resendEmailId_idx" ON "EmailEvent"("resendEmailId");

-- CreateIndex
CREATE INDEX "EmailEvent_to_idx" ON "EmailEvent"("to");

-- CreateIndex
CREATE INDEX "EmailEvent_status_idx" ON "EmailEvent"("status");

-- CreateIndex
CREATE INDEX "EmailEvent_coachInviteId_idx" ON "EmailEvent"("coachInviteId");

-- CreateIndex
CREATE INDEX "EmailEvent_cohortInviteId_idx" ON "EmailEvent"("cohortInviteId");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_coachInviteId_fkey" FOREIGN KEY ("coachInviteId") REFERENCES "CoachInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_cohortInviteId_fkey" FOREIGN KEY ("cohortInviteId") REFERENCES "CohortInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
