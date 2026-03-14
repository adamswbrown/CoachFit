-- Migration: Better Auth → Clerk
-- This migration adds clerkId to User and drops auth tables managed by Clerk.

-- Step 1: Add clerkId column to User
ALTER TABLE "User" ADD COLUMN "clerkId" TEXT;
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- Step 2: Drop auth tables that Clerk now manages externally
-- (Account, Session, Verification)

-- Drop foreign key constraints first
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";

-- Drop the tables
DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "Verification";
