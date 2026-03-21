-- CreateTable
CREATE TABLE "PlatformInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvite_email_key" ON "PlatformInvite"("email");

-- CreateIndex
CREATE INDEX "PlatformInvite_email_idx" ON "PlatformInvite"("email");

-- CreateIndex
CREATE INDEX "PlatformInvite_invitedBy_idx" ON "PlatformInvite"("invitedBy");

-- AddForeignKey
ALTER TABLE "PlatformInvite" ADD CONSTRAINT "PlatformInvite_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
