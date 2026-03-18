# Migration: Add Questionnaire System

This migration adds support for the Weekly Questionnaire System feature.

## Changes

### New Tables
- `QuestionnaireBundle` - Stores cohort-specific SurveyJS questionnaire templates
- `WeeklyQuestionnaireResponse` - Stores client responses to weekly questionnaires

### Altered Tables
- `Cohort` - Added `cohortStartDate` field for tracking week 1 start date

## Safe Migration

This migration uses `IF NOT EXISTS` clauses to ensure it can be run safely even if some tables or indexes already exist. This prevents errors when migrating databases that may be in an inconsistent state.

## Running This Migration

If you encounter migration drift warnings, you have two options:

### Option 1: Reset and Re-migrate (Development Only)
```bash
npx prisma migrate reset
npx prisma migrate dev
```

### Option 2: Apply This Migration Directly (Production Safe)
```bash
npx prisma migrate resolve --applied 20260120_add_questionnaire_system
npx prisma migrate deploy
```

Then generate the Prisma client:
```bash
npx prisma generate
```

## After Migration

Run the seed scripts to set up default questionnaire templates:
```bash
npm run seed:questionnaire-templates
npm run questionnaire:setup-email
```
