-- Migration: NextAuth.js v5 → Better Auth
-- This migration restructures the Account, Session, and VerificationToken tables
-- to match Better Auth's expected schema.

-- ============================================================
-- 1. Account table: Rename columns to Better Auth conventions
-- ============================================================

-- Add new columns first
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "providerId" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "idToken" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Copy data from old columns to new columns
UPDATE "Account" SET
  "accountId" = COALESCE("providerAccountId", ''),
  "providerId" = COALESCE("provider", ''),
  "accessToken" = "access_token",
  "refreshToken" = "refresh_token",
  "idToken" = "id_token"
WHERE "accountId" IS NULL;

-- Make accountId and providerId non-nullable
ALTER TABLE "Account" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Account" ALTER COLUMN "providerId" SET NOT NULL;

-- Drop old unique constraint and create new one
DROP INDEX IF EXISTS "Account_provider_providerAccountId_key";
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- Drop old columns
ALTER TABLE "Account" DROP COLUMN IF EXISTS "provider";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "providerAccountId";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "access_token";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "refresh_token";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "id_token";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "expires_at";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "token_type";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "session_state";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "type";

-- ============================================================
-- 2. Session table: Rename columns to Better Auth conventions
-- ============================================================

-- Add new columns
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "token" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Copy data from old columns
UPDATE "Session" SET
  "token" = COALESCE("sessionToken", id),
  "expiresAt" = "expires"
WHERE "token" IS NULL;

-- Make token non-nullable
ALTER TABLE "Session" ALTER COLUMN "token" SET NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET NOT NULL;

-- Drop old unique constraint and create new one
DROP INDEX IF EXISTS "Session_sessionToken_key";
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- Drop old columns
ALTER TABLE "Session" DROP COLUMN IF EXISTS "sessionToken";
ALTER TABLE "Session" DROP COLUMN IF EXISTS "expires";

-- ============================================================
-- 3. VerificationToken → Verification table
-- ============================================================

-- Rename table
ALTER TABLE "VerificationToken" RENAME TO "Verification";

-- Add new columns
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "id" TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "value" TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Copy data
UPDATE "Verification" SET
  "id" = gen_random_uuid()::text,
  "value" = COALESCE("token", ''),
  "expiresAt" = "expires"
WHERE "id" IS NULL;

-- Make non-nullable
ALTER TABLE "Verification" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "Verification" ALTER COLUMN "value" SET NOT NULL;
ALTER TABLE "Verification" ALTER COLUMN "expiresAt" SET NOT NULL;

-- Set primary key
ALTER TABLE "Verification" ADD PRIMARY KEY ("id");

-- Drop old unique constraints and create new ones
DROP INDEX IF EXISTS "VerificationToken_token_key";
DROP INDEX IF EXISTS "VerificationToken_identifier_token_key";
CREATE UNIQUE INDEX "Verification_identifier_value_key" ON "Verification"("identifier", "value");

-- Drop old columns
ALTER TABLE "Verification" DROP COLUMN IF EXISTS "token";
ALTER TABLE "Verification" DROP COLUMN IF EXISTS "expires";

-- ============================================================
-- 4. User table: Change emailVerified from DateTime to Boolean, add updatedAt
-- ============================================================

-- Add updatedAt column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Change emailVerified from DateTime? to Boolean
-- First add a temporary column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified_new" BOOLEAN NOT NULL DEFAULT false;

-- Copy data: if emailVerified had a datetime, set true; otherwise false
UPDATE "User" SET "emailVerified_new" = ("emailVerified" IS NOT NULL);

-- Drop old column and rename new one
ALTER TABLE "User" DROP COLUMN "emailVerified";
ALTER TABLE "User" RENAME COLUMN "emailVerified_new" TO "emailVerified";
