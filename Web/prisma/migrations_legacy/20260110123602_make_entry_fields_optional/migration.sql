-- Make existing fields nullable
ALTER TABLE "Entry" 
  ALTER COLUMN "weightLbs" DROP NOT NULL,
  ALTER COLUMN "steps" DROP NOT NULL,
  ALTER COLUMN "calories" DROP NOT NULL;

-- Add height field
ALTER TABLE "Entry" 
  ADD COLUMN "heightInches" DOUBLE PRECISION;

-- Add updatedAt field with default for existing rows
ALTER TABLE "Entry" 
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create trigger function to auto-update updatedAt (PostgreSQL)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_entry_updated_at 
  BEFORE UPDATE ON "Entry"
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create index
CREATE INDEX "Entry_userId_date_idx" ON "Entry"("userId", "date");
