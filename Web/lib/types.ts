// Define Role enum locally to avoid importing Prisma client in browser bundles
// This mirrors the Prisma schema definition
export enum Role {
  CLIENT = "CLIENT",
  COACH = "COACH",
  ADMIN = "ADMIN",
}

export type CohortDurationConfig = "six-week" | "custom"

export enum CohortType {
  TIMED = "TIMED",
  ONGOING = "ONGOING",
  CHALLENGE = "CHALLENGE",
  CUSTOM = "CUSTOM",
}

// Fitness Wrapped types
export interface WrappedTotals {
  entries: number
  workouts: number
  totalCalories: number
  totalSteps: number
  totalWorkoutMins: number
  totalSleepMins: number
  weightChange: number | null
}

export interface WrappedStreaks {
  longestEntryStreak: number
}

export interface WrappedTopMetrics {
  bestStepsDay: number
  bestCaloriesDay: number
  longestWorkout: number
  bestSleepNight: number
}

export interface WrappedFunFact {
  metric: string
  value: number
  comparison: string
  icon: string
}

export interface WrappedSummary {
  totals: WrappedTotals
  streaks: WrappedStreaks
  topMetrics: WrappedTopMetrics
  funFacts: WrappedFunFact[]
  dateRange: { startDate: Date; endDate: Date }
  cohortName?: string
}
