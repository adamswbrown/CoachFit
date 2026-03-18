-- Add legal content fields to SystemSettings
ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "termsContentHtml" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "privacyContentHtml" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "dataProcessingContentHtml" TEXT NOT NULL DEFAULT '';
