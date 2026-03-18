import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { submitEntry } from '../services/apiClient';
import { isHealthAvailable, getTodaySummary } from '../services/health';
import { getDayCalories } from '../services/foodLog';
import { RatingPicker } from '../components/RatingPicker';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import type { DailyHealthSummary } from '../types/health';
import type { IngestEntryPayload } from '../types/api';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function CheckInScreen() {
  const { auth } = useAuth();

  // Form fields
  const [weight, setWeight] = useState('');
  const [steps, setSteps] = useState('');
  const [calories, setCalories] = useState('');
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [perceivedStress, setPerceivedStress] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // HealthKit state
  const [healthData, setHealthData] = useState<DailyHealthSummary | null>(null);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [caloriesFromLog, setCaloriesFromLog] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<IngestEntryPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for field focus
  const stepsRef = useRef<TextInput>(null);
  const caloriesRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  // Fetch HealthKit data and food log totals on mount
  useEffect(() => {
    (async () => {
      // Pre-populate calories from food log
      try {
        const todayCals = await getDayCalories(formatDate(new Date()));
        if (todayCals > 0) {
          setCalories(String(todayCals));
          setCaloriesFromLog(true);
        }
      } catch {
        // No food log data — user will enter manually
      }

      // Fetch HealthKit data
      try {
        const available = await isHealthAvailable();
        setHealthAvailable(available);
        if (available) {
          const summary = await getTodaySummary();
          setHealthData(summary);
          if (summary.steps != null && summary.steps > 0) {
            setSteps(String(summary.steps));
          }
          if (summary.weight != null && summary.weight > 0) {
            setWeight(String(Math.round(summary.weight * 2.20462 * 10) / 10));
          }
        }
      } catch {
        // HealthKit unavailable — user will enter manually
      }
    })();
  }, []);

  const hasAnyField =
    weight.trim() !== '' ||
    steps.trim() !== '' ||
    calories.trim() !== '' ||
    sleepQuality != null ||
    perceivedStress != null ||
    notes.trim() !== '';

  async function handleSubmit() {
    if (auth.status !== 'paired' || !hasAnyField) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: IngestEntryPayload = {
      client_id: auth.clientId,
      date: formatDate(new Date()),
    };

    const w = parseFloat(weight);
    if (!isNaN(w) && w > 0) payload.weightLbs = w;

    const s = parseInt(steps, 10);
    if (!isNaN(s) && s > 0) payload.steps = s;

    const c = parseInt(calories, 10);
    if (!isNaN(c) && c > 0) payload.calories = c;

    if (sleepQuality != null) payload.sleepQuality = sleepQuality;
    if (perceivedStress != null) payload.perceivedStress = perceivedStress;
    if (notes.trim()) payload.notes = notes.trim();

    try {
      await submitEntry(payload);
      setSubmittedData(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit() {
    setSubmittedData(null);
  }

  // ─── Success View ──────────────────────────────────────────────────
  if (submittedData) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.successBanner}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>Check-in submitted</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Today's Check-In</Text>

          {submittedData.weightLbs != null && (
            <SummaryRow
              label="Weight"
              value={`${submittedData.weightLbs} lbs`}
              source={healthData?.weight != null ? 'Apple Health' : undefined}
            />
          )}
          {submittedData.steps != null && (
            <SummaryRow
              label="Steps"
              value={submittedData.steps.toLocaleString()}
              source={healthData?.steps != null ? 'Apple Health' : undefined}
            />
          )}
          {submittedData.calories != null && (
            <SummaryRow label="Calories consumed today" value={`${submittedData.calories} kcal`} />
          )}
          {submittedData.sleepQuality != null && (
            <SummaryRow label="Sleep Quality" value={`${submittedData.sleepQuality}/10`} />
          )}
          {submittedData.perceivedStress != null && (
            <SummaryRow label="Perceived Stress" value={`${submittedData.perceivedStress}/10`} />
          )}
          {submittedData.notes != null && (
            <SummaryRow label="Notes" value={submittedData.notes} />
          )}
        </View>

        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Text style={styles.editButtonText}>Edit Entry</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ─── Form View ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Daily Check-In</Text>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>

        {/* Weight */}
        {healthData?.weight == null && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Weight (lbs)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="e.g. 175.5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => stepsRef.current?.focus()}
            />
          </View>
        )}
        {healthData?.weight != null && (
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Weight (lbs)</Text>
              <HealthBadge />
            </View>
            <Text style={styles.healthValue}>{weight}</Text>
          </View>
        )}

        {/* Steps */}
        {healthData?.steps == null && (
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Steps</Text>
            <TextInput
              ref={stepsRef}
              style={styles.input}
              value={steps}
              onChangeText={setSteps}
              placeholder="e.g. 8000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              returnKeyType="next"
              onSubmitEditing={() => caloriesRef.current?.focus()}
            />
          </View>
        )}
        {healthData?.steps != null && (
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Steps</Text>
              <HealthBadge />
            </View>
            <Text style={styles.healthValue}>{Number(steps).toLocaleString()}</Text>
          </View>
        )}

        {/* Calories */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Calories consumed today</Text>
            {caloriesFromLog && <FoodLogBadge />}
          </View>
          <TextInput
            ref={caloriesRef}
            style={styles.input}
            value={calories}
            onChangeText={setCalories}
            placeholder="e.g. 2200"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            returnKeyType="done"
          />
        </View>

        {/* Sleep Quality */}
        <RatingPicker
          label="Sleep Quality"
          value={sleepQuality}
          onChange={setSleepQuality}
        />

        {/* Perceived Stress */}
        <RatingPicker
          label="Perceived Stress"
          value={perceivedStress}
          onChange={setPerceivedStress}
        />

        {/* Notes */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            ref={notesRef}
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="How are you feeling today?"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Error */}
        {errorMessage && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, (!hasAnyField || isSubmitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!hasAnyField || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.textLight} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Check-In</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function HealthBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>Apple Health</Text>
    </View>
  );
}

function FoodLogBadge() {
  return (
    <View style={styles.foodLogBadge}>
      <Text style={styles.foodLogBadgeText}>From food log</Text>
    </View>
  );
}

function SummaryRow({ label, value, source }: { label: string; value: string; source?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryValueRow}>
        <Text style={styles.summaryValue}>{value}</Text>
        {source && (
          <View style={styles.badgeSmall}>
            <Text style={styles.badgeSmallText}>{source}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.text,
  },
  dateText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  // Fields
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  notesInput: {
    minHeight: 100,
    paddingTop: spacing.sm + 2,
  },
  healthValue: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: spacing.sm,
  },

  // Food log badge
  foodLogBadge: {
    backgroundColor: '#E8EAF6',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  foodLogBadgeText: {
    fontSize: fontSize.sm,
    color: '#5C6BC0',
    fontWeight: '600',
  },

  // Health badge
  badge: {
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  badgeText: {
    fontSize: fontSize.sm,
    color: '#E53935',
    fontWeight: '600',
  },

  // Submit
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },

  // Error
  errorText: {
    color: colors.error,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Success view
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  successIcon: {
    fontSize: fontSize.xl,
    color: colors.primary,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  successText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  summaryTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  badgeSmall: {
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    marginLeft: spacing.sm,
  },
  badgeSmallText: {
    fontSize: 10,
    color: '#E53935',
    fontWeight: '600',
  },
  editButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  editButtonText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
