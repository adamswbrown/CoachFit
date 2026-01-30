/**
 * Fitness Wrapped Calculator
 * Aggregates client fitness data and calculates fun, shareable statistics
 */

import { db } from "./db"
import * as conversions from "./wrapped-conversions"
import type { WrappedSummary } from "./types"

/**
 * Calculate all wrapped statistics for a user within a date range
 */
export async function calculateWrappedStats(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<WrappedSummary> {
  // Fetch all entries in date range
  const entries = await db.entry.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate }
    },
    orderBy: { date: "asc" }
  })

  // Fetch all workouts in date range
  const workouts = await db.workout.findMany({
    where: {
      userId,
      startTime: { gte: startDate, lte: endDate }
    },
    orderBy: { startTime: "asc" }
  })

  // Fetch all sleep records
  const sleepRecords = await db.sleepRecord.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate }
    },
    orderBy: { date: "asc" }
  })

  // Calculate totals
  const totalCalories = entries.reduce((sum, e) => sum + (e.calories || 0), 0)
  const totalSteps = entries.reduce((sum, e) => sum + (e.steps || 0), 0)
  const totalWorkoutMins = workouts.reduce((sum, w) => sum + (w.durationSecs / 60), 0)
  const totalSleepMins = sleepRecords.reduce((sum, s) => sum + s.totalSleepMins, 0)

  // Calculate weight change (first vs last entry with weight)
  const entriesWithWeight = entries.filter(e => e.weightLbs !== null)
  const weightChange = entriesWithWeight.length >= 2
    ? entriesWithWeight[entriesWithWeight.length - 1].weightLbs! - entriesWithWeight[0].weightLbs!
    : null

  // Calculate streaks
  const streaks = calculateStreaks(entries)

  // Find top metrics
  const topMetrics = findTopMetrics(entries, workouts, sleepRecords)

  // Generate fun facts using conversion helpers
  const funFacts = [
    {
      metric: "calories",
      value: totalCalories,
      comparison: conversions.getCalorieComparisonString(totalCalories),
      icon: "🔥"
    },
    {
      metric: "steps",
      value: totalSteps,
      comparison: conversions.getStepsComparisonString(totalSteps),
      icon: "👟"
    },
    {
      metric: "workouts",
      value: totalWorkoutMins,
      comparison: conversions.getWorkoutTimeComparisonString(totalWorkoutMins),
      icon: "💪"
    },
    {
      metric: "sleep",
      value: totalSleepMins,
      comparison: conversions.getSleepComparisonString(totalSleepMins),
      icon: "😴"
    }
  ]

  // Add weight change fun fact if available
  if (weightChange !== null) {
    funFacts.push({
      metric: "weight",
      value: weightChange,
      comparison: conversions.getWeightChangeComparisonString(weightChange),
      icon: weightChange < 0 ? "🎉" : "💪"
    })
  }

  return {
    totals: {
      entries: entries.length,
      workouts: workouts.length,
      totalCalories,
      totalSteps,
      totalWorkoutMins,
      totalSleepMins,
      weightChange
    },
    streaks,
    topMetrics,
    funFacts,
    dateRange: { startDate, endDate }
  }
}

/**
 * Calculate streaks from entries
 */
function calculateStreaks(entries: any[]) {
  if (entries.length === 0) {
    return { longestEntryStreak: 0 }
  }

  let currentStreak = 1
  let longestStreak = 1

  for (let i = 1; i < entries.length; i++) {
    if (isConsecutiveDay(entries[i - 1].date, entries[i].date)) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }

  return { longestEntryStreak: longestStreak }
}

/**
 * Check if two dates are consecutive days
 */
function isConsecutiveDay(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1).getTime()
  const d2 = new Date(date2).getTime()
  const diffDays = (d2 - d1) / (1000 * 60 * 60 * 24)
  return diffDays === 1
}

/**
 * Find top metrics from data
 */
function findTopMetrics(entries: any[], workouts: any[], sleepRecords: any[]) {
  const maxSteps = entries.length > 0 ? Math.max(...entries.map(e => e.steps || 0)) : 0
  const maxCalories = entries.length > 0 ? Math.max(...entries.map(e => e.calories || 0)) : 0
  const maxWorkoutMins = workouts.length > 0 ? Math.max(...workouts.map(w => w.durationSecs / 60)) : 0
  const maxSleep = sleepRecords.length > 0 ? Math.max(...sleepRecords.map(s => s.totalSleepMins)) : 0

  return {
    bestStepsDay: maxSteps,
    bestCaloriesDay: maxCalories,
    longestWorkout: maxWorkoutMins,
    bestSleepNight: maxSleep
  }
}

/**
 * Get cohort date range based on start date and duration
 */
export function getCohortDateRange(cohort: {
  cohortStartDate: Date
  durationWeeks: number | null
}) {
  const startDate = new Date(cohort.cohortStartDate)
  const endDate = new Date(startDate)
  const weeks = cohort.durationWeeks || 6 // Default to 6 weeks if not specified
  endDate.setDate(endDate.getDate() + (weeks * 7))

  return { startDate, endDate }
}

/**
 * Check if a cohort is eligible for wrapped (6 or 8 week challenges that have completed)
 */
export function isWrappedEligible(cohort: {
  cohortStartDate: Date | null
  durationWeeks: number | null
}): boolean {
  if (!cohort.cohortStartDate) {
    return false
  }

  const weeks = cohort.durationWeeks || 6

  // Only show wrapped for 6-week and 8-week challenges
  if (weeks !== 6 && weeks !== 8) {
    return false
  }

  const { endDate } = getCohortDateRange({
    cohortStartDate: cohort.cohortStartDate,
    durationWeeks: weeks
  })

  const today = new Date()
  return today >= endDate
}
