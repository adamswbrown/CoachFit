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

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCoachResponse_coachId_clientId_weekStart_key" ON "WeeklyCoachResponse"("coachId", "clientId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyCoachResponse_coachId_clientId_idx" ON "WeeklyCoachResponse"("coachId", "clientId");

-- CreateIndex
CREATE INDEX "WeeklyCoachResponse_weekStart_idx" ON "WeeklyCoachResponse"("weekStart");

-- AddForeignKey
ALTER TABLE "WeeklyCoachResponse" ADD CONSTRAINT "WeeklyCoachResponse_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCoachResponse" ADD CONSTRAINT "WeeklyCoachResponse_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
