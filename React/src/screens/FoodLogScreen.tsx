import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDayLog, getWeekTotals, deleteLogEntry } from '../services/foodLog';
import type { FoodLogEntry, DayTotal } from '../services/foodLog';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';

type ViewMode = 'today' | 'week';

interface Section {
  title: string;
  subtitle: string;
  data: FoodLogEntry[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function FoodLogScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [todayEntries, setTodayEntries] = useState<FoodLogEntry[]>([]);
  const [weekTotals, setWeekTotals] = useState<DayTotal[]>([]);
  const [weekEntries, setWeekEntries] = useState<Map<string, FoodLogEntry[]>>(new Map());
  const [todayTotal, setTodayTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [viewMode]),
  );

  async function loadData() {
    const today = new Date().toISOString().split('T')[0];

    if (viewMode === 'today') {
      const entries = await getDayLog(today);
      setTodayEntries(entries);
      setTodayTotal(entries.reduce((sum, e) => sum + e.calories, 0));
    } else {
      const totals = await getWeekTotals(7);
      setWeekTotals(totals);
      // Load entries for each day
      const entriesMap = new Map<string, FoodLogEntry[]>();
      for (const t of totals) {
        const dayEntries = await getDayLog(t.date);
        entriesMap.set(t.date, dayEntries);
      }
      setWeekEntries(entriesMap);
    }
  }

  function handleDelete(entry: FoodLogEntry) {
    Alert.alert('Remove', `Remove ${entry.name} from your log?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteLogEntry(entry.id);
          await loadData();
        },
      },
    ]);
  }

  // Build sections for week view
  const weekSections: Section[] = weekTotals.map((t) => ({
    title: formatDate(t.date),
    subtitle: `${t.totalCalories} kcal  |  ${t.itemCount} item${t.itemCount !== 1 ? 's' : ''}`,
    data: weekEntries.get(t.date) || [],
  }));

  return (
    <View style={styles.container}>
      {/* Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'today' && styles.toggleActive]}
          onPress={() => setViewMode('today')}
        >
          <Text style={[styles.toggleText, viewMode === 'today' && styles.toggleTextActive]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'week' && styles.toggleActive]}
          onPress={() => setViewMode('week')}
        >
          <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextActive]}>
            This Week
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'today' ? (
        <>
          {/* Today's total */}
          <View style={styles.totalBanner}>
            <Text style={styles.totalLabel}>Today's Total</Text>
            <Text style={styles.totalValue}>{todayTotal} kcal</Text>
          </View>

          {todayEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No food logged today</Text>
              <Text style={styles.emptyHint}>Scan a barcode to start tracking</Text>
            </View>
          ) : (
            <SectionList
              sections={[{ title: 'Today', subtitle: '', data: todayEntries }]}
              keyExtractor={(item) => String(item.id)}
              renderSectionHeader={() => null}
              renderItem={({ item }) => (
                <FoodLogItem entry={item} onDelete={() => handleDelete(item)} />
              )}
              contentContainerStyle={styles.list}
            />
          )}
        </>
      ) : (
        <>
          {weekSections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No food logged this week</Text>
            </View>
          ) : (
            <SectionList
              sections={weekSections}
              keyExtractor={(item) => String(item.id)}
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <FoodLogItem entry={item} onDelete={() => handleDelete(item)} />
              )}
              contentContainerStyle={styles.list}
            />
          )}
        </>
      )}
    </View>
  );
}

function FoodLogItem({ entry, onDelete }: { entry: FoodLogEntry; onDelete: () => void }) {
  return (
    <TouchableOpacity style={styles.item} onLongPress={onDelete}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{entry.name}</Text>
        <Text style={styles.itemDetail}>
          {entry.brand} · {entry.servingGrams}g · {formatTime(entry.loggedAt)}
        </Text>
      </View>
      <View style={styles.itemCalories}>
        <Text style={styles.itemCalValue}>{entry.calories}</Text>
        <Text style={styles.itemCalUnit}>kcal</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toggleRow: {
    flexDirection: 'row',
    margin: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.textLight,
  },
  totalBanner: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.accent,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  itemDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemCalories: {
    alignItems: 'center',
  },
  itemCalValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.accent,
  },
  itemCalUnit: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
