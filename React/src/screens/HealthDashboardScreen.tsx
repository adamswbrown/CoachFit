import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  isHealthAvailable,
  requestAllHealthPermissions,
  getTodaySummary,
  getWeekSummaries,
  getRecentWorkouts,
} from '../services/health';
import { syncHealthData, type SyncResult } from '../services/healthSync';
import { useAuth } from '../contexts/AuthContext';
import { useAppForeground } from '../hooks/useAppForeground';
import type { DailyHealthSummary, HealthPermissionStatus, ExerciseSession } from '../services/health';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

type ConnectionState = 'checking' | 'unavailable' | 'needs_permission' | 'connected' | 'error';

export function HealthDashboardScreen() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [todaySummary, setTodaySummary] = useState<DailyHealthSummary | null>(null);
  const [weekSummaries, setWeekSummaries] = useState<DailyHealthSummary[]>([]);
  const [workouts, setWorkouts] = useState<ExerciseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'failed'>('idle');
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const { auth } = useAuth();

  useEffect(() => {
    checkHealth();
  }, []);

  // Sync to platform when app comes to foreground
  useAppForeground(useCallback(() => {
    if (connectionState === 'connected' && auth.status === 'paired') {
      triggerPlatformSync();
    }
  }, [connectionState, auth.status]));

  async function checkHealth() {
    try {
      const available = await isHealthAvailable();
      console.log('[HealthDashboard] isAvailable:', available);
      if (!available) {
        setConnectionState('unavailable');
        setLoading(false);
        return;
      }
      // Try to initialize — if permissions were already granted, this succeeds silently
      const status = await requestAllHealthPermissions();
      console.log('[HealthDashboard] auto-init status:', status);
      if (status === 'granted') {
        setConnectionState('connected');
        await loadData();
      } else {
        setConnectionState('needs_permission');
      }
      setLoading(false);
    } catch (e) {
      console.error('[HealthDashboard] checkHealth error:', e);
      setConnectionState('needs_permission');
      setLoading(false);
    }
  }

  async function connect() {
    setLoading(true);
    try {
      const status: HealthPermissionStatus = await requestAllHealthPermissions();
      console.log('[HealthDashboard] permission status:', status);
      if (status === 'granted') {
        setConnectionState('connected');
        await loadData();
      } else {
        Alert.alert('Permission Denied', 'Health data access was not granted. Please enable in Settings > Health > CoachFit.');
        setConnectionState('needs_permission');
      }
    } catch (e) {
      console.error('[HealthDashboard] connect error:', e);
      Alert.alert('Error', `Failed to connect to health services: ${e instanceof Error ? e.message : String(e)}`);
      setConnectionState('error');
    }
    setLoading(false);
  }

  async function loadData() {
    try {
      const [today, week, recentWorkouts] = await Promise.all([
        getTodaySummary(),
        getWeekSummaries(),
        getRecentWorkouts(7),
      ]);
      setTodaySummary(today);
      setWeekSummaries(week);
      setWorkouts(recentWorkouts);
    } catch {
      // Partial data is fine
    }

    // Fire-and-forget platform sync if paired
    if (auth.status === 'paired') {
      triggerPlatformSync();
    }
  }

  async function triggerPlatformSync() {
    setSyncStatus('syncing');
    try {
      const result = await syncHealthData();
      setLastSyncResult(result);
      setSyncStatus(result.synced ? 'synced' : 'failed');
    } catch {
      setSyncStatus('failed');
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Connecting to Health...</Text>
      </View>
    );
  }

  if (connectionState === 'unavailable') {
    return (
      <View style={styles.centered}>
        <Text style={styles.unavailableTitle}>Health Not Available</Text>
        <Text style={styles.unavailableText}>
          Apple Health (iOS) or Health Connect (Android) is not available on this device.
        </Text>
      </View>
    );
  }

  if (connectionState === 'needs_permission' || connectionState === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.connectTitle}>Connect Health Data</Text>
        <Text style={styles.connectDesc}>
          Sync your activity, nutrition, body metrics, vitals, and sleep data from{' '}
          {'\n'}Apple Health or Google Health Connect.
        </Text>

        <View style={styles.permissionList}>
          <PermissionItem icon="+" label="Activity" desc="Steps, calories burned, distance, exercise, floors" />
          <PermissionItem icon="+" label="Heart & Vitals" desc="Heart rate, blood pressure, SpO2, respiratory rate, temperature" />
          <PermissionItem icon="+" label="Body" desc="Weight, height, body fat, BMR, lean mass, waist" />
          <PermissionItem icon="+" label="Nutrition" desc="Read and write food entries from scanned products" />
          <PermissionItem icon="+" label="Hydration" desc="Water intake tracking" />
          <PermissionItem icon="+" label="Sleep" desc="Sleep sessions and stages" />
        </View>

        <TouchableOpacity style={styles.connectButton} onPress={connect}>
          <Text style={styles.connectButtonText}>Connect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Connected state - show dashboard
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Today's Summary */}
      <Text style={styles.sectionTitle}>Today</Text>
      {todaySummary ? (
        <View style={styles.summaryGrid}>
          <SummaryTile label="Steps" value={todaySummary.steps} />
          <SummaryTile label="Active Cal" value={todaySummary.activeCalories} unit="kcal" />
          <SummaryTile label="Total Burned" value={todaySummary.totalCaloriesBurned} unit="kcal" />
          <SummaryTile
            label="Distance"
            value={todaySummary.distanceMeters ? Math.round(todaySummary.distanceMeters / 10) / 100 : undefined}
            unit="km"
          />
          <SummaryTile label="Exercise" value={todaySummary.exerciseMinutes} unit="min" />
          <SummaryTile label="Weight" value={todaySummary.weight} unit="kg" />
          <SummaryTile label="Body Fat" value={todaySummary.bodyFatPercentage} unit="%" />
          <SummaryTile label="BMR" value={todaySummary.basalMetabolicRate} unit="kcal" />
          <SummaryTile
            label="Sleep"
            value={todaySummary.sleepMinutes ? Math.round(todaySummary.sleepMinutes / 6) / 10 : undefined}
            unit="hrs"
          />
          <SummaryTile label="Water" value={todaySummary.waterLiters} unit="L" />
          {todaySummary.totalCaloriesBurned && todaySummary.nutritionCaloriesConsumed ? (
            <SummaryTile
              label="Net Cal"
              value={todaySummary.nutritionCaloriesConsumed - todaySummary.totalCaloriesBurned}
              unit="kcal"
              highlight
            />
          ) : null}
        </View>
      ) : (
        <Text style={styles.noData}>No data available for today</Text>
      )}

      {/* Recent Workouts */}
      {workouts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {workouts.map((workout, index) => (
            <View key={`${workout.startDate}-${index}`} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutType}>{workout.type}</Text>
                <Text style={styles.workoutDuration}>{workout.durationMinutes} min</Text>
              </View>
              <View style={styles.workoutDetails}>
                {workout.caloriesBurned !== undefined && workout.caloriesBurned > 0 && (
                  <Text style={styles.workoutStat}>{workout.caloriesBurned} kcal</Text>
                )}
                {workout.distanceMeters !== undefined && workout.distanceMeters > 0 && (
                  <Text style={styles.workoutStat}>
                    {(workout.distanceMeters / 1000).toFixed(2)} km
                  </Text>
                )}
                <Text style={styles.workoutDate}>
                  {new Date(workout.startDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Week History */}
      {weekSummaries.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>This Week</Text>
          {weekSummaries.map((day) => (
            <View key={day.date} style={styles.weekRow}>
              <Text style={styles.weekDate}>
                {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <View style={styles.weekStats}>
                {day.steps !== undefined && (
                  <Text style={styles.weekStat}>{day.steps.toLocaleString()} steps</Text>
                )}
                {day.totalCaloriesBurned !== undefined && (
                  <Text style={styles.weekStat}>{day.totalCaloriesBurned} kcal burned</Text>
                )}
                {day.sleepMinutes !== undefined && (
                  <Text style={styles.weekStat}>
                    {Math.round(day.sleepMinutes / 6) / 10}h sleep
                  </Text>
                )}
              </View>
            </View>
          ))}
        </>
      )}

      {/* Platform Sync Status */}
      {auth.status === 'paired' && (
        <View style={styles.syncSection}>
          <Text style={styles.sectionTitle}>Platform Sync</Text>
          <View style={styles.syncCard}>
            <View style={styles.syncRow}>
              <View style={[
                styles.syncDot,
                syncStatus === 'syncing' && styles.syncDotSyncing,
                syncStatus === 'synced' && styles.syncDotSynced,
                syncStatus === 'failed' && styles.syncDotFailed,
              ]} />
              <Text style={styles.syncLabel}>
                {syncStatus === 'idle' && 'Not synced yet'}
                {syncStatus === 'syncing' && 'Syncing to CoachFit...'}
                {syncStatus === 'synced' && 'Synced to CoachFit'}
                {syncStatus === 'failed' && 'Sync failed'}
              </Text>
            </View>
            {lastSyncResult && syncStatus === 'synced' && (
              <Text style={styles.syncDetails}>
                {[
                  lastSyncResult.workouts > 0 && `${lastSyncResult.workouts} workouts`,
                  lastSyncResult.stepDays > 0 && `${lastSyncResult.stepDays} days of steps`,
                  lastSyncResult.sleepDays > 0 && `${lastSyncResult.sleepDays} days of sleep`,
                  lastSyncResult.bodyMetrics > 0 && `${lastSyncResult.bodyMetrics} body metrics`,
                ].filter(Boolean).join(', ') || 'No new data to sync'}
              </Text>
            )}
            <TouchableOpacity
              style={styles.syncNowButton}
              onPress={triggerPlatformSync}
              disabled={syncStatus === 'syncing'}
            >
              <Text style={styles.syncNowText}>
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
        <Text style={styles.refreshText}>Refresh</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PermissionItem({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <View style={styles.permItem}>
      <Text style={styles.permIcon}>{icon}</Text>
      <View style={styles.permInfo}>
        <Text style={styles.permLabel}>{label}</Text>
        <Text style={styles.permDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value?: number | null;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.tile, highlight && styles.tileHighlight]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, highlight && styles.tileValueHighlight]}>
        {value !== undefined && value !== null
          ? typeof value === 'number'
            ? value.toLocaleString()
            : value
          : '—'}
      </Text>
      {unit && value !== undefined && value !== null && (
        <Text style={styles.tileUnit}>{unit}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: { fontSize: fontSize.lg, color: colors.textSecondary, marginTop: spacing.md },

  // Unavailable
  unavailableTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  unavailableText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Connect
  connectTitle: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  connectDesc: {
    fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.lg,
  },
  permissionList: { width: '100%', marginBottom: spacing.lg },
  permItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md, paddingHorizontal: spacing.md },
  permIcon: { fontSize: fontSize.xl, color: colors.primary, fontWeight: '700', marginRight: spacing.sm, marginTop: 2 },
  permInfo: { flex: 1 },
  permLabel: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  permDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  connectButton: {
    backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl * 2,
    borderRadius: borderRadius.lg,
  },
  connectButtonText: { color: colors.textLight, fontSize: fontSize.xl, fontWeight: '700' },

  // Dashboard
  sectionTitle: {
    fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
  },
  tile: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md,
    width: '48%', marginBottom: spacing.sm, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  tileHighlight: { backgroundColor: colors.primary },
  tileLabel: { fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tileValue: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text, marginTop: 2 },
  tileValueHighlight: { color: colors.textLight },
  tileUnit: { fontSize: fontSize.sm, color: colors.textSecondary },
  noData: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.lg },

  // Workouts
  workoutCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  workoutHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  workoutType: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  workoutDuration: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  workoutDetails: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  workoutStat: { fontSize: fontSize.md, color: colors.accent, fontWeight: '600' },
  workoutDate: { fontSize: fontSize.sm, color: colors.textSecondary },

  // Week
  weekRow: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md,
    marginBottom: spacing.xs, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  weekDate: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, minWidth: 100 },
  weekStats: { flex: 1, alignItems: 'flex-end' },
  weekStat: { fontSize: fontSize.sm, color: colors.textSecondary },

  // Platform Sync
  syncSection: { marginTop: spacing.md },
  syncCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  syncRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  syncDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginRight: spacing.sm,
  },
  syncDotSyncing: { backgroundColor: colors.accent },
  syncDotSynced: { backgroundColor: colors.primary },
  syncDotFailed: { backgroundColor: colors.error },
  syncLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  syncDetails: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  syncNowButton: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  syncNowText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },

  refreshButton: {
    alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.md,
  },
  refreshText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '600' },
});
