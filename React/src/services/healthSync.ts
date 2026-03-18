import { getClientId, getLastSyncTimestamp, setLastSyncTimestamp } from './secureStorage';
import { submitWorkouts, submitSleep, submitSteps, submitProfile, AuthError } from './apiClient';
import { getRecentWorkouts, getWeekSummaries } from './health';
import type { ExerciseSession, DailyHealthSummary } from '../types/health';

export interface SyncResult {
  synced: boolean;
  workouts: number;
  sleepDays: number;
  stepDays: number;
  bodyMetrics: number;
  errors: string[];
}

/**
 * Sync local HealthKit/Health Connect data to the CoachFit platform.
 *
 * Reads recent health data from the device and pushes to the
 * platform's ingest endpoints. The backend deduplicates by
 * unique constraints, so re-syncing the same data is safe.
 */
export async function syncHealthData(): Promise<SyncResult> {
  const clientId = await getClientId();
  if (!clientId) {
    return { synced: false, workouts: 0, sleepDays: 0, stepDays: 0, bodyMetrics: 0, errors: ['Not paired'] };
  }

  const result: SyncResult = {
    synced: true,
    workouts: 0,
    sleepDays: 0,
    stepDays: 0,
    bodyMetrics: 0,
    errors: [],
  };

  // Determine sync window (7 days default, or since last sync)
  const lastSync = await getLastSyncTimestamp();
  const syncDays = lastSync
    ? Math.min(Math.ceil((Date.now() - new Date(lastSync).getTime()) / 86_400_000) + 1, 14)
    : 7;

  const outcomes = await Promise.allSettled([
    syncWorkoutsToPlat(clientId, syncDays, result),
    syncStepsToPlat(clientId, syncDays, result),
    syncSleepToPlat(clientId, syncDays, result),
    syncBodyMetricsToPlat(clientId, syncDays, result),
  ]);

  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      if (outcome.reason instanceof AuthError) throw outcome.reason;
      result.errors.push(outcome.reason?.message ?? 'Unknown error');
    }
  }

  await setLastSyncTimestamp(new Date().toISOString());
  return result;
}

// ─── Workouts ────────────────────────────────────────────────────────────────

async function syncWorkoutsToPlat(
  clientId: string,
  days: number,
  result: SyncResult
): Promise<void> {
  const workouts = await getRecentWorkouts(days);
  if (workouts.length === 0) return;

  // Batch in chunks of 100 (API limit)
  for (let i = 0; i < workouts.length; i += 100) {
    const chunk = workouts.slice(i, i + 100);
    await submitWorkouts({
      client_id: clientId,
      workouts: chunk.map(mapWorkout),
    });
    result.workouts += chunk.length;
  }
}

function mapWorkout(w: ExerciseSession) {
  const startMs = new Date(w.startDate).getTime();
  const endMs = new Date(w.endDate).getTime();
  const durationSeconds = Math.round(w.durationMinutes * 60);

  return {
    workout_type: w.type,
    start_time: w.startDate,
    end_time: w.endDate,
    duration_seconds: durationSeconds > 0 ? durationSeconds : Math.round((endMs - startMs) / 1000),
    calories_active: w.caloriesBurned ?? undefined,
    distance_meters: w.distanceMeters ?? undefined,
  };
}

// ─── Steps ───────────────────────────────────────────────────────────────────

async function syncStepsToPlat(
  clientId: string,
  days: number,
  result: SyncResult
): Promise<void> {
  const summaries = await getWeekSummariesForDays(days);
  const stepsData = summaries
    .filter((s) => s.steps != null && s.steps > 0)
    .map((s) => ({
      date: toDateString(s.date),
      total_steps: s.steps!,
    }));

  if (stepsData.length === 0) return;

  await submitSteps({
    client_id: clientId,
    steps: stepsData,
  });
  result.stepDays = stepsData.length;
}

// ─── Sleep ───────────────────────────────────────────────────────────────────

async function syncSleepToPlat(
  clientId: string,
  days: number,
  result: SyncResult
): Promise<void> {
  const summaries = await getWeekSummariesForDays(days);
  const sleepData = summaries
    .filter((s) => s.sleepMinutes != null && s.sleepMinutes > 0)
    .map((s) => ({
      date: toDateString(s.date),
      total_sleep_minutes: s.sleepMinutes!,
    }));

  if (sleepData.length === 0) return;

  await submitSleep({
    client_id: clientId,
    sleep_records: sleepData,
  });
  result.sleepDays = sleepData.length;
}

// ─── Body Metrics ────────────────────────────────────────────────────────────

async function syncBodyMetricsToPlat(
  clientId: string,
  days: number,
  result: SyncResult
): Promise<void> {
  const summaries = await getWeekSummariesForDays(days);
  const metrics: {
    metric: 'weight' | 'body_fat_percentage';
    value: number;
    unit: 'kg' | 'percent';
    measured_at: string;
  }[] = [];

  for (const s of summaries) {
    if (s.weight != null && s.weight > 0) {
      metrics.push({
        metric: 'weight',
        value: s.weight,
        unit: 'kg',
        measured_at: new Date(s.date + 'T12:00:00').toISOString(),
      });
    }
    if (s.bodyFatPercentage != null && s.bodyFatPercentage > 0) {
      metrics.push({
        metric: 'body_fat_percentage',
        value: s.bodyFatPercentage,
        unit: 'percent',
        measured_at: new Date(s.date + 'T12:00:00').toISOString(),
      });
    }
  }

  if (metrics.length === 0) return;

  await submitProfile({
    client_id: clientId,
    metrics,
  });
  result.bodyMetrics = metrics.length;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cache for week summaries within a single sync call. */
let _summariesCache: { days: number; data: DailyHealthSummary[] } | null = null;

async function getWeekSummariesForDays(days: number): Promise<DailyHealthSummary[]> {
  if (_summariesCache && _summariesCache.days === days) return _summariesCache.data;
  // getWeekSummaries always returns 7 days — sufficient for most sync windows
  const data = await getWeekSummaries();
  _summariesCache = { days, data };
  return data;
}

function toDateString(dateStr: string): string {
  // Ensure YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return new Date(dateStr).toISOString().split('T')[0];
}
