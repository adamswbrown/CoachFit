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

export enum ClassScope {
  FACILITY = "FACILITY",
  COHORT = "COHORT",
}

export enum SessionStatus {
  SCHEDULED = "SCHEDULED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
}

export enum BookingStatus {
  BOOKED = "BOOKED",
  WAITLISTED = "WAITLISTED",
  CANCELLED = "CANCELLED",
  LATE_CANCEL = "LATE_CANCEL",
  ATTENDED = "ATTENDED",
  NO_SHOW = "NO_SHOW",
}

export enum BookingSource {
  CLIENT = "CLIENT",
  COACH = "COACH",
  ADMIN = "ADMIN",
  SYSTEM = "SYSTEM",
}

export enum CreditSubmissionStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum CreditLedgerReason {
  TOPUP_MONTHLY = "TOPUP_MONTHLY",
  PACK_PURCHASE = "PACK_PURCHASE",
  BOOKING_DEBIT = "BOOKING_DEBIT",
  REFUND = "REFUND",
  MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT",
  EXPIRY = "EXPIRY",
}

export enum CreditProductMode {
  MONTHLY_TOPUP = "MONTHLY_TOPUP",
  ONE_TIME_PACK = "ONE_TIME_PACK",
  CATALOG_ONLY = "CATALOG_ONLY",
}

export enum CreditPeriodType {
  MONTH = "MONTH",
  ONE_TIME = "ONE_TIME",
}

export interface ClassTemplateSummary {
  id: string
  ownerCoachId: string
  name: string
  classType: string
  description?: string | null
  scope: ClassScope
  cohortId?: string | null
  locationLabel: string
  roomLabel?: string | null
  capacity: number
  waitlistEnabled: boolean
  waitlistCapacity: number
  bookingOpenHoursBefore: number
  bookingCloseMinutesBefore: number
  cancelCutoffMinutes: number
  creditsRequired: number
  isActive: boolean
}

export interface ClassSessionSummary {
  id: string
  classTemplateId: string
  instructorId?: string | null
  startsAt: string
  endsAt: string
  capacityOverride?: number | null
  status: SessionStatus
  cancelReason?: string | null
}

export interface CreditProductSummary {
  id: string
  name: string
  description?: string | null
  appliesToClassTypes: string[]
  creditMode: CreditProductMode
  creditsPerPeriod?: number | null
  periodType: CreditPeriodType
  purchasePriceGbp?: number | null
  currency: string
  classEligible: boolean
  isActive: boolean
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
