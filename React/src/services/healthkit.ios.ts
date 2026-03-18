import {
  isHealthDataAvailable,
  requestAuthorization,
  queryQuantitySamples,
  queryCategorySamples,
  queryWorkoutSamples,
  saveQuantitySample,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import type {
  QuantityTypeIdentifier,
  CategoryTypeIdentifier,
  ObjectTypeIdentifier,
  SampleTypeIdentifierWriteable,
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

function isoStr(d: Date | string): string {
  return typeof d === 'string' ? d : d.toISOString();
}

// HealthKit quantity type identifier strings
const QTI = {
  stepCount: 'HKQuantityTypeIdentifierStepCount' as QuantityTypeIdentifier,
  activeEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned' as QuantityTypeIdentifier,
  basalEnergyBurned: 'HKQuantityTypeIdentifierBasalEnergyBurned' as QuantityTypeIdentifier,
  distanceWalkingRunning: 'HKQuantityTypeIdentifierDistanceWalkingRunning' as QuantityTypeIdentifier,
  flightsClimbed: 'HKQuantityTypeIdentifierFlightsClimbed' as QuantityTypeIdentifier,
  heartRate: 'HKQuantityTypeIdentifierHeartRate' as QuantityTypeIdentifier,
  restingHeartRate: 'HKQuantityTypeIdentifierRestingHeartRate' as QuantityTypeIdentifier,
  bloodPressureSystolic: 'HKQuantityTypeIdentifierBloodPressureSystolic' as QuantityTypeIdentifier,
  bloodPressureDiastolic: 'HKQuantityTypeIdentifierBloodPressureDiastolic' as QuantityTypeIdentifier,
  bloodGlucose: 'HKQuantityTypeIdentifierBloodGlucose' as QuantityTypeIdentifier,
  oxygenSaturation: 'HKQuantityTypeIdentifierOxygenSaturation' as QuantityTypeIdentifier,
  respiratoryRate: 'HKQuantityTypeIdentifierRespiratoryRate' as QuantityTypeIdentifier,
  bodyTemperature: 'HKQuantityTypeIdentifierBodyTemperature' as QuantityTypeIdentifier,
  bodyMass: 'HKQuantityTypeIdentifierBodyMass' as QuantityTypeIdentifier,
  height: 'HKQuantityTypeIdentifierHeight' as QuantityTypeIdentifier,
  bodyFatPercentage: 'HKQuantityTypeIdentifierBodyFatPercentage' as QuantityTypeIdentifier,
  leanBodyMass: 'HKQuantityTypeIdentifierLeanBodyMass' as QuantityTypeIdentifier,
  basalBodyTemperature: 'HKQuantityTypeIdentifierBasalBodyTemperature' as QuantityTypeIdentifier,
  waistCircumference: 'HKQuantityTypeIdentifierWaistCircumference' as QuantityTypeIdentifier,
  dietaryWater: 'HKQuantityTypeIdentifierDietaryWater' as QuantityTypeIdentifier,
  dietaryEnergyConsumed: 'HKQuantityTypeIdentifierDietaryEnergyConsumed' as QuantityTypeIdentifier,
  dietaryProtein: 'HKQuantityTypeIdentifierDietaryProtein' as QuantityTypeIdentifier,
  dietaryFatTotal: 'HKQuantityTypeIdentifierDietaryFatTotal' as QuantityTypeIdentifier,
  dietaryCarbohydrates: 'HKQuantityTypeIdentifierDietaryCarbohydrates' as QuantityTypeIdentifier,
  dietarySugar: 'HKQuantityTypeIdentifierDietarySugar' as QuantityTypeIdentifier,
  dietaryFiber: 'HKQuantityTypeIdentifierDietaryFiber' as QuantityTypeIdentifier,
  dietaryFatSaturated: 'HKQuantityTypeIdentifierDietaryFatSaturated' as QuantityTypeIdentifier,
  dietaryCholesterol: 'HKQuantityTypeIdentifierDietaryCholesterol' as QuantityTypeIdentifier,
  dietarySodium: 'HKQuantityTypeIdentifierDietarySodium' as QuantityTypeIdentifier,
  dietaryPotassium: 'HKQuantityTypeIdentifierDietaryPotassium' as QuantityTypeIdentifier,
  dietaryCalcium: 'HKQuantityTypeIdentifierDietaryCalcium' as QuantityTypeIdentifier,
  dietaryIron: 'HKQuantityTypeIdentifierDietaryIron' as QuantityTypeIdentifier,
  dietaryVitaminA: 'HKQuantityTypeIdentifierDietaryVitaminA' as QuantityTypeIdentifier,
  dietaryVitaminC: 'HKQuantityTypeIdentifierDietaryVitaminC' as QuantityTypeIdentifier,
} as const;

const CTI = {
  sleepAnalysis: 'HKCategoryTypeIdentifierSleepAnalysis' as CategoryTypeIdentifier,
} as const;

// All HealthKit types we read
const READ_IDENTIFIERS: readonly ObjectTypeIdentifier[] = [
  QTI.stepCount,
  QTI.activeEnergyBurned,
  QTI.basalEnergyBurned,
  QTI.distanceWalkingRunning,
  QTI.flightsClimbed,
  QTI.heartRate,
  QTI.restingHeartRate,
  QTI.bloodPressureSystolic,
  QTI.bloodPressureDiastolic,
  QTI.bloodGlucose,
  QTI.oxygenSaturation,
  QTI.respiratoryRate,
  QTI.bodyTemperature,
  QTI.bodyMass,
  QTI.height,
  QTI.bodyFatPercentage,
  QTI.leanBodyMass,
  QTI.basalBodyTemperature,
  QTI.dietaryWater,
  QTI.dietaryEnergyConsumed,
  CTI.sleepAnalysis,
];

// Types we write
const WRITE_IDENTIFIERS: readonly SampleTypeIdentifierWriteable[] = [
  QTI.bodyMass as SampleTypeIdentifierWriteable,
  QTI.dietaryWater as SampleTypeIdentifierWriteable,
  QTI.dietaryEnergyConsumed as SampleTypeIdentifierWriteable,
  QTI.dietaryProtein as SampleTypeIdentifierWriteable,
  QTI.dietaryFatTotal as SampleTypeIdentifierWriteable,
  QTI.dietaryCarbohydrates as SampleTypeIdentifierWriteable,
];

/** Build the filter/limit options for queryQuantitySamples */
function quantityQueryOptions(startDate: Date, endDate: Date, unit?: string) {
  return {
    filter: { date: { startDate, endDate } },
    limit: 0,
    ...(unit ? { unit } : {}),
  };
}

/** Build the filter/limit options for queryCategorySamples */
function categoryQueryOptions(startDate: Date, endDate: Date) {
  return {
    filter: { date: { startDate, endDate } },
    limit: 0,
  };
}

/** Map WorkoutActivityType enum value to a human-readable string */
function workoutTypeName(activityType: WorkoutActivityType): string {
  const name = WorkoutActivityType[activityType];
  return name || 'Unknown';
}

// ── iOS HealthKit Service Implementation ────────────────────────────
export const iosHealthService: HealthService = {
  async isAvailable(): Promise<boolean> {
    try {
      return isHealthDataAvailable();
    } catch {
      return false;
    }
  },

  async requestPermissions(_permissions: HealthPermissions): Promise<HealthPermissionStatus> {
    try {
      await requestAuthorization({
        toRead: READ_IDENTIFIERS,
        toShare: WRITE_IDENTIFIERS,
      });
      return 'granted';
    } catch {
      return 'denied';
    }
  },

  // ── Activity ────────────────────────────────────────────────────
  async getSteps(startDate: Date, endDate: Date): Promise<StepsData[]> {
    const samples = await queryQuantitySamples(QTI.stepCount, quantityQueryOptions(startDate, endDate));
    const byDate = new Map<string, number>();
    for (const s of samples) {
      const d = dateStr(s.startDate);
      byDate.set(d, (byDate.get(d) || 0) + s.quantity);
    }
    return Array.from(byDate.entries()).map(([date, value]) => ({ date, value: Math.round(value) }));
  },

  async getCaloriesBurned(startDate: Date, endDate: Date): Promise<CaloriesBurnedData[]> {
    const [active, basal] = await Promise.all([
      queryQuantitySamples(QTI.activeEnergyBurned, quantityQueryOptions(startDate, endDate)),
      queryQuantitySamples(QTI.basalEnergyBurned, quantityQueryOptions(startDate, endDate)),
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
    const samples = await queryQuantitySamples(QTI.distanceWalkingRunning, quantityQueryOptions(startDate, endDate, 'm'));
    const byDate = new Map<string, number>();
    for (const s of samples) {
      const d = dateStr(s.startDate);
      byDate.set(d, (byDate.get(d) || 0) + s.quantity);
    }
    return Array.from(byDate.entries()).map(([date, meters]) => ({
      date,
      distanceMeters: Math.round(meters),
    }));
  },

  async getExerciseSessions(startDate: Date, endDate: Date): Promise<ExerciseSession[]> {
    const workouts = await queryWorkoutSamples({
      filter: { date: { startDate, endDate } },
      limit: 0,
    });

    return workouts.map((w) => ({
      startDate: isoStr(w.startDate),
      endDate: isoStr(w.endDate),
      type: workoutTypeName(w.workoutActivityType),
      durationMinutes: Math.round(w.duration.quantity / 60),
      caloriesBurned: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned.quantity) : undefined,
      distanceMeters: w.totalDistance ? Math.round(w.totalDistance.quantity * 1000) : undefined,
    }));
  },

  async getFloorsClimbed(startDate: Date, endDate: Date): Promise<FloorsClimbedData[]> {
    const samples = await queryQuantitySamples(QTI.flightsClimbed, quantityQueryOptions(startDate, endDate));
    return samples.map((s) => ({ date: dateStr(s.startDate), floors: s.quantity }));
  },

  // ── Heart & Vitals ──────────────────────────────────────────────
  async getHeartRate(startDate: Date, endDate: Date): Promise<HeartRateData[]> {
    const samples = await queryQuantitySamples(QTI.heartRate, quantityQueryOptions(startDate, endDate));
    return samples.map((s) => ({ date: isoStr(s.startDate), bpm: Math.round(s.quantity) }));
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
    const samples = await queryQuantitySamples(QTI.restingHeartRate, quantityQueryOptions(startDate, endDate));
    return samples.map((s) => ({ date: isoStr(s.startDate), bpm: Math.round(s.quantity) }));
  },

  async getBloodPressure(startDate: Date, endDate: Date): Promise<BloodPressureData[]> {
    const [systolic, diastolic] = await Promise.all([
      queryQuantitySamples(QTI.bloodPressureSystolic, quantityQueryOptions(startDate, endDate)),
      queryQuantitySamples(QTI.bloodPressureDiastolic, quantityQueryOptions(startDate, endDate)),
    ]);

    return systolic.map((s, i) => ({
      date: isoStr(s.startDate),
      systolic: Math.round(s.quantity),
      diastolic: diastolic[i] ? Math.round(diastolic[i].quantity) : 0,
    }));
  },

  async getBloodGlucose(startDate: Date, endDate: Date): Promise<BloodGlucoseData[]> {
    const samples = await queryQuantitySamples(QTI.bloodGlucose, quantityQueryOptions(startDate, endDate));
    return samples.map((s) => ({ date: isoStr(s.startDate), mgPerDL: s.quantity }));
  },

  async getOxygenSaturation(startDate: Date, endDate: Date): Promise<OxygenSaturationData[]> {
    const samples = await queryQuantitySamples(QTI.oxygenSaturation, quantityQueryOptions(startDate, endDate));
    return samples.map((s) => ({
      date: isoStr(s.startDate),
      percentage: s.quantity * 100,
    }));
  },

  async getRespiratoryRate(startDate: Date, endDate: Date): Promise<RespiratoryRateData[]> {
    const samples = await queryQuantitySamples(QTI.respiratoryRate, quantityQueryOptions(startDate, endDate));
    return samples.map((s) => ({ date: isoStr(s.startDate), breathsPerMinute: s.quantity }));
  },

  async getBodyTemperature(startDate: Date, endDate: Date): Promise<BodyTemperatureData[]> {
    const samples = await queryQuantitySamples(QTI.bodyTemperature, quantityQueryOptions(startDate, endDate));
    return samples.map((s) => ({ date: isoStr(s.startDate), celsius: s.quantity }));
  },

  // ── Body Measurements ───────────────────────────────────────────
  async getWeight(startDate: Date, endDate: Date): Promise<WeightData[]> {
    const samples = await queryQuantitySamples(QTI.bodyMass, quantityQueryOptions(startDate, endDate, 'kg'));
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      kilograms: Math.round(s.quantity * 10) / 10,
    }));
  },

  async getHeight(startDate: Date, endDate: Date): Promise<HeightData[]> {
    const samples = await queryQuantitySamples(QTI.height, quantityQueryOptions(startDate, endDate, 'cm'));
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      centimeters: Math.round(s.quantity * 10) / 10,
    }));
  },

  async getBodyFat(startDate: Date, endDate: Date): Promise<BodyFatData[]> {
    const samples = await queryQuantitySamples(QTI.bodyFatPercentage, quantityQueryOptions(startDate, endDate));
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      percentage: Math.round(s.quantity * 1000) / 10,
    }));
  },

  async getLeanBodyMass(startDate: Date, endDate: Date): Promise<LeanBodyMassData[]> {
    const samples = await queryQuantitySamples(QTI.leanBodyMass, quantityQueryOptions(startDate, endDate, 'kg'));
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      kilograms: Math.round(s.quantity * 10) / 10,
    }));
  },

  async getBodyWaterMass(_startDate: Date, _endDate: Date): Promise<BodyWaterMassData[]> {
    return [];
  },

  async getBasalMetabolicRate(startDate: Date, endDate: Date): Promise<BasalMetabolicRateData[]> {
    const samples = await queryQuantitySamples(QTI.basalEnergyBurned, quantityQueryOptions(startDate, endDate, 'kcal'));
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
    const samples = await queryQuantitySamples(QTI.waistCircumference, quantityQueryOptions(startDate, endDate, 'cm'));
    return samples.map((s) => ({
      date: dateStr(s.startDate),
      centimeters: Math.round(s.quantity * 10) / 10,
    }));
  },

  // ── Nutrition ───────────────────────────────────────────────────
  async getNutrition(startDate: Date, endDate: Date): Promise<NutritionEntry[]> {
    const samples = await queryQuantitySamples(QTI.dietaryEnergyConsumed, quantityQueryOptions(startDate, endDate, 'kcal'));
    return samples.map((s) => ({
      date: isoStr(s.startDate),
      calories: Math.round(s.quantity),
    }));
  },

  async writeNutrition(entry: NutritionEntry): Promise<void> {
    const date = new Date(entry.date);
    const nutritionSamples: Array<{ identifier: QuantityTypeIdentifier; unit: string; value: number }> = [
      { identifier: QTI.dietaryEnergyConsumed, unit: 'kcal', value: entry.calories },
    ];

    if (entry.protein) nutritionSamples.push({ identifier: QTI.dietaryProtein, unit: 'g', value: entry.protein });
    if (entry.totalFat) nutritionSamples.push({ identifier: QTI.dietaryFatTotal, unit: 'g', value: entry.totalFat });
    if (entry.carbohydrates) nutritionSamples.push({ identifier: QTI.dietaryCarbohydrates, unit: 'g', value: entry.carbohydrates });
    if (entry.sugar) nutritionSamples.push({ identifier: QTI.dietarySugar, unit: 'g', value: entry.sugar });
    if (entry.fiber) nutritionSamples.push({ identifier: QTI.dietaryFiber, unit: 'g', value: entry.fiber });
    if (entry.saturatedFat) nutritionSamples.push({ identifier: QTI.dietaryFatSaturated, unit: 'g', value: entry.saturatedFat });
    if (entry.cholesterol) nutritionSamples.push({ identifier: QTI.dietaryCholesterol, unit: 'mg', value: entry.cholesterol });
    if (entry.sodium) nutritionSamples.push({ identifier: QTI.dietarySodium, unit: 'mg', value: entry.sodium });
    if (entry.potassium) nutritionSamples.push({ identifier: QTI.dietaryPotassium, unit: 'mg', value: entry.potassium });
    if (entry.calcium) nutritionSamples.push({ identifier: QTI.dietaryCalcium, unit: 'mg', value: entry.calcium });
    if (entry.iron) nutritionSamples.push({ identifier: QTI.dietaryIron, unit: 'mg', value: entry.iron });
    if (entry.vitaminA) nutritionSamples.push({ identifier: QTI.dietaryVitaminA, unit: 'mcg', value: entry.vitaminA });
    if (entry.vitaminC) nutritionSamples.push({ identifier: QTI.dietaryVitaminC, unit: 'mg', value: entry.vitaminC });

    await Promise.all(
      nutritionSamples.map((n) =>
        saveQuantitySample(n.identifier as any, n.unit, n.value, date, date)
      )
    );
  },

  async getHydration(startDate: Date, endDate: Date): Promise<HydrationData[]> {
    const samples = await queryQuantitySamples(QTI.dietaryWater, quantityQueryOptions(startDate, endDate, 'mL'));

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
    await saveQuantitySample(QTI.dietaryWater as any, 'mL', entry.liters * 1000, date, date);
  },

  async writeWeight(entry: WeightData): Promise<void> {
    const date = new Date(entry.date);
    await saveQuantitySample(QTI.bodyMass as any, 'kg', entry.kilograms, date, date);
  },

  // ── Sleep ───────────────────────────────────────────────────────
  async getSleep(startDate: Date, endDate: Date): Promise<SleepSession[]> {
    const samples = await queryCategorySamples(CTI.sleepAnalysis, categoryQueryOptions(startDate, endDate));

    const sessions: SleepSession[] = [];
    let currentSession: SleepSession | null = null;

    for (const s of samples) {
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

      // CategoryValueSleepAnalysis: inBed=0, asleepUnspecified=1, awake=2, asleepCore=3, asleepDeep=4, asleepREM=5
      const stage = s.value === 2 ? 'awake' as const :
                    s.value === 1 ? 'light' as const :
                    s.value === 3 ? 'light' as const :
                    s.value === 4 ? 'deep' as const :
                    s.value === 5 ? 'rem' as const :
                    'unknown' as const;

      if (
        !currentSession ||
        start.getTime() - new Date(currentSession.endDate).getTime() > 3600000
      ) {
        if (currentSession) sessions.push(currentSession);
        currentSession = {
          startDate: isoStr(s.startDate),
          endDate: isoStr(s.endDate),
          totalMinutes: durationMinutes,
          stages: [{ stage, startDate: isoStr(s.startDate), endDate: isoStr(s.endDate), durationMinutes }],
        };
      } else {
        currentSession.endDate = isoStr(s.endDate);
        currentSession.totalMinutes += durationMinutes;
        currentSession.stages?.push({
          stage,
          startDate: isoStr(s.startDate),
          endDate: isoStr(s.endDate),
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
