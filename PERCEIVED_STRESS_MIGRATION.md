# Perceived Effort → Perceived Stress Migration Summary

## ✅ Completed Changes

### 1. **Database Schema**
- **Migration Created**: `20260120_rename_perceived_effort_to_stress/migration.sql`
- **Column Renamed**: `Entry.perceivedEffort` → `Entry.perceivedStress`
- **Constraint Updated**: `perceivedEffort_range` → `perceivedStress_range`
- **Type**: INT (1-10 scale, optional)
- **Status**: ✓ Applied and verified

### 2. **Prisma Schema**
- Updated `prisma/schema.prisma` Entry model
- Field renamed: `perceivedEffort Int?` → `perceivedStress Int?`
- Prisma Client regenerated

### 3. **Validation**
- Updated `lib/validations.ts` upsertEntrySchema
- Error messages updated: "Perceived stress must be between 1 and 10"
- Schema refine condition updated to check `perceivedStress` instead of `perceivedEffort`

### 4. **API Routes** (All Updated)
- `app/api/entries/route.ts` - Entry creation/upsert
- `app/api/cohorts/[id]/analytics/route.ts` - Cohort analytics
- `app/api/clients/[id]/analytics/route.ts` - Client analytics
- `app/api/clients/[id]/entries/route.ts` - Client entries list
- `app/api/clients/[id]/weekly-summary/route.ts` - Weekly summary calculations
- `app/api/user/export-data/route.ts` - CSV export
- `app/api/admin/randomize-checkins/route.ts` - Admin check-in randomization
- `app/api/entries/check-in-config/route.ts` - Default check-in prompts

### 5. **Frontend Components** (All Updated)
- `app/client-dashboard/page.tsx`
  - Form state and submission logic updated
  - UI labels changed: "Perceived Stress" with scale "Not Stressed → Moderate → Extremely Stressed"
  - Check-in config enabledPrompts checks `perceivedStress`

- `app/clients/[id]/entries/page.tsx`
  - Chart title: "Perceived Stress Trend"
  - Data types and display updated
  - Table headers and display logic updated

- `app/clients/[id]/page.tsx` - Type definitions updated
- `app/clients/[id]/weekly-review/page.tsx` - Type definitions updated

- `app/cohorts/[id]/page.tsx`
  - Checkbox for enabling "Perceived Stress"
  - Check-in config form updated

- `app/cohorts/create/page.tsx`
  - Prompt selection dropdown updated

### 6. **Test Data Generators** (All Updated)
- `scripts/generate-comprehensive-test-data.ts`
- `scripts/reset-and-seed-realistic-multi-coach.ts`
- `scripts/reset-and-seed-comprehensive-multi-coach.ts`
- `scripts/reset-and-seed-multi-coach.ts`
- `scripts/randomize-client-checkin-status.ts`

All scripts now generate `perceivedStress` values (1-10, populated for ~50% of entries)

### 7. **Documentation Updated**
- `.github/copilot-instructions.md` - Architecture reference
- `docs/development/architecture.md` - Data model documentation
- `docs/development/api-reference.md` - API examples
- `docs/development/CALCULATIONS_REFERENCE.md` - Calculation examples
- `docs/misc/TEST_DATA_DOCUMENTATION.md` - Test data reference
- `docs/misc/IOS_APP_INTEGRATION_FEASIBILITY.md` - Feature documentation

## 📊 Test Data Verification Results

After running comprehensive test data generation:
- **Total Entries**: 2,051
- **Entries with Perceived Stress**: 891 (43.4%)
- **Generators**: Properly populate ~50% of entries with stress values (1-10 scale)
- **Sample Values**: Stress levels range from 1-10 as expected

Example entries:
- 2026-01-14: Stress Level 2/10
- 2026-01-17: Stress Level 7/10
- 2026-01-20: Stress Level 2/10

## 🔄 Field Usage Across System

### Default Check-In Prompts
When a cohort is created, the default enabled prompts are:
```
["sleepQuality", "perceivedStress", "notes"]
```

### Data Export
CSV headers now include:
```
Date, Weight (lbs), Steps, Calories, Height (in), Sleep Quality, Perceived Stress, Notes, Data Sources
```

### Weekly Summary Calculations
- Calculates average perceived stress across the week
- Used in completeness score (5 total fields: weight, steps, calories, sleep quality, stress)
- Included in weekly analysis

## ✨ User-Facing Changes

### Client Dashboard
- **Label**: "Perceived Stress" (was "Perceived Effort")
- **Scale Labels**: "Not Stressed" → "Moderate" → "Extremely Stressed"
- **Description**: "Rate your stress level from 1-10"

### Coach Dashboard
- Checkbox in cohort settings: "Perceived Stress (1-10 scale)"
- Weekly summary includes: "Average Perceived Stress"
- Client entries view shows stress levels

### Data Display
- Charts show "Perceived Stress Trend" line graph
- Tables display as "X/10" format

## 🔧 Build & Verification

✓ TypeScript compilation: **PASSED**
✓ Prisma Client generation: **PASSED**
✓ Next.js build: **PASSED**
✓ Database migration: **PASSED**
✓ Test data with new field: **VERIFIED**

## 📝 Notes

1. **Backward Compatibility**: The migration renames the column, so existing entries with perceived effort values would have been preserved if any existed. Current test data is fresh and populated with the new field.

2. **Scale Semantics**: The numeric scale (1-10) remains the same, but the meaning has shifted:
   - Old: 1 = Very Easy Effort, 10 = Maximum Effort
   - New: 1 = Not Stressed, 10 = Extremely Stressed

3. **Check-In Configuration**: Coaches can enable/disable perceived stress as a check-in prompt per cohort, just like other fields.

4. **API Consistency**: All endpoints follow the same pattern for the new field, ensuring consistency across REST calls.

## 🎯 Next Steps

To use the updated system:

1. **For Coaches**: Access cohort settings to enable/disable "Perceived Stress" prompts
2. **For Clients**: Log daily stress levels (1-10) alongside other metrics
3. **For Analytics**: View stress trends alongside other health metrics in client analytics

The system is fully functional with perceived stress integrated into all workflows.
