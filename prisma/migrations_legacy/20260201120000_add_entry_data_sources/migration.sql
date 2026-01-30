-- Add dataSources to Entry if missing
ALTER TABLE "Entry" ADD COLUMN IF NOT EXISTS "dataSources" JSONB DEFAULT '[]';
