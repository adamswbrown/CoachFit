import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

interface Props {
  currentStreak: number;
  longestStreak: number;
}

const MILESTONE_THRESHOLDS = [7, 14, 30, 60, 90];

export function StreakBanner({ currentStreak, longestStreak }: Props) {
  if (currentStreak === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.promptText}>Check in today to start your streak</Text>
      </View>
    );
  }

  const isMilestone = MILESTONE_THRESHOLDS.includes(currentStreak);

  return (
    <View style={[styles.container, isMilestone && styles.milestoneContainer]}>
      <View style={styles.streakRow}>
        <Text style={styles.flame}>{isMilestone ? '🎉' : '🔥'}</Text>
        <Text style={styles.streakNumber}>{currentStreak}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
      </View>
      {longestStreak > currentStreak && (
        <Text style={styles.longestText}>Best: {longestStreak} days</Text>
      )}
      {isMilestone && (
        <Text style={styles.milestoneText}>
          {currentStreak}-day milestone reached!
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  milestoneContainer: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flame: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  streakNumber: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.accent,
  },
  streakLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  longestText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  milestoneText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.accent,
    marginTop: spacing.xs,
  },
  promptText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});
