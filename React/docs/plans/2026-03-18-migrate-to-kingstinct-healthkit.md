# Migrate iOS HealthKit from react-native-health to @kingstinct/react-native-healthkit

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the stale `react-native-health` library with the actively-maintained `@kingstinct/react-native-healthkit` for all iOS health data access.

**Architecture:** The app has a clean `HealthService` interface (`src/types/health.ts`) with platform-specific implementations (`healthkit.ios.ts` / `healthkit.android.ts`). Only `healthkit.ios.ts` needs rewriting — it currently uses `NativeModules.AppleHealthKit` from `react-native-health` via manual `promisify` wrappers. The new library provides native TypeScript, Promise-based APIs, and proper date-based aggregation. No changes to the Android side, the `HealthService` interface, or any UI code.

**Tech Stack:** `@kingstinct/react-native-healthkit@13.3.1`, `react-native-nitro-modules`, Expo SDK 55, React Native 0.83.2

---

## Pre-Migration Notes

**Current state of `healthkit.ios.ts`:**
- 594 lines
- Accesses `NativeModules.AppleHealthKit` directly (bypasses react-native-health's broken ESM export)
- Uses `promisify()` to wrap all callback-based APIs
- Implements the full `HealthService` interface (23 methods)
- Exports `iosHealthService` object consumed by `health.ts`

**What stays the same:**
- `src/types/health.ts` — no changes (HealthService interface, all data types)
- `src/services/health.ts` — no changes (imports `iosHealthService` from `./healthkit.ios`)
- `src/services/healthkit.android.ts` — no changes
- All UI screens — no changes
- `app.json` iOS entitlements — already has HealthKit + background delivery

**Key API mapping (react-native-health → @kingstinct/react-native-healthkit):**

| react-native-health | @kingstinct/react-native-healthkit |
|---------------------|-------------------------------------|
| `AppleHealthKit.isAvailable(cb)` | `isHealthDataAvailable()` |
| `AppleHealthKit.initHealthKit(perms, cb)` | `requestAuthorization({ toRead: [...], toShare: [...] })` |
| `AppleHealthKit.getDailyStepCountSamples(opts, cb)` | `queryQuantitySamples(QuantityTypeIdentifier.stepCount, { from, to })` |
| `AppleHealthKit.getActiveEnergyBurned(opts, cb)` | `queryQuantitySamples(QuantityTypeIdentifier.activeEnergyBurned, ...)` |
| `AppleHealthKit.getBasalEnergyBurned(opts, cb)` | `queryQuantitySamples(QuantityTypeIdentifier.basalEnergyBurned, ...)` |
| `AppleHealthKit.getHeartRateSamples(opts, cb)` | `queryQuantitySamples(QuantityTypeIdentifier.heartRate, ...)` |
| `AppleHealthKit.getSleepSamples(opts, cb)` | `queryCategorySamples(CategoryTypeIdentifier.sleepAnalysis, ...)` |
| `AppleHealthKit.getSamples({type: 'Workout'}, cb)` | `queryWorkoutSamples({ from, to })` |
| `AppleHealthKit.saveFood(data, cb)` | `saveCorrelationSample(CorrelationTypeIdentifier.food, ...)` |
| `AppleHealthKit.saveWater(data, cb)` | `saveQuantitySample(QuantityTypeIdentifier.dietaryWater, ...)` |
| `AppleHealthKit.saveWeight(data, cb)` | `saveQuantitySample(QuantityTypeIdentifier.bodyMass, ...)` |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `app.json`

**Step 1: Install the new library and its peer dependency**

Run:
```bash
cd /Users/adambrown/Developer/CoachFit/React
npm install @kingstinct/react-native-healthkit react-native-nitro-modules
```

**Step 2: Remove react-native-health**

Run:
```bash
npm uninstall react-native-health
```

**Step 3: Add the Expo config plugin to app.json**

In `app.json`, add `@kingstinct/react-native-healthkit` to the plugins array. Keep the existing `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` from the infoPlist section — the plugin provides defaults but we want our custom descriptions. Add background delivery support:

```json
{
  "expo": {
    "plugins": [
      "expo-sqlite",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow CoachFit to use the camera to scan barcodes."
        }
      ],
      [
        "@kingstinct/react-native-healthkit",
        {
          "NSHealthShareUsageDescription": "CoachFit reads your health data to display activity, nutrition, and body metrics.",
          "NSHealthUpdateUsageDescription": "CoachFit writes nutrition entries from scanned foods to your Health data.",
          "background": true
        }
      ]
    ]
  }
}
```

**Step 4: Reinstall pods**

Run:
```bash
cd ios && pod install && cd ..
```

**Step 5: Commit**

```bash
git add package.json package-lock.json app.json ios/Podfile.lock
git commit -m "chore: replace react-native-health with @kingstinct/react-native-healthkit"
```

---

## Task 2: Rewrite healthkit.ios.ts — Imports, Helpers, and Permissions

**Files:**
- Modify: `src/services/healthkit.ios.ts` (replace lines 1-162)

**Step 1: Replace the entire top section (imports through requestPermissions)**

Replace everything from line 1 through the `requestPermissions` method (line 162) with:

```typescript
import {
  isHealthDataAvailable,
  requestAuthorization,
  queryQuantitySamples,
  queryCategorySamples,
  queryWorkoutSamples,
  saveQuantitySample,
  saveCorrelationSample,
  QuantityTypeIdentifier,
  CategoryTypeIdentifier,
  CorrelationTypeIdentifier,
} from '@kingstinct/react-native-healthkit';
import type {
  HealthService,
  HealthPermissions,
  HealthPermissionStatus,
  StepsData,
  CaloriesBurnedData,
  DistanceData,
  ExerciseSession,
  FloorsClimbedData,
  HeartRateData,
  HeartRateSummary,
  BloodPressureData,
  BloodGlucoseData,
  OxygenSaturationData,
  RespiratoryRateData,
  BodyTemperatureData,
  WeightData,
  HeightData,
  BodyFatData,
  LeanBodyMassData,
  BodyWaterMassData,
  BasalMetabolicRateData,
  WaistCircumferenceData,
  NutritionEntry,
  HydrationData,
  SleepSession,
  DailyHealthSummary,
} from '../types/health';

function dateStr(d: Date | string): string {
  return typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0];
}

// All HealthKit types we read
const READ_IDENTIFIERS = [
  QuantityTypeIdentifier.stepCount,
  QuantityTypeIdentifier.activeEnergyBurned,
  QuantityTypeIdentifier.basalEnergyBurned,
  QuantityTypeIdentifier.distanceWalkingRunning,
  QuantityTypeIdentifier.flightsClimbed,
  QuantityTypeIdentifier.heartRate,
  QuantityTypeIdentifier.restingHeartRate,
  QuantityTypeIdentifier.bloodPressureSystolic,
  QuantityTypeIdentifier.bloodPressureDiastolic,
  QuantityTypeIdentifier.bloodGlucose,
  QuantityTypeIdentifier.oxygenSaturation,
  QuantityTypeIdentifier.respiratoryRate,
  QuantityTypeIdentifier.bodyTemperature,
  QuantityTypeIdentifier.bodyMass,
  QuantityTypeIdentifier.height,
  QuantityTypeIdentifier.bodyFatPercentage,
  QuantityTypeIdentifier.leanBodyMass,
  QuantityTypeIdentifier.basalBodyTemperature,
  QuantityTypeIdentifier.dietaryWater,
  QuantityTypeIdentifier.dietaryEnergyConsumed,
  CategoryTypeIdentifier.sleepAnalysis,
  'HKWorkoutTypeIdentifier',
] as const;

// Types we write
const WRITE_IDENTIFIERS = [
  QuantityTypeIdentifier.bodyMass,
  QuantityTypeIdentifier.dietaryWater,
  CorrelationTypeIdentifier.food,
] as const;

// ── iOS HealthKit Service Implementation ────────────────────────────
export const iosHealthService: HealthService = {
  async isAvailable(): Promise<boolean> {
    try {
      return await isHealthDataAvailable();
    } catch {
      return false;
    }
  },

  async requestPermissions(_permissions: HealthPermissions): Promise<HealthPermissionStatus> {
    try {
      await requestAuthorization({
        toRead: [...READ_IDENTIFIERS] as string[],
        toShare: [...WRITE_IDENTIFIERS] as string[],
      });
      return 'granted';
    } catch {
      return 'denied';
    }
  },
```

**Step 2: Verify TypeScript compiles for this section**

Run:
```bash
npx tsc --noEmit src/services/healthkit.ios.ts 2>&1 | head -20
```

Note: This will show errors for the missing method implementations below — that's expected. We're just checking that the imports and permission setup are correct.

---

## Task 3: Rewrite healthkit.ios.ts — Activity Methods

**Files:**
- Modify: `src/services/healthkit.ios.ts` (replace getSteps through getFloorsClimbed)

**Step 1: Replace the activity methods**

Replace `getSteps`, `getCaloriesBurned`, `getDistance`, `getExerciseSessions`, and `getFloorsClimbed` with:

```typescript
  // ── Activity ────────────────────────────────────────────────────
  async getSteps(startDate: Date, endDate: Date): Promise<StepsData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.stepCount, {
      from: startDate,
      to: endDate,
    });
    const byDate = new Map<string, number>();
    for (const s of samples) {
      const d = dateStr(s.startDate);
      byDate.set(d, (byDate.get(d) || 0) + s.quantity);
    }
    return Array.from(byDate.entries()).map(([date, value]) => ({ date, value: Math.round(value) }));
  },

  async getCaloriesBurned(startDate: Date, endDate: Date): Promise<CaloriesBurnedData[]> {
    const [active, basal] = await Promise.all([
      queryQuantitySamples(QuantityTypeIdentifier.activeEnergyBurned, { from: startDate, to: endDate }),
      queryQuantitySamples(QuantityTypeIdentifier.basalEnergyBurned, { from: startDate, to: endDate }),
    ]);

    const byDate = new Map<string, { active: number; basal: number }>();

    for (const a of active) {
      const d = dateStr(a.startDate);
      const entry = byDate.get(d) || { active: 0, basal: 0 };
      entry.active += a.quantity;
      byDate.set(d, entry);
    }

    for (const b of basal) {
      const d = dateStr(b.startDate);
      const entry = byDate.get(d) || { active: 0, basal: 0 };
      entry.basal += b.quantity;
      byDate.set(d, entry);
    }

    return Array.from(byDate.entries()).map(([date, vals]) => ({
      date,
      activeCalories: Math.round(vals.active),
      basalCalories: Math.round(vals.basal),
      totalCalories: Math.round(vals.active + vals.basal),
    }));
  },

  async getDistance(startDate: Date, endDate: Date): Promise<DistanceData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.distanceWalkingRunning, {
      from: startDate,
      to: endDate,
    });
    const byDate = new Map<string, number>();
    for (const s of samples) {
      const d = dateStr(s.startDate);
      byDate.set(d, (byDate.get(d) || 0) + s.quantity);
    }
    return Array.from(byDate.entries()).map(([date, meters]) => ({
      date,
      distanceMeters: Math.round(meters * 1000), // km to m — verify unit from library
    }));
  },

  async getExerciseSessions(startDate: Date, endDate: Date): Promise<ExerciseSession[]> {
    const workouts = await queryWorkoutSamples({ from: startDate, to: endDate });

    return workouts.map((w) => {
      const start = new Date(w.startDate);
      const end = new Date(w.endDate);
      return {
        startDate: w.startDate,
        endDate: w.endDate,
        type: w.workoutActivityType?.replace('HKWorkoutActivityType', '') || 'Unknown',
        durationMinutes: Math.round(w.duration / 60), // duration is in seconds
        caloriesBurned: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned.quantity) : undefined,
        distanceMeters: w.totalDistance ? Math.round(w.totalDistance.quantity * 1000) : undefined,
      };
    });
  },

  async getFloorsClimbed(startDate: Date, endDate: Date): Promise<FloorsClimbedData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.flightsClimbed, {
      from: startDate,
      to: endDate,
    });
    return samples.map((s) => ({ date: dateStr(s.startDate), floors: s.quantity }));
  },
```

---

## Task 4: Rewrite healthkit.ios.ts — Heart & Vitals Methods

**Files:**
- Modify: `src/services/healthkit.ios.ts` (replace heart rate through body temperature methods)

**Step 1: Replace all heart & vitals methods**

```typescript
  // ── Heart & Vitals ──────────────────────────────────────────────
  async getHeartRate(startDate: Date, endDate: Date): Promise<HeartRateData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.heartRate, {
      from: startDate,
      to: endDate,
    });
    return samples.map((s) => ({ date: s.startDate, bpm: Math.round(s.quantity) }));
  },

  async getHeartRateSummary(startDate: Date, endDate: Date): Promise<HeartRateSummary[]> {
    const samples = await this.getHeartRate(startDate, endDate);

    const byDate = new Map<string, number[]>();
    for (const s of samples) {
      const d = dateStr(s.date);
      const arr = byDate.get(d) || [];
      arr.push(s.bpm);
      byDate.set(d, arr);
    }

    return Array.from(byDate.entries()).map(([date, bpms]) => ({
      date,
      averageBpm: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
      minBpm: Math.min(...bpms),
      maxBpm: Math.max(...bpms),
    }));
  },

  async getRestingHeartRate(startDate: Date, endDate: Date): Promise<HeartRateData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.restingHeartRate, {
      from: startDate,
      to: endDate,
    });
    return samples.map((s) => ({ date: s.startDate, bpm: Math.round(s.quantity) }));
  },

  async getBloodPressure(startDate: Date, endDate: Date): Promise<BloodPressureData[]> {
    const [systolic, diastolic] = await Promise.all([
      queryQuantitySamples(QuantityTypeIdentifier.bloodPressureSystolic, { from: startDate, to: endDate }),
      queryQuantitySamples(QuantityTypeIdentifier.bloodPressureDiastolic, { from: startDate, to: endDate }),
    ]);

    // Pair systolic and diastolic by timestamp
    return systolic.map((s, i) => ({
      date: s.startDate,
      systolic: Math.round(s.quantity),
      diastolic: diastolic[i] ? Math.round(diastolic[i].quantity) : 0,
    }));
  },

  async getBloodGlucose(startDate: Date, endDate: Date): Promise<BloodGlucoseData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.bloodGlucose, {
      from: startDate,
      to: endDate,
    });
    return samples.map((s) => ({ date: s.startDate, mgPerDL: s.quantity }));
  },

  async getOxygenSaturation(startDate: Date, endDate: Date): Promise<OxygenSaturationData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.oxygenSaturation, {
      from: startDate,
      to: endDate,
    });
    return samples.map((s) => ({
      date: s.startDate,
      percentage: s.quantity * 100, // HealthKit returns 0-1
    }));
  },

  async getRespiratoryRate(startDate: Date, endDate: Date): Promise<RespiratoryRateData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.respiratoryRate, {
      from: startDate,
      to: endDate,
    });
    return samples.map((s) => ({ date: s.startDate, breathsPerMinute: s.quantity }));
  },

  async getBodyTemperature(startDate: Date, endDate: Date): Promise<BodyTemperatureData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.bodyTemperature, {
      from: startDate,
      to: endDate,
    });
    return samples.map((s) => ({ date: s.startDate, celsius: s.quantity }));
  },
```

---

## Task 5: Rewrite healthkit.ios.ts — Body Measurements

**Files:**
- Modify: `src/services/healthkit.ios.ts` (replace weight through waist circumference methods)

**Step 1: Replace all body measurement methods**

```typescript
  // ── Body Measurements ───────────────────────────────────────────
  async getWeight(startDate: Date, endDate: Date): Promise<WeightData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.bodyMass, {
      from: startDate,
      to: endDate,
      unit: 'kg',
    });
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      kilograms: Math.round(s.quantity * 10) / 10,
    }));
  },

  async getHeight(startDate: Date, endDate: Date): Promise<HeightData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.height, {
      from: startDate,
      to: endDate,
      unit: 'cm',
    });
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      centimeters: Math.round(s.quantity * 10) / 10,
    }));
  },

  async getBodyFat(startDate: Date, endDate: Date): Promise<BodyFatData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.bodyFatPercentage, {
      from: startDate,
      to: endDate,
    });
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      percentage: Math.round(s.quantity * 1000) / 10, // HealthKit returns 0-1, we want 0-100
    }));
  },

  async getLeanBodyMass(startDate: Date, endDate: Date): Promise<LeanBodyMassData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.leanBodyMass, {
      from: startDate,
      to: endDate,
      unit: 'kg',
    });
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      kilograms: Math.round(s.quantity * 10) / 10,
    }));
  },

  async getBodyWaterMass(_startDate: Date, _endDate: Date): Promise<BodyWaterMassData[]> {
    // Not directly available in Apple HealthKit
    return [];
  },

  async getBasalMetabolicRate(startDate: Date, endDate: Date): Promise<BasalMetabolicRateData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.basalEnergyBurned, {
      from: startDate,
      to: endDate,
      unit: 'kcal',
    });
    // BMR is typically one sample per day
    const byDate = new Map<string, number>();
    for (const s of samples) {
      const d = dateStr(s.startDate);
      byDate.set(d, (byDate.get(d) || 0) + s.quantity);
    }
    return Array.from(byDate.entries()).map(([date, kcal]) => ({
      date,
      kcalPerDay: Math.round(kcal),
    }));
  },

  async getWaistCircumference(startDate: Date, endDate: Date): Promise<WaistCircumferenceData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.waistCircumference, {
      from: startDate,
      to: endDate,
      unit: 'cm',
    });
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      centimeters: Math.round(s.quantity * 10) / 10,
    }));
  },
```

---

## Task 6: Rewrite healthkit.ios.ts — Nutrition, Hydration, and Write Methods

**Files:**
- Modify: `src/services/healthkit.ios.ts` (replace nutrition through writeWeight methods)

**Step 1: Replace nutrition, hydration, and write methods**

```typescript
  // ── Nutrition ───────────────────────────────────────────────────
  async getNutrition(startDate: Date, endDate: Date): Promise<NutritionEntry[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.dietaryEnergyConsumed, {
      from: startDate,
      to: endDate,
      unit: 'kcal',
    });
    return samples.map((s) => ({
      date: s.startDate,
      calories: Math.round(s.quantity),
    }));
  },

  async writeNutrition(entry: NutritionEntry): Promise<void> {
    // Save as a food correlation with individual nutrient quantities
    const nutritionSamples: Array<{ identifier: string; unit: string; value: number }> = [
      { identifier: QuantityTypeIdentifier.dietaryEnergyConsumed, unit: 'kcal', value: entry.calories },
    ];

    if (entry.protein) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryProtein, unit: 'g', value: entry.protein });
    if (entry.totalFat) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryFatTotal, unit: 'g', value: entry.totalFat });
    if (entry.carbohydrates) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryCarbohydrates, unit: 'g', value: entry.carbohydrates });
    if (entry.sugar) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietarySugar, unit: 'g', value: entry.sugar });
    if (entry.fiber) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryFiber, unit: 'g', value: entry.fiber });
    if (entry.saturatedFat) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryFatSaturated, unit: 'g', value: entry.saturatedFat });
    if (entry.cholesterol) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryCholesterol, unit: 'mg', value: entry.cholesterol });
    if (entry.sodium) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietarySodium, unit: 'mg', value: entry.sodium });
    if (entry.potassium) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryPotassium, unit: 'mg', value: entry.potassium });
    if (entry.calcium) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryCalcium, unit: 'mg', value: entry.calcium });
    if (entry.iron) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryIron, unit: 'mg', value: entry.iron });
    if (entry.vitaminA) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryVitaminA, unit: 'mcg', value: entry.vitaminA });
    if (entry.vitaminC) nutritionSamples.push({ identifier: QuantityTypeIdentifier.dietaryVitaminC, unit: 'mg', value: entry.vitaminC });

    const date = new Date(entry.date);

    // Save each nutrient as an individual quantity sample
    await Promise.all(
      nutritionSamples.map((n) =>
        saveQuantitySample(n.identifier as any, {
          unit: n.unit,
          value: n.value,
          startDate: date,
          endDate: date,
        })
      )
    );
  },

  async getHydration(startDate: Date, endDate: Date): Promise<HydrationData[]> {
    const samples = await queryQuantitySamples(QuantityTypeIdentifier.dietaryWater, {
      from: startDate,
      to: endDate,
      unit: 'mL',
    });

    const byDate = new Map<string, number>();
    for (const s of samples) {
      const d = dateStr(s.startDate);
      byDate.set(d, (byDate.get(d) || 0) + s.quantity);
    }

    return Array.from(byDate.entries()).map(([date, ml]) => ({
      date,
      liters: Math.round(ml / 100) / 10,
    }));
  },

  async writeHydration(entry: HydrationData): Promise<void> {
    const date = new Date(entry.date);
    await saveQuantitySample(QuantityTypeIdentifier.dietaryWater, {
      unit: 'mL',
      value: entry.liters * 1000,
      startDate: date,
      endDate: date,
    });
  },

  async writeWeight(entry: WeightData): Promise<void> {
    const date = new Date(entry.date);
    await saveQuantitySample(QuantityTypeIdentifier.bodyMass, {
      unit: 'kg',
      value: entry.kilograms,
      startDate: date,
      endDate: date,
    });
  },
```

---

## Task 7: Rewrite healthkit.ios.ts — Sleep and getDailySummary

**Files:**
- Modify: `src/services/healthkit.ios.ts` (replace sleep and summary methods)

**Step 1: Replace sleep and getDailySummary methods, close the export**

```typescript
  // ── Sleep ───────────────────────────────────────────────────────
  async getSleep(startDate: Date, endDate: Date): Promise<SleepSession[]> {
    const samples = await queryCategorySamples(CategoryTypeIdentifier.sleepAnalysis, {
      from: startDate,
      to: endDate,
    });

    const sessions: SleepSession[] = [];
    let currentSession: SleepSession | null = null;

    for (const s of samples) {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

      // Map HealthKit sleep analysis values
      const stage = s.value === 0 ? 'awake' as const :    // InBed
                    s.value === 1 ? 'light' as const :     // Asleep (unspecified)
                    s.value === 3 ? 'deep' as const :      // AsleepDeep
                    s.value === 4 ? 'light' as const :     // AsleepCore
                    s.value === 5 ? 'rem' as const :       // AsleepREM
                    'unknown' as const;

      if (
        !currentSession ||
        start.getTime() - new Date(currentSession.endDate).getTime() > 3600000
      ) {
        if (currentSession) sessions.push(currentSession);
        currentSession = {
          startDate: s.startDate,
          endDate: s.endDate,
          totalMinutes: durationMinutes,
          stages: [{ stage, startDate: s.startDate, endDate: s.endDate, durationMinutes }],
        };
      } else {
        currentSession.endDate = s.endDate;
        currentSession.totalMinutes += durationMinutes;
        currentSession.stages?.push({
          stage,
          startDate: s.startDate,
          endDate: s.endDate,
          durationMinutes,
        });
      }
    }

    if (currentSession) sessions.push(currentSession);
    return sessions;
  },

  // ── Aggregated Summary ──────────────────────────────────────────
  async getDailySummary(date: Date): Promise<DailyHealthSummary> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [steps, calories, distance, weight, bodyFat, bmr, sleep, hydration, exercises] =
      await Promise.allSettled([
        this.getSteps(startOfDay, endOfDay),
        this.getCaloriesBurned(startOfDay, endOfDay),
        this.getDistance(startOfDay, endOfDay),
        this.getWeight(startOfDay, endOfDay),
        this.getBodyFat(startOfDay, endOfDay),
        this.getBasalMetabolicRate(startOfDay, endOfDay),
        this.getSleep(startOfDay, endOfDay),
        this.getHydration(startOfDay, endOfDay),
        this.getExerciseSessions(startOfDay, endOfDay),
      ]);

    const stepsVal = steps.status === 'fulfilled' && steps.value.length > 0
      ? steps.value.reduce((sum, s) => sum + s.value, 0)
      : undefined;
    const calsVal = calories.status === 'fulfilled' && calories.value[0];
    const distVal = distance.status === 'fulfilled' && distance.value[0]?.distanceMeters;
    const weightVal = weight.status === 'fulfilled' && weight.value[0]?.kilograms;
    const bfVal = bodyFat.status === 'fulfilled' && bodyFat.value[0]?.percentage;
    const bmrVal = bmr.status === 'fulfilled' && bmr.value[0]?.kcalPerDay;
    const sleepVal = sleep.status === 'fulfilled' && sleep.value[0]?.totalMinutes;
    const waterVal = hydration.status === 'fulfilled' && hydration.value[0]?.liters;
    const exerciseMinutes = exercises.status === 'fulfilled'
      ? exercises.value.reduce((sum, e) => sum + e.durationMinutes, 0)
      : undefined;

    return {
      date: dateStr(date),
      steps: stepsVal,
      activeCalories: calsVal ? calsVal.activeCalories : undefined,
      basalCalories: calsVal ? calsVal.basalCalories : undefined,
      totalCaloriesBurned: calsVal ? calsVal.totalCalories : undefined,
      distanceMeters: distVal || undefined,
      exerciseMinutes: exerciseMinutes || undefined,
      weight: weightVal || undefined,
      bodyFatPercentage: bfVal || undefined,
      basalMetabolicRate: bmrVal || undefined,
      sleepMinutes: sleepVal || undefined,
      waterLiters: waterVal || undefined,
    };
  },
};
```

---

## Task 8: TypeScript Compilation Check

**Step 1: Run TypeScript compiler to catch type errors**

Run:
```bash
cd /Users/adambrown/Developer/CoachFit/React && npx tsc --noEmit 2>&1 | grep -E "healthkit\.ios|error TS"
```

Expected: No errors from `healthkit.ios.ts`. The Kingstinct library has native TypeScript definitions, so mismatched property names (e.g., `quantity` vs `value`) will show immediately.

**Step 2: Fix any type mismatches**

The most likely issues:
- `queryQuantitySamples` returns `{ quantity: number, startDate: string, endDate: string, ... }` — verify property names match
- `queryWorkoutSamples` returns workout objects — verify `duration`, `totalEnergyBurned`, `totalDistance` property shapes
- `saveQuantitySample` signature — verify parameter order and types
- `queryCategorySamples` return shape — verify `value` is numeric (sleep stage enum)

Refer to the library's TypeScript types:
```bash
cat node_modules/@kingstinct/react-native-healthkit/src/index.ts | head -100
```

**Step 3: Fix distance unit**

The old library returned distances in km. The Kingstinct library returns in the user's preferred unit. Check if `distanceWalkingRunning` returns meters or km and adjust the `* 1000` multiplier accordingly:
- If already in meters: remove `* 1000`
- If in km: keep `* 1000`

You can verify by checking the library's default unit for distance or by specifying `unit: 'm'` in the query options.

**Step 4: Commit the full rewrite**

```bash
git add src/services/healthkit.ios.ts
git commit -m "feat: migrate iOS health service to @kingstinct/react-native-healthkit

Replaces react-native-health (stale, Obj-C, 120 open issues) with
@kingstinct/react-native-healthkit (active, Swift + Nitro, native TS).
All 23 HealthService methods reimplemented. No changes to the
HealthService interface, Android implementation, or UI code."
```

---

## Task 9: Rebuild and Smoke Test

**Step 1: Clean build the iOS app**

Run:
```bash
cd /Users/adambrown/Developer/CoachFit/React
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..
npx expo run:ios
```

**Step 2: Smoke test on device/simulator**

Test each area in the app:

1. **Permissions flow**: Open app → should prompt for HealthKit permissions → grant all
2. **Health Dashboard**: Should show today's steps, calories, distance, heart rate
3. **Steps accuracy**: Compare step count in app vs Apple Health app — should now match (fixes the 9-vs-4964 bug from earlier)
4. **Food logging**: Scan a barcode or manually enter food → should save to HealthKit → verify in Apple Health app
5. **Water logging**: Log water → verify in Apple Health app
6. **Weight logging**: Log weight → verify in Apple Health app
7. **Weekly view**: Check that 7-day history loads correctly
8. **Sleep data**: If sleep data exists, verify it displays

**Step 3: Check that Xcode warnings are reduced**

Build in Xcode and verify:
- All `RNAppleHealthKit` warnings should be GONE (the whole target is removed)
- No new warnings from `@kingstinct/react-native-healthkit`

---

## Task 10: Clean Up

**Step 1: Remove any leftover react-native-health references**

Run:
```bash
grep -r "react-native-health" src/ --include="*.ts" --include="*.tsx"
```

Expected: No matches (only `react-native-health-connect` for Android should remain in `healthkit.android.ts`).

**Step 2: Verify no native module references remain**

Run:
```bash
grep -r "NativeModules.AppleHealthKit\|AppleHealthKit\." src/ --include="*.ts"
```

Expected: No matches.

**Step 3: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: clean up react-native-health references after migration"
```

---

## Rollback Procedure

If the migration causes issues:

1. Revert the branch: `git revert HEAD~N` (where N = number of migration commits)
2. Reinstall old dependency: `npm install react-native-health@^1.19.0`
3. Remove new dependencies: `npm uninstall @kingstinct/react-native-healthkit react-native-nitro-modules`
4. Remove plugin from `app.json`
5. Rebuild: `npx expo prebuild --clean --platform ios && cd ios && pod install && cd ..`

The `HealthService` interface and all consumers are unchanged, so the rollback only touches `healthkit.ios.ts`, `package.json`, and `app.json`.
