-- Add security-related fields to User table
-- These were added as part of the security audit

-- originalEmail: Preserved on soft delete for account recovery
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "originalEmail" TEXT;

-- passwordChangedAt: For session invalidation when password is changed
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
