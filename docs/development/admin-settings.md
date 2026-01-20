# Admin Settings Reference

This document provides a complete reference for all system settings available to administrators in CoachFit.

## Overview

System settings control global configuration for the platform, including onboarding validation ranges, default macro distributions, activity thresholds, and feature flags. Settings are stored in the `SystemSettings` table and apply to all new clients. 

**Important**: Changing settings affects only new client onboardings; existing users keep the ranges and defaults calculated when they completed onboarding.

---

## Fitness Calculations Explained

When clients complete onboarding, CoachFit calculates a personalized daily nutrition and fitness plan. Here's exactly how each metric is calculated and what admins can control.

### 1. BMR (Basal Metabolic Rate)

**What it is**: The number of calories your body burns at rest (just existing, not exercising).

**Formula**: Mifflin-St Jeor equation (industry standard)
- For men: `(10 × weight_kg) + (6.25 × height_cm) - (5 × age_years) + 5`
- For women: `(10 × weight_kg) + (6.25 × height_cm) - (5 × age_years) - 161`

**Inputs** (client provides during onboarding):
- Weight, height, age, biological sex

**Admin Control**: ❌ **NOT configurable** - Uses fixed scientific formula

**Example**: 30-year-old woman, 120 kg, 183 cm → BMR ≈ 1,900 kcal/day

---

### 2. TDEE (Total Daily Energy Expenditure)

**What it is**: Total calories burned per day including activity/exercise.

**Formula**: `TDEE = BMR × Activity Multiplier`

**Activity Multipliers** (client selects during onboarding):
| Activity Level | Multiplier | Description |
|---|---|---|
| Not Much | 1.2 | Sedentary (little or no exercise) |
| Light | 1.375 | Light exercise 1-3 days/week |
| Moderate | 1.55 | Moderate exercise 3-5 days/week |
| Heavy | 1.725 | Strenuous exercise 5-7 days/week |

**Admin Control**: ❌ **NOT configurable** - Uses fixed, science-backed multipliers

**Example**: BMR 1,900 × 1.375 (Light activity) = 2,612 kcal/day TDEE

---

### 3. Daily Calorie Goal

**What it is**: The recommended daily calorie target adjusted for the client's fitness goal.

**Formula** (based on client's goal):
- **Lose Weight**: `TDEE × 0.80` (20% deficit = ~1.5 lbs/week loss)
- **Maintain Weight**: `TDEE × 1.0` (no adjustment)
- **Gain Weight**: `TDEE + 500` kcal (consistent surplus for muscle gain)

All values rounded to nearest 10 kcal for simplicity.

**Inputs** (client provides):
- Goal selection (lose/maintain/gain)
- Current weight, target weight (informs validation, not calculation)

**Admin Control**: 
- ✅ **Configurable via validation bounds** (minDailyCalories, maxDailyCalories)
- If calculated goal falls outside bounds, client sees validation error and must adjust inputs
- Cannot set the 0.80 or +500 multipliers (fixed by fitness science)

**Example**: TDEE 2,612 with "Lose Weight" goal → 2,612 × 0.80 = 2,090 kcal/day

---

### 4. Macro Distribution (Protein, Carbs, Fat)

**What it is**: The breakdown of daily calories into three macronutrients.

**Default Distribution**: 40% Carbs, 30% Protein, 30% Fat

**Formula** (converts percentages to grams):
```
Protein grams = (Daily Goal Calories × Protein%) / 4 kcal/gram
Carbs grams = (Daily Goal Calories × Carbs%) / 4 kcal/gram
Fat grams = (Daily Goal Calories × Fat%) / 9 kcal/gram
```

**Caloric values per gram**:
- Protein: 4 kcal/gram
- Carbs: 4 kcal/gram
- Fat: 9 kcal/gram

**Admin Control**:
- ✅ **Configurable**: `defaultCarbsPercent`, `defaultProteinPercent`, `defaultFatPercent` (must sum to 100%)
- ✅ **Protein validation bounds**: `minProteinPerLb`, `maxProteinPerLb` 
  - If calculated protein is outside bounds, client sees error and must adjust percentages
  - Typical range: 0.4-2.0g per pound of body weight

**Example**: 2,090 kcal goal with 40/30/30 macros:
- Protein: 2,090 × 0.30 ÷ 4 = **157g**
- Carbs: 2,090 × 0.40 ÷ 4 = **209g**
- Fat: 2,090 × 0.30 ÷ 9 = **70g**

**Client Can Edit**: ✅ Yes! During plan review, clients can adjust macro percentages (carbs/protein/fat) as long as they sum to 100%. Platform automatically recalculates grams.

---

### 5. Water Goal

**What it is**: Recommended daily water intake for optimal hydration.

**Formula**: `Weight (kg) × 35 ml = Daily Water Goal`

**Inputs** (derived from):
- Current weight in kg (client provides in step 3)

**Admin Control**: ❌ **NOT configurable** - Uses fixed hydration science

**Client Can Edit**: ✅ Yes! During plan review, clients can manually adjust water target up/down

**Example**: 120 kg client → 120 × 35 = 4,200 ml/day (≈ 9 cups)

---

### 6. Body Fat Percentage

**What it is**: Estimated body fat percentage used for tracking and body composition insights.

**How it's Determined**: Client selects body fat range during onboarding (Low/Medium/High/Very High), then mapped to a percentage value.

**Formula**: 
```
Selected Range (e.g., "Low") → Lookup percentage in admin settings
Low → 12.5%, Medium → 20%, High → 30%, Very High → 37.5% (defaults)
```

**Admin Control**:
- ✅ **Fully configurable**: `bodyFatLowPercent`, `bodyFatMediumPercent`, `bodyFatHighPercent`, `bodyFatVeryHighPercent`
- Admin can adjust these midpoint values (e.g., set Low to 15% instead of 12.5%)
- Stored in baseline Entry for tracking

**Client Can Edit**: ❌ No (set during onboarding step 6, not editable in plan review)

---

### 7. Activity Targets (Steps & Workouts)

**What it is**: Optional daily and weekly fitness targets for tracking.

**Defaults**: 
- Daily steps: 0 (optional)
- Weekly workout minutes: 0 (optional)

**Admin Control**: ❌ **NOT configurable** - These are informational targets set by the client

**Client Can Edit**: ✅ Yes! During plan review, clients can set their:
- Daily steps target (e.g., 10,000 steps)
- Weekly workout minutes (e.g., 300 minutes)

---

## Calculation Flow Diagram

Here's how the fitness plan is calculated end-to-end:

```
CLIENT INPUTS (Onboarding Steps 1-10)
├─ Sex, Age, Weight (kg), Height (cm)
├─ Activity Level
└─ Goal (Lose/Maintain/Gain)

                    ↓

STEP 1: Calculate BMR
├─ Formula: Mifflin-St Jeor equation
├─ Inputs: Sex, Age, Weight, Height
├─ Admin Control: ❌ None
└─ Output: BMR (e.g., 1,900 kcal/day)

                    ↓

STEP 2: Calculate TDEE  
├─ Formula: BMR × Activity Multiplier (1.2 / 1.375 / 1.55 / 1.725)
├─ Inputs: BMR, Activity Level
├─ Admin Control: ❌ None
└─ Output: TDEE (e.g., 2,612 kcal/day)

                    ↓

STEP 3: Calculate Daily Goal
├─ Formula: 
│  ├─ If Lose: TDEE × 0.80
│  ├─ If Maintain: TDEE × 1.0
│  └─ If Gain: TDEE + 500
├─ Admin Control: ✅ minDailyCalories / maxDailyCalories bounds
├─ Validation: If outside bounds, client sees error
└─ Output: Daily Goal (e.g., 2,090 kcal/day)

                    ↓

STEP 4: Calculate Macros
├─ Default Percents: Carbs% / Protein% / Fat% (e.g., 40/30/30)
├─ Admin Control: ✅ defaultCarbsPercent / defaultProteinPercent / defaultFatPercent
├─ Conversion: Percents → Grams (4/4/9 kcal per gram)
│  ├─ Protein grams = (Goal × Protein%) / 4
│  ├─ Carbs grams = (Goal × Carbs%) / 4
│  └─ Fat grams = (Goal × Fat%) / 9
├─ Validation: ✅ minProteinPerLb / maxProteinPerLb bounds
└─ Output: Macro targets in grams (e.g., 157g protein, 209g carbs, 70g fat)

                    ↓

STEP 5: Calculate Water & Optional Targets
├─ Water = Weight (kg) × 35 = Daily ml (e.g., 4,200 ml)
├─ Steps target = Client input (optional)
├─ Workout minutes = Client input (optional)
├─ Admin Control: ❌ None
└─ Output: Complete nutrition plan

                    ↓

PLAN REVIEW (Step 11 - Client Can Edit)
├─ Client sees all calculated values
├─ Client CAN adjust:
│  ├─ Macro percentages (carbs/protein/fat)
│  ├─ Water goal
│  ├─ Daily steps
│  └─ Weekly workouts
├─ Client CANNOT adjust:
│  ├─ BMR, TDEE (fixed by science)
│  └─ Daily Goal (determined by TDEE + goal)
└─ On Save: Edited values stored in UserGoals
```

---

## Summary: What Admins Control vs. What Clients Control

| Metric | Calculated By | Admin Control | Client Can Edit |
|---|---|---|---|
| **BMR** | Mifflin-St Jeor formula | ❌ No | ❌ No |
| **TDEE** | BMR × activity multiplier | ❌ No | ❌ No |
| **Daily Goal** | TDEE ± goal adjustment | ✅ Via bounds (min/max kcal) | ❌ No |
| **Macro %** | Default 40/30/30 | ✅ Set defaults | ✅ Yes (percents only) |
| **Protein Validation** | Per-lb calculation | ✅ Via bounds (min/max g/lb) | ✅ Indirectly (via macro %) |
| **Water Goal** | Weight × 35 | ❌ No | ✅ Yes |
| **Body Fat %** | Client selection → lookup | ✅ Configure ranges | ❌ No |
| **Steps/Workouts** | Client input | ❌ No | ✅ Yes |

---

## Settings Categories

### 1. Coach Capacity Management

Controls how the system monitors coach-to-client ratios for platform health.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxClientsPerCoach` | integer | 50 | Maximum number of clients recommended per coach (informational) |
| `minClientsPerCoach` | integer | 10 | Minimum number of clients below which a coach is flagged as underutilized |

### 2. Engagement & Activity Tracking

Configures thresholds for detecting inactive clients and low engagement patterns.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `recentActivityDays` | integer | 14 | Window (in days) for checking recent activity |
| `lowEngagementEntries` | integer | 7 | Number of entries in recent window below which triggers low engagement alert |
| `noActivityDays` | integer | 14 | Days of no entries before "no activity" status |
| `criticalNoActivityDays` | integer | 30 | Days of no entries before critical alert |

### 3. Adherence Calculation

Sets the color-coding thresholds for client adherence metrics.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `adherenceGreenMinimum` | integer | 6 | Minimum entries per week for green (good) adherence |
| `adherenceAmberMinimum` | integer | 3 | Minimum entries per week for amber (warning) adherence; below triggers red |

### 4. Analytics Windows

Defines time windows used for trend calculations and historical analysis.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `shortTermWindowDays` | integer | 7 | Days for short-term trend analysis (e.g., weekly change) |
| `longTermWindowDays` | integer | 30 | Days for long-term trend analysis (e.g., monthly progress) |

### 5. Security & Admin

Configuration for admin override access and emergency operations.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `adminOverrideEmail` | string | null | Email address that automatically receives ADMIN role (emergency backdoor access) |

### 6. Feature Flags

Enable or disable major features across the platform.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `healthkitEnabled` | boolean | true | Show/hide HealthKit data explorer and integrations for coaches |
| `iosIntegrationEnabled` | boolean | true | Show/hide iOS pairing codes and device sync features |

---

## Onboarding Configuration

Configures all validation ranges and defaults for the 11-step client onboarding flow. These settings directly affect how the fitness plan is calculated and validated for new clients.

### Body Fat Percentage Ranges

Maps client-selected body fat categories to percentage values used in calculations. These represent the midpoint of each range.

**Related Calculation**: See [Body Fat Percentage](#6-body-fat-percentage) above for details on how this is used.

| Field | Type | Default | Description | Typical Range |
|-------|------|---------|-------------|---------------|
| `bodyFatLowPercent` | float | 12.5 | Midpoint for "Low" body fat category | 8-18% |
| `bodyFatMediumPercent` | float | 20.0 | Midpoint for "Medium" body fat category | 18-25% |
| `bodyFatHighPercent` | float | 30.0 | Midpoint for "High" body fat category | 25-35% |
| `bodyFatVeryHighPercent` | float | 37.5 | Midpoint for "Very High" body fat category | 35%+ |

**Usage**: When a client selects their body fat range (e.g., "Low"), the corresponding percentage is looked up from these settings and stored as `Entry.bodyFatPercentage` for tracking.

### Calorie Range Validation

Constrains the recommended daily calorie goal to ensure it stays within safe, practical bounds.

**Related Calculation**: See [Daily Calorie Goal](#3-daily-calorie-goal) above for how the calorie target is calculated.

| Field | Type | Default | Description | Notes |
|-------|------|---------|-------------|-------|
| `minDailyCalories` | integer | 1000 | Minimum allowed daily calorie recommendation (kcal) | Safety floor; prevents dangerously low intakes |
| `maxDailyCalories` | integer | 5000 | Maximum allowed daily calorie recommendation (kcal) | Practical ceiling; prevents extreme surplus |

**Validation**: During onboarding submission, if the calculated daily goal (TDEE adjusted for client's goal) falls outside this range, the form shows an error:
```
"Daily calories must be between {min} and {max} kcal"
```
The client can adjust their inputs (current weight, target weight, activity level) to bring the calculated goal within bounds.

### Protein Range Validation

### Protein Range Validation

Ensures recommended protein intake is physiologically sound, relative to body weight.

**Related Calculation**: See [Macro Distribution](#4-macro-distribution-protein-carbs-fat) above for how protein is calculated from percentages.

| Field | Type | Default | Description | Typical Range |
|-------|------|---------|-------------|---------------|
| `minProteinPerLb` | float | 0.4 | Minimum protein per pound of body weight (g/lb) | 0.3-0.5 g/lb |
| `maxProteinPerLb` | float | 2.0 | Maximum protein per pound of body weight (g/lb) | 1.5-2.2 g/lb |

**Validation**: During onboarding, calculated protein is validated as:
```
protein_per_lb = (protein_grams / weight_lbs)
if protein_per_lb < min or protein_per_lb > max:
  show error: "Protein must be between {min}-{max}g per pound of body weight"
```

Clients can then adjust their macro percentages to bring protein into the valid range.

**Typical use case**: A 200 lb person with bounds 0.4-2.0 g/lb should consume 80-400g protein per day.

### Default Macro Distribution

Sets the starting macro percentages when calculating the nutrition plan. These are defaults only—clients can adjust them during plan review.

**Related Calculation**: See [Macro Distribution](#4-macro-distribution-protein-carbs-fat) above for the complete calculation logic.

| Field | Type | Default | Description | Constraint |
|-------|------|---------|-------------|-----------|
| `defaultCarbsPercent` | float | 40 | Default carbohydrate percentage of total calories | 0-100 |
| `defaultProteinPercent` | float | 30 | Default protein percentage of total calories | 0-100 |
| `defaultFatPercent` | float | 30 | Default fat percentage of total calories | 0-100 |

**Important**: These three values **must sum to 100%** for a valid distribution. If they don't, clients may see confusing gram values.

**Conversion to Grams**: The platform converts percentages to grams using these caloric values:
- Carbs: 4 kcal/gram
- Protein: 4 kcal/gram
- Fat: 9 kcal/gram

**Example**: With daily goal of 2,000 kcal and 40/30/30 macros:
- Carbs: 2,000 × 0.40 ÷ 4 = **200g**
- Protein: 2,000 × 0.30 ÷ 4 = **150g**
- Fat: 2,000 × 0.30 ÷ 9 = **67g**

**Client Experience**: 
- Clients see these percentages as defaults during onboarding Step 11 (Plan Review)
- They can adjust the percentages using spin buttons
- Platform validates that adjusted percentages sum to 100%
- On save, percentages are converted to grams and stored in UserGoals

---

## Updating Settings

### Access Control

Only users with the `ADMIN` role can view and modify system settings at `/admin/settings`.

### How to Update

1. Navigate to **Admin Dashboard** → **System Settings**
2. Scroll to the relevant section (e.g., "Onboarding Configuration")
3. Edit the values in the form fields
4. Click **Save Settings**
5. The settings take effect immediately for all new onboardings

### Validation

The admin form validates:
- Numeric fields must be positive numbers (unless noted as optional)
- Macro percentages: While no strict enforcement, admin UI shows a warning if carbs + protein + fat ≠ 100
- Ranges: min values should be less than max values (runtime validation not enforced, but logically required)

### Impact on Existing Users

- Settings changes only affect **new client onboardings**
- Existing users retain the settings snapshot from when they completed onboarding (stored in `UserGoals` and `UserPreference`)
- To update an existing user's goals or preferences, use the client's settings menu or manually update `UserGoals` via Prisma Studio

---

## Common Configuration Scenarios

### Scenario 1: Stricter Calorie Control

**Goal**: Ensure all clients stay within a narrower calorie range for consistency.

**Changes**:
- `minDailyCalories`: 1200 (raise from 1000)
- `maxDailyCalories`: 3500 (lower from 5000)

**Effect**: New clients whose calculated goal falls outside 1200-3500 kcal will see validation errors and must adjust their inputs.

### Scenario 2: Higher Protein Expectations

**Goal**: Encourage higher protein intake for muscle retention.

**Changes**:
- `minProteinPerLb`: 0.8 (raise from 0.4)
- `maxProteinPerLb`: 2.2 (keep or raise)

**Effect**: New clients must consume at least 0.8g protein per pound of body weight or will see a validation error.

### Scenario 3: Different Macro Philosophy

**Goal**: Shift to lower-carb, higher-fat defaults.

**Changes**:
- `defaultCarbsPercent`: 30 (lower from 40)
- `defaultProteinPercent`: 35 (raise from 30)
- `defaultFatPercent`: 35 (raise from 30)

**Effect**: New clients see 30/35/35 as their starting macro split; they can adjust during plan review. Existing clients keep their 40/30/30 split.

### Scenario 4: Disable Feature

**Goal**: Hide iOS integration features while fixing a bug.

**Changes**:
- `iosIntegrationEnabled`: false

**Effect**: Pairing code UI, device sync features disappear for coaches; existing paired devices continue syncing until further notice.

---

## Troubleshooting

### Q: A client completed onboarding but the nutrition plan doesn't match current settings

**A**: Settings changes only apply to new onboardings. The client's plan reflects settings from when they completed onboarding. To update, have them reset onboarding (Settings → Reset Onboarding) and re-complete it.

### Q: Clients keep getting calorie validation errors after I raised `maxDailyCalories`

**A**: Check their input values (current weight, target weight, activity level). The calculated calorie goal may still exceed your new max. You can:
1. Raise `maxDailyCalories` higher, or
2. Guide the client to use a less aggressive goal (e.g., "lose weight faster" → higher deficit → lower calories)

### Q: Macro percents don't add up to 100 but the UI allows it

**A**: The form has a warning but doesn't block save. If you set 40/30/29, clients will see incorrect gram values. Always ensure the three values sum to 100 before saving.

### Q: I changed `adminOverrideEmail` but the user still doesn't have admin access

**A**: The user must sign out and back in for the override to take effect. JWT tokens cache role information for 1 hour, so a fresh login forces a new token generation with the updated admin override check.

---

## Related Files

- **Schema**: [prisma/schema.prisma](../../prisma/schema.prisma) — `SystemSettings` model definition
- **Defaults**: [lib/system-settings.ts](../../lib/system-settings.ts) — Default values and types
- **Admin UI**: [app/admin/settings/page.tsx](../../app/admin/settings/page.tsx) — Settings form
- **Calculations**: [lib/calculations/fitness.ts](../../lib/calculations/fitness.ts) — Functions that use these settings
- **API**: [app/api/admin/settings](../../app/api/admin/settings) — Settings API endpoints

---

## Version History

**Version 1.0** (Initial Onboarding Release)
- Added body fat percentage ranges (4 fields)
- Added calorie range validation (2 fields)
- Added protein range validation (2 fields)
- Added default macro distribution (3 fields)
- Total: 10 new onboarding configuration fields
