export const DEFAULT_BOOKING_OPEN_HOURS = 24 * 14
export const DEFAULT_BOOKING_CLOSE_MINUTES = 0
export const DEFAULT_LATE_CANCEL_CUTOFF_MINUTES = 60
export const DEFAULT_WAITLIST_CAP = 10
export const DEFAULT_CREDITS_PER_BOOKING = 1

export type BookingPolicyInput = {
  bookingOpenHoursBefore: number
  bookingCloseMinutesBefore: number
  cancelCutoffMinutes: number
  waitlistCapacity: number
  capacity: number
}

export type BookingPolicyDefaults = Partial<BookingPolicyInput>

export function resolveBookingPolicy(
  policy: Partial<BookingPolicyInput>,
  defaults?: BookingPolicyDefaults,
): BookingPolicyInput {
  return {
    bookingOpenHoursBefore:
      policy.bookingOpenHoursBefore ?? defaults?.bookingOpenHoursBefore ?? DEFAULT_BOOKING_OPEN_HOURS,
    bookingCloseMinutesBefore:
      policy.bookingCloseMinutesBefore ?? defaults?.bookingCloseMinutesBefore ?? DEFAULT_BOOKING_CLOSE_MINUTES,
    cancelCutoffMinutes:
      policy.cancelCutoffMinutes ?? defaults?.cancelCutoffMinutes ?? DEFAULT_LATE_CANCEL_CUTOFF_MINUTES,
    waitlistCapacity: policy.waitlistCapacity ?? defaults?.waitlistCapacity ?? DEFAULT_WAITLIST_CAP,
    capacity: policy.capacity ?? defaults?.capacity ?? 20,
  }
}

export function getEffectiveSessionCapacity(
  template: Pick<BookingPolicyInput, "capacity">,
  session: { capacityOverride?: number | null },
): number {
  return session.capacityOverride ?? template.capacity
}

export function getBookingOpenAt(startsAt: Date, policy: BookingPolicyInput): Date {
  return new Date(startsAt.getTime() - policy.bookingOpenHoursBefore * 60 * 60 * 1000)
}

export function getBookingCloseAt(startsAt: Date, policy: BookingPolicyInput): Date {
  return new Date(startsAt.getTime() - policy.bookingCloseMinutesBefore * 60 * 1000)
}

export function isBookingOpen(now: Date, startsAt: Date, policy: BookingPolicyInput): boolean {
  const openAt = getBookingOpenAt(startsAt, policy)
  const closeAt = getBookingCloseAt(startsAt, policy)
  return now >= openAt && now <= closeAt
}

export function getLateCancelCutoff(startsAt: Date, policy: BookingPolicyInput): Date {
  return new Date(startsAt.getTime() - policy.cancelCutoffMinutes * 60 * 1000)
}

export function isLateCancel(now: Date, startsAt: Date, policy: BookingPolicyInput): boolean {
  return now > getLateCancelCutoff(startsAt, policy)
}

export function canJoinWaitlist(waitingCount: number, policy: BookingPolicyInput): boolean {
  return waitingCount < policy.waitlistCapacity
}
