# Questionnaire System Migration Instructions

## Issue: Migration Drift

If you encounter the error about migration drift when running `npx prisma migrate dev`, follow these steps:

## Solution

The database schema is out of sync with the migration history. You have two options:

### Option 1: Mark Migration as Applied (Recommended for Production)

If the tables `QuestionnaireBundle` and `WeeklyQuestionnaireResponse` already exist in your database:

```bash
# Mark the migration as applied without running it
npx prisma migrate resolve --applied 20260120_add_questionnaire_system

# Ensure everything is in sync
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Option 2: Reset Database (Development Only - DESTROYS ALL DATA)

```bash
# This will drop all tables and re-apply all migrations
npx prisma migrate reset

# This will prompt you to confirm - type 'y'
# Then it will run all migrations from scratch
```

## After Fixing Migration

Run the seed scripts:

```bash
# Seed questionnaire templates
npm run seed:questionnaire-templates

# Setup email template
npm run questionnaire:setup-email
```

## Verification

To verify everything is working:

```bash
# Check Prisma client is generated
npx prisma generate

# Try running the seed script
npm run seed:questionnaire-templates
```

## If You Still Get "User.gender" Error

This means your database is missing the `gender` column on the User table. This should have been added in a previous migration. To fix:

```bash
# Connect to your database and run:
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" TEXT;

# Then regenerate Prisma client
npx prisma generate
```

Or use `prisma migrate reset` to rebuild from scratch (development only).
