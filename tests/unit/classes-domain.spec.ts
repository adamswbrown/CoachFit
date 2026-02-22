import { describe, expect, it } from "vitest"
import {
  classTypeEligibleForProduct,
  endOfMonthUtc,
  getAvailableCreditsFromLedger,
  getSessionOccupancyCounts,
  isMvpClassType,
  monthKey,
  normalizeClassType,
  shouldApplyMonthlyTopup,
} from "../../lib/classes-domain"

describe("classes-domain", () => {
  it("normalizes TeamUp aliases", () => {
    expect(normalizeClassType("HITZone")).toBe("HIIT")
    expect(normalizeClassType("COREZone")).toBe("CORE")
    expect(normalizeClassType("strength")).toBe("STRENGTH")
  })

  it("identifies MVP class types", () => {
    expect(isMvpClassType("HIIT")).toBe(true)
    expect(isMvpClassType("CORE")).toBe(true)
    expect(isMvpClassType("STRENGTH")).toBe(true)
    expect(isMvpClassType("PT")).toBe(false)
  })

  it("calculates available credits excluding expired entries", () => {
    const at = new Date("2026-02-21T12:00:00.000Z")
    const available = getAvailableCreditsFromLedger(
      [
        { deltaCredits: 20, expiresAt: new Date("2026-02-28T23:59:59.999Z") },
        { deltaCredits: -1, expiresAt: null },
        { deltaCredits: 5, expiresAt: new Date("2026-02-20T23:59:59.999Z") },
      ],
      at,
    )
    expect(available).toBe(19)
  })

  it("checks class eligibility on normalized type", () => {
    expect(classTypeEligibleForProduct("HIIT", ["HIIT", "CORE", "STRENGTH"])).toBe(true)
    expect(classTypeEligibleForProduct("HITZone", ["HIIT"])).toBe(true)
    expect(classTypeEligibleForProduct("MOBILITY", ["HIIT"])).toBe(false)
  })

  it("counts booked and waitlisted occupancy", () => {
    const counts = getSessionOccupancyCounts([
      { status: "BOOKED" },
      { status: "WAITLISTED" },
      { status: "ATTENDED" },
      { status: "NO_SHOW" },
      { status: "CANCELLED" },
    ])

    expect(counts.bookedCount).toBe(3)
    expect(counts.waitlistedCount).toBe(1)
  })

  it("handles month helpers", () => {
    const date = new Date("2026-02-21T12:00:00.000Z")
    expect(monthKey(date)).toBe("2026-02")
    expect(endOfMonthUtc(date).toISOString()).toBe("2026-02-28T23:59:59.999Z")
  })

  it("checks monthly topup eligibility", () => {
    const at = new Date("2026-02-21T12:00:00.000Z")

    expect(
      shouldApplyMonthlyTopup(
        {
          active: true,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          lastAppliedMonth: "2026-01",
        },
        at,
      ),
    ).toBe(true)

    expect(
      shouldApplyMonthlyTopup(
        {
          active: true,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          lastAppliedMonth: "2026-02",
        },
        at,
      ),
    ).toBe(false)

    expect(
      shouldApplyMonthlyTopup(
        {
          active: false,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: null,
          lastAppliedMonth: null,
        },
        at,
      ),
    ).toBe(false)
  })
})
