-- CreateEnum
CREATE TYPE "ClassScope" AS ENUM ('FACILITY', 'COHORT');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'WAITLISTED', 'CANCELLED', 'LATE_CANCEL', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('CLIENT', 'COACH', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CreditSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CreditLedgerReason" AS ENUM ('TOPUP_MONTHLY', 'PACK_PURCHASE', 'BOOKING_DEBIT', 'REFUND', 'MANUAL_ADJUSTMENT', 'EXPIRY');

-- CreateEnum
CREATE TYPE "CreditProductMode" AS ENUM ('MONTHLY_TOPUP', 'ONE_TIME_PACK', 'CATALOG_ONLY');

-- CreateEnum
CREATE TYPE "CreditPeriodType" AS ENUM ('MONTH', 'ONE_TIME');

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "bookingCloseMinutesDefault" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bookingCurrency" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN     "bookingOpenHoursDefault" INTEGER NOT NULL DEFAULT 336,
ADD COLUMN     "bookingTimezone" TEXT NOT NULL DEFAULT 'Europe/London',
ADD COLUMN     "classBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultClassCapacity" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "defaultCreditsPerBooking" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "defaultWaitlistCap" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "lateCancelCutoffMinutesDefault" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "ClassTemplate" (
    "id" TEXT NOT NULL,
    "ownerCoachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classType" TEXT NOT NULL,
    "description" TEXT,
    "scope" "ClassScope" NOT NULL DEFAULT 'FACILITY',
    "cohortId" TEXT,
    "locationLabel" TEXT NOT NULL,
    "roomLabel" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "waitlistCapacity" INTEGER NOT NULL DEFAULT 10,
    "bookingOpenHoursBefore" INTEGER NOT NULL DEFAULT 336,
    "bookingCloseMinutesBefore" INTEGER NOT NULL DEFAULT 0,
    "cancelCutoffMinutes" INTEGER NOT NULL DEFAULT 60,
    "creditsRequired" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "classTemplateId" TEXT NOT NULL,
    "instructorId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacityOverride" INTEGER,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassBooking" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
    "source" "BookingSource" NOT NULL DEFAULT 'CLIENT',
    "waitlistPosition" INTEGER,
    "bookedByUserId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "attendanceMarkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditProduct" (
    "id" TEXT NOT NULL,
    "ownerCoachId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "appliesToClassTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creditMode" "CreditProductMode" NOT NULL,
    "creditsPerPeriod" INTEGER,
    "periodType" "CreditPeriodType" NOT NULL,
    "purchasePriceGbp" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "purchasableByProviderOnly" BOOLEAN NOT NULL DEFAULT false,
    "classEligible" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "externalSource" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCreditAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCreditSubscription" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "creditProductId" TEXT NOT NULL,
    "monthlyCredits" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "lastAppliedMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCreditSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditSubmission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "creditProductId" TEXT NOT NULL,
    "revolutReference" TEXT NOT NULL,
    "note" TEXT,
    "status" "CreditSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCreditLedger" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deltaCredits" INTEGER NOT NULL,
    "reason" "CreditLedgerReason" NOT NULL,
    "bookingId" TEXT,
    "submissionId" TEXT,
    "creditProductId" TEXT,
    "subscriptionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassTemplate_ownerCoachId_idx" ON "ClassTemplate"("ownerCoachId");

-- CreateIndex
CREATE INDEX "ClassTemplate_cohortId_idx" ON "ClassTemplate"("cohortId");

-- CreateIndex
CREATE INDEX "ClassTemplate_classType_idx" ON "ClassTemplate"("classType");

-- CreateIndex
CREATE INDEX "ClassTemplate_isActive_idx" ON "ClassTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ClassTemplate_scope_idx" ON "ClassTemplate"("scope");

-- CreateIndex
CREATE INDEX "ClassSession_classTemplateId_idx" ON "ClassSession"("classTemplateId");

-- CreateIndex
CREATE INDEX "ClassSession_instructorId_idx" ON "ClassSession"("instructorId");

-- CreateIndex
CREATE INDEX "ClassSession_startsAt_idx" ON "ClassSession"("startsAt");

-- CreateIndex
CREATE INDEX "ClassSession_status_idx" ON "ClassSession"("status");

-- CreateIndex
CREATE INDEX "ClassBooking_clientId_idx" ON "ClassBooking"("clientId");

-- CreateIndex
CREATE INDEX "ClassBooking_status_idx" ON "ClassBooking"("status");

-- CreateIndex
CREATE INDEX "ClassBooking_waitlistPosition_idx" ON "ClassBooking"("waitlistPosition");

-- CreateIndex
CREATE UNIQUE INDEX "ClassBooking_sessionId_clientId_key" ON "ClassBooking"("sessionId", "clientId");

-- CreateIndex
CREATE INDEX "CreditProduct_ownerCoachId_idx" ON "CreditProduct"("ownerCoachId");

-- CreateIndex
CREATE INDEX "CreditProduct_name_idx" ON "CreditProduct"("name");

-- CreateIndex
CREATE INDEX "CreditProduct_classEligible_idx" ON "CreditProduct"("classEligible");

-- CreateIndex
CREATE INDEX "CreditProduct_isActive_idx" ON "CreditProduct"("isActive");

-- CreateIndex
CREATE INDEX "CreditProduct_externalSource_externalId_idx" ON "CreditProduct"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCreditAccount_clientId_key" ON "ClientCreditAccount"("clientId");

-- CreateIndex
CREATE INDEX "ClientCreditAccount_clientId_idx" ON "ClientCreditAccount"("clientId");

-- CreateIndex
CREATE INDEX "ClientCreditSubscription_clientId_idx" ON "ClientCreditSubscription"("clientId");

-- CreateIndex
CREATE INDEX "ClientCreditSubscription_creditProductId_idx" ON "ClientCreditSubscription"("creditProductId");

-- CreateIndex
CREATE INDEX "ClientCreditSubscription_active_startDate_endDate_idx" ON "ClientCreditSubscription"("active", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "CreditSubmission_clientId_idx" ON "CreditSubmission"("clientId");

-- CreateIndex
CREATE INDEX "CreditSubmission_creditProductId_idx" ON "CreditSubmission"("creditProductId");

-- CreateIndex
CREATE INDEX "CreditSubmission_status_idx" ON "CreditSubmission"("status");

-- CreateIndex
CREATE INDEX "CreditSubmission_createdAt_idx" ON "CreditSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "ClientCreditLedger_clientId_idx" ON "ClientCreditLedger"("clientId");

-- CreateIndex
CREATE INDEX "ClientCreditLedger_reason_idx" ON "ClientCreditLedger"("reason");

-- CreateIndex
CREATE INDEX "ClientCreditLedger_expiresAt_idx" ON "ClientCreditLedger"("expiresAt");

-- CreateIndex
CREATE INDEX "ClientCreditLedger_createdAt_idx" ON "ClientCreditLedger"("createdAt");

-- CreateIndex
CREATE INDEX "ClientCreditLedger_bookingId_idx" ON "ClientCreditLedger"("bookingId");

-- CreateIndex
CREATE INDEX "ClientCreditLedger_submissionId_idx" ON "ClientCreditLedger"("submissionId");

-- AddForeignKey
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_ownerCoachId_fkey" FOREIGN KEY ("ownerCoachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTemplate" ADD CONSTRAINT "ClassTemplate_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_classTemplateId_fkey" FOREIGN KEY ("classTemplateId") REFERENCES "ClassTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_bookedByUserId_fkey" FOREIGN KEY ("bookedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditProduct" ADD CONSTRAINT "CreditProduct_ownerCoachId_fkey" FOREIGN KEY ("ownerCoachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditAccount" ADD CONSTRAINT "ClientCreditAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditSubscription" ADD CONSTRAINT "ClientCreditSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditSubscription" ADD CONSTRAINT "ClientCreditSubscription_creditProductId_fkey" FOREIGN KEY ("creditProductId") REFERENCES "CreditProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSubmission" ADD CONSTRAINT "CreditSubmission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSubmission" ADD CONSTRAINT "CreditSubmission_creditProductId_fkey" FOREIGN KEY ("creditProductId") REFERENCES "CreditProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditSubmission" ADD CONSTRAINT "CreditSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditLedger" ADD CONSTRAINT "ClientCreditLedger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditLedger" ADD CONSTRAINT "ClientCreditLedger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ClassBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditLedger" ADD CONSTRAINT "ClientCreditLedger_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CreditSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditLedger" ADD CONSTRAINT "ClientCreditLedger_creditProductId_fkey" FOREIGN KEY ("creditProductId") REFERENCES "CreditProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditLedger" ADD CONSTRAINT "ClientCreditLedger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ClientCreditSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCreditLedger" ADD CONSTRAINT "ClientCreditLedger_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
