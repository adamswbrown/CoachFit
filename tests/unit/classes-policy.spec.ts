import { describe, expect, it } from "vitest"
import {
  DEFAULT_BOOKING_OPEN_HOURS,
  getBookingCloseAt,
  getBookingOpenAt,
  getLateCancelCutoff,
  isBookingOpen,
  isLateCancel,
  resolveBookingPolicy,
  canJoinWaitlist,
} from "../../lib/classes-policy"

describe("classes-policy", () => {
  const startsAt = new Date("2026-03-01T10:00:00.000Z")

  it("uses 14-day open window by default", () => {
    const policy = resolveBookingPolicy({})
    const openAt = getBookingOpenAt(startsAt, policy)
    const diffHours = Math.round((startsAt.getTime() - openAt.getTime()) / (60 * 60 * 1000))
    expect(diffHours).toBe(DEFAULT_BOOKING_OPEN_HOURS)
  })

  it("closes booking at session start by default", () => {
    const policy = resolveBookingPolicy({})
    const closeAt = getBookingCloseAt(startsAt, policy)
    expect(closeAt.toISOString()).toBe(startsAt.toISOString())
  })

  it("treats late cancel cutoff as 60 minutes by default", () => {
    const policy = resolveBookingPolicy({})
    const cutoff = getLateCancelCutoff(startsAt, policy)
    expect(cutoff.toISOString()).toBe("2026-03-01T09:00:00.000Z")
    expect(isLateCancel(new Date("2026-03-01T09:00:01.000Z"), startsAt, policy)).toBe(true)
    expect(isLateCancel(new Date("2026-03-01T08:59:59.000Z"), startsAt, policy)).toBe(false)
  })

  it("checks booking open window correctly", () => {
    const policy = resolveBookingPolicy({})
    expect(isBookingOpen(new Date("2026-02-16T10:00:00.000Z"), startsAt, policy)).toBe(true)
    expect(isBookingOpen(new Date("2026-02-15T09:59:59.000Z"), startsAt, policy)).toBe(false)
    expect(isBookingOpen(new Date("2026-03-01T10:00:01.000Z"), startsAt, policy)).toBe(false)
  })

  it("enforces waitlist capacity", () => {
    const policy = resolveBookingPolicy({ waitlistCapacity: 10 })
    expect(canJoinWaitlist(9, policy)).toBe(true)
    expect(canJoinWaitlist(10, policy)).toBe(false)
  })

  it("allows override defaults", () => {
    const policy = resolveBookingPolicy(
      {
        bookingOpenHoursBefore: 48,
      },
      {
        bookingCloseMinutesBefore: 30,
        cancelCutoffMinutes: 120,
        waitlistCapacity: 5,
        capacity: 18,
      },
    )

    expect(policy.bookingOpenHoursBefore).toBe(48)
    expect(policy.bookingCloseMinutesBefore).toBe(30)
    expect(policy.cancelCutoffMinutes).toBe(120)
    expect(policy.waitlistCapacity).toBe(5)
    expect(policy.capacity).toBe(18)
  })
})
