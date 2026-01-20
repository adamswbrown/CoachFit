# Test Data Documentation

This document describes the comprehensive test data generated for the CoachFit application.

## Overview

The test data generation script creates a realistic dataset with:
- **200 clients** with varied health data and demographics
- **10 coaches** to manage the clients
- **1 additional admin user** (in addition to the default admin@test.local)
- **15 cohorts** distributed across coaches
- **Varied health data** with different activity levels and engagement patterns
- **Gender diversity** (45% female, 45% male, 10% non-binary)
- **All users have passwords set** for easy testing

## Default Password

**All test users have the same password for convenience:**
```
TestPassword123!
```

⚠️ **Important:** This is a development/testing password only. Never use this in production.

## User Accounts

### Admin Users

| Email | Name | Role | Password |
|-------|------|------|----------|
| `admin@test.local` | Test Admin | ADMIN | `TestPassword123!` |
| `admin2@test.local` | Test Admin 2 | ADMIN | `TestPassword123!` |

### Coach Users

| Email | Name | Role | Password |
|-------|------|------|----------|
| `alex.thompson@test.local` | Alex Thompson | COACH | `TestPassword123!` |
| `jordan.martinez@test.local` | Jordan Martinez | COACH | `TestPassword123!` |
| `taylor.chen@test.local` | Taylor Chen | COACH | `TestPassword123!` |
| `casey.williams@test.local` | Casey Williams | COACH | `TestPassword123!` |
| `morgan.davis@test.local` | Morgan Davis | COACH | `TestPassword123!` |
| `riley.johnson@test.local` | Riley Johnson | COACH | `TestPassword123!` |
| `avery.brown@test.local` | Avery Brown | COACH | `TestPassword123!` |
| `quinn.anderson@test.local` | Quinn Anderson | COACH | `TestPassword123!` |
| `sage.rodriguez@test.local` | Sage Rodriguez | COACH | `TestPassword123!` |
| `river.garcia@test.local` | River Garcia | COACH | `TestPassword123!` |

### Client Users

All 200 clients follow the pattern:
- **Email format:** `client001@test.local` through `client200@test.local`
- **Names:** Randomly generated from realistic name pools
- **Role:** CLIENT
- **Password:** `TestPassword123!`

#### Gender Distribution
- **Female:** ~90 clients (45%)
- **Male:** ~90 clients (45%)
- **Non-binary:** ~20 clients (10%)

## Cohorts

15 cohorts are created and distributed across the 10 coaches:

1. Spring 2024 Fitness Challenge
2. Summer Transformation Program
3. Fall Wellness Group
4. Winter Bootcamp
5. Year-Round Support
6. New Year Reset
7. Spring Renewal
8. Summer Strength
9. Autumn Accountability
10. Holiday Health
11. 2024 Kickstart
12. Wellness Warriors
13. Fit for Life
14. Transformation Tribe
15. Health Heroes

### Client Distribution

Clients are evenly distributed across cohorts:
- **Average clients per cohort:** ~13-14 clients
- Each cohort has a mix of activity levels and engagement patterns

## Health Data (Entries)

Each client has **30-90 days** of historical check-in data with varying characteristics:

### Activity Levels

Clients are distributed across 4 activity levels:

#### 1. Low Activity (20% of clients)
- **Base Steps:** ~3,000 steps/day
- **Base Calories:** ~1,500 calories/day
- **Weight Range:** 140-220 lbs
- **Check-in Consistency:** 30% (misses many days)
- **Characteristics:** Less engaged, irregular check-ins

#### 2. Moderate Activity (30% of clients)
- **Base Steps:** ~7,000 steps/day
- **Base Calories:** ~2,000 calories/day
- **Weight Range:** 120-200 lbs
- **Check-in Consistency:** 60% (regular but not daily)
- **Characteristics:** Steady engagement, consistent progress

#### 3. High Activity (30% of clients)
- **Base Steps:** ~12,000 steps/day
- **Base Calories:** ~2,500 calories/day
- **Weight Range:** 110-180 lbs
- **Check-in Consistency:** 80% (mostly daily)
- **Characteristics:** Highly engaged, active participants

#### 4. Very High Activity (20% of clients)
- **Base Steps:** ~15,000 steps/day
- **Base Calories:** ~3,000 calories/day
- **Weight Range:** 100-170 lbs
- **Check-in Consistency:** 90% (almost daily)
- **Characteristics:** Extremely engaged, fitness enthusiasts

### Entry Data Fields

Each entry may include:
- **weightLbs:** Weight in pounds (varies by activity level)
- **steps:** Daily step count (varies by activity level)
- **calories:** Daily calorie intake (varies by activity level)
- **heightInches:** Height in inches (70% of entries have this)
- **sleepQuality:** Sleep quality rating 1-10 (60% of entries have this)
- **perceivedStress:** Perceived stress level 1-10 (50% of entries have this)

### Data Realism

- **Weight variation:** ±3 lbs with slight trend over time
- **Steps variation:** ±25% of base activity level
- **Calories variation:** ±20% of base activity level
- **Missing data:** Some entries intentionally have missing optional fields to simulate real-world data collection patterns

## Usage

### Generating Test Data

1. **Clean existing test data:**
   ```bash
   npm run test:cleanup
   # or
   npx tsx scripts/cleanup-test-data.ts
   ```

2. **Generate comprehensive test data:**
   ```bash
   npm run test:generate-comprehensive
   # or
   npx tsx scripts/generate-comprehensive-test-data.ts
   ```

   **Note:** The generation process may take several minutes as it creates 200 clients with 30-90 days of historical data each.

### Logging In

Use any of the test accounts with:
- **Email:** As listed in the tables above
- **Password:** `TestPassword123!`

### Testing Scenarios

The test data supports testing:

1. **Coach Dashboard:**
   - Multiple clients with varying engagement
   - Weekly aggregation across different activity levels
   - Trend analysis with realistic data patterns
   - Missed check-ins (low consistency clients)

2. **Admin Panel:**
   - User management across 200+ users
   - Cohort management with distributed clients
   - System health metrics with substantial data
   - Attention queue with various engagement levels

3. **Client Experience:**
   - Pre-filled check-in forms (for clients with existing data)
   - Various activity levels and health profiles
   - Different engagement patterns

4. **Data Integrity:**
   - Large dataset for performance testing
   - Varied data completeness (some missing fields)
   - Realistic weight/activity trends

## Data Statistics

After generation, you can expect approximately:

- **Total Users:** 212 (2 admins + 10 coaches + 200 clients)
- **Total Cohorts:** 15
- **Total Entries:** ~8,000-12,000 (varies based on consistency)
- **Average Entries per Client:** 40-60 entries
- **Data Range:** 30-90 days of historical data per client

## Maintenance

### Resetting Test Data

To start fresh:

```bash
# Clean all test data
npx tsx scripts/cleanup-test-data.ts

# Regenerate comprehensive test data
npx tsx scripts/generate-comprehensive-test-data.ts
```

### Preserving Production Data

The cleanup script only deletes users with `isTestUser: true`. Production users are never affected.

## Notes

- All test users are marked with `isTestUser: true` for easy identification
- Test data uses the `.test.local` email domain to avoid conflicts
- The default admin user (`admin@test.local`) is created separately via the seed script
- Gender information is stored in memory during generation but not persisted to the database (used only for realistic name generation)
- Activity profiles are used to generate realistic health data patterns
