import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const isClientMock = vi.fn()
const getSystemSettingsMock = vi.fn()

const classSessionFindManyMock = vi.fn()
const creditProductFindManyMock = vi.fn()
const getClassBookingDefaultsMock = vi.fn()
const getClientCreditSummaryMock = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}))

vi.mock("@/lib/permissions", () => ({
  isClient: isClientMock,
}))

vi.mock("@/lib/system-settings", () => ({
  getSystemSettings: getSystemSettingsMock,
}))

vi.mock("@/lib/db", () => ({
  db: {
    classSession: {
      findMany: classSessionFindManyMock,
    },
    creditProduct: {
      findMany: creditProductFindManyMock,
    },
  },
}))

vi.mock("@/lib/classes-service", () => ({
  getClassBookingDefaults: getClassBookingDefaultsMock,
  getClientCreditSummary: getClientCreditSummaryMock,
}))

describe("GET /api/client/classes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isClientMock.mockReturnValue(true)
    getSystemSettingsMock.mockResolvedValue({ classBookingEnabled: true })

    getClassBookingDefaultsMock.mockResolvedValue({
      bookingOpenHoursDefault: 336,
      bookingCloseMinutesDefault: 0,
      lateCancelCutoffMinutesDefault: 60,
      defaultWaitlistCap: 10,
      defaultClassCapacity: 20,
      defaultCreditsPerBooking: 1,
      bookingTimezone: "Europe/London",
    })

    classSessionFindManyMock.mockResolvedValue([])
    creditProductFindManyMock.mockResolvedValue([])
    getClientCreditSummaryMock.mockResolvedValue({
      balance: 0,
      availableCredits: 0,
      pendingSubmissions: 0,
    })
  })

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null)

    const { GET } = await import("../../app/api/client/classes/route")
    const res = await GET(new Request("http://localhost/api/client/classes") as any)

    expect(res.status).toBe(401)
  })

  it("returns 403 for non-client", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", roles: ["COACH"] } })
    isClientMock.mockReturnValue(false)

    const { GET } = await import("../../app/api/client/classes/route")
    const res = await GET(new Request("http://localhost/api/client/classes") as any)

    expect(res.status).toBe(403)
  })

  it("returns 403 when class booking is disabled", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", roles: ["CLIENT"] } })
    getSystemSettingsMock.mockResolvedValue({ classBookingEnabled: false })

    const { GET } = await import("../../app/api/client/classes/route")
    const res = await GET(new Request("http://localhost/api/client/classes") as any)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe("CLASS_BOOKING_DISABLED")
    expect(classSessionFindManyMock).not.toHaveBeenCalled()
  })
})
