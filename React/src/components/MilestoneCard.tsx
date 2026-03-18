import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MilestoneData } from '../services/streak';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

interface Props {
  milestone: MilestoneData;
}

export function MilestoneCard({ milestone }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>🏆</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{milestone.title}</Text>
          {milestone.achievedAt && (
            <Text style={styles.date}>
              {new Date(milestone.achievedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          )}
        </View>
      </View>
      {milestone.description && (
        <Text style={styles.description}>{milestone.description}</Text>
      )}
      {milestone.coachMessage && (
        <View style={styles.messageBox}>
          <Text style={styles.messageLabel}>
            {milestone.coachName ? `${milestone.coachName} says:` : 'Coach says:'}
          </Text>
          <Text style={styles.messageText}>{milestone.coachMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  date: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  messageBox: {
    backgroundColor: '#F3E5F5',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  messageLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#7B1FA2',
    marginBottom: 2,
  },
  messageText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
});
