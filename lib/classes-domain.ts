export const MVP_CLASS_TYPES = ["HIIT", "CORE", "STRENGTH"] as const

export type MvpClassType = (typeof MVP_CLASS_TYPES)[number]

export type LedgerLike = {
  deltaCredits: number
  expiresAt?: Date | null
}

export type BookingLike = {
  status: string
}

export type SubscriptionLike = {
  active: boolean
  startDate: Date
  endDate?: Date | null
  lastAppliedMonth?: string | null
}

export function normalizeClassType(raw: string | null | undefined): string {
  if (!raw) return ""
  const normalized = raw.trim().toUpperCase()
  if (normalized === "HITZONE") return "HIIT"
  if (normalized === "COREZONE") return "CORE"
  return normalized
}

export function isMvpClassType(classType: string): classType is MvpClassType {
  const normalized = normalizeClassType(classType)
  return (MVP_CLASS_TYPES as readonly string[]).includes(normalized)
}

export function monthKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  return `${year}-${month}`
}

export function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
}

export function endOfMonthUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0) - 1,
  )
}

export function getAvailableCreditsFromLedger(entries: LedgerLike[], at: Date = new Date()): number {
  return entries.reduce((total, entry) => {
    if (entry.expiresAt && entry.expiresAt.getTime() <= at.getTime()) {
      return total
    }
    return total + entry.deltaCredits
  }, 0)
}

export function classTypeEligibleForProduct(
  classType: string,
  appliesToClassTypes: string[] | null | undefined,
): boolean {
  if (!appliesToClassTypes || appliesToClassTypes.length === 0) {
    return false
  }
  const target = normalizeClassType(classType)
  return appliesToClassTypes.some((candidate) => normalizeClassType(candidate) === target)
}

export function getSessionOccupancyCounts(bookings: BookingLike[]): {
  bookedCount: number
  waitlistedCount: number
} {
  let bookedCount = 0
  let waitlistedCount = 0

  for (const booking of bookings) {
    if (booking.status === "BOOKED" || booking.status === "ATTENDED" || booking.status === "NO_SHOW") {
      bookedCount += 1
      continue
    }

    if (booking.status === "WAITLISTED") {
      waitlistedCount += 1
    }
  }

  return { bookedCount, waitlistedCount }
}

export function isSubscriptionActiveOn(subscription: SubscriptionLike, at: Date): boolean {
  if (!subscription.active) return false
  if (subscription.startDate.getTime() > at.getTime()) return false
  if (subscription.endDate && subscription.endDate.getTime() < at.getTime()) return false
  return true
}

export function shouldApplyMonthlyTopup(subscription: SubscriptionLike, at: Date): boolean {
  if (!isSubscriptionActiveOn(subscription, at)) return false
  const currentMonth = monthKey(at)
  return subscription.lastAppliedMonth !== currentMonth
}
