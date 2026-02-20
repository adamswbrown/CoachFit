-- AlterTable: Add default UUID generation for Account.id
ALTER TABLE "Account" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
