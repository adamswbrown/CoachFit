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

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_key" ON "UserConsent"("userId");

-- CreateIndex
CREATE INDEX "UserConsent_userId_idx" ON "UserConsent"("userId");

-- CreateIndex
CREATE INDEX "UserConsent_createdAt_idx" ON "UserConsent"("createdAt");

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
