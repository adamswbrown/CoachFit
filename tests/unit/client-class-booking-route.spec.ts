import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const isClientMock = vi.fn()
const getSystemSettingsMock = vi.fn()
const classSessionFindFirstMock = vi.fn()
const transactionMock = vi.fn()
const bookClientIntoSessionTxMock = vi.fn()
const getClassBookingDefaultsMock = vi.fn()
const sendBookingNotificationsMock = vi.fn()
const logAuditActionMock = vi.fn()

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
      findFirst: classSessionFindFirstMock,
    },
    $transaction: transactionMock,
  },
}))

vi.mock("@/lib/classes-service", () => ({
  bookClientIntoSessionTx: bookClientIntoSessionTxMock,
  getClassBookingDefaults: getClassBookingDefaultsMock,
  isClassBookingError: (error: any) => Boolean(error?.statusCode),
  sendBookingNotifications: sendBookingNotificationsMock,
}))

vi.mock("@/lib/audit-log", () => ({
  logAuditAction: logAuditActionMock,
}))

describe("POST /api/client/classes/sessions/[id]/book", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getClassBookingDefaultsMock.mockResolvedValue({
      bookingOpenHoursDefault: 336,
      bookingCloseMinutesDefault: 0,
      lateCancelCutoffMinutesDefault: 60,
      defaultWaitlistCap: 10,
      defaultClassCapacity: 20,
      defaultCreditsPerBooking: 1,
      bookingTimezone: "Europe/London",
    })

    classSessionFindFirstMock.mockResolvedValue({ id: "session-1" })
    transactionMock.mockImplementation(async (cb: any) => cb({}))
    getSystemSettingsMock.mockResolvedValue({ classBookingEnabled: true })
    isClientMock.mockReturnValue(true)
  })

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null)

    const { POST } = await import(
      "../../app/api/client/classes/sessions/[id]/book/route"
    )

    const res = await POST(new Request("http://localhost/api/client/classes/sessions/session-1/book", {
      method: "POST",
    }) as any, {
      params: Promise.resolve({ id: "session-1" }),
    })

    expect(res.status).toBe(401)
  })

  it("returns 403 for non-client role", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", roles: ["COACH"] } })
    isClientMock.mockReturnValue(false)

    const { POST } = await import(
      "../../app/api/client/classes/sessions/[id]/book/route"
    )

    const res = await POST(new Request("http://localhost/api/client/classes/sessions/session-1/book", {
      method: "POST",
    }) as any, {
      params: Promise.resolve({ id: "session-1" }),
    })

    expect(res.status).toBe(403)
  })

  it("returns 403 when class booking flag is disabled", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", roles: ["CLIENT"] } })
    getSystemSettingsMock.mockResolvedValue({ classBookingEnabled: false })

    const { POST } = await import(
      "../../app/api/client/classes/sessions/[id]/book/route"
    )

    const res = await POST(new Request("http://localhost/api/client/classes/sessions/session-1/book", {
      method: "POST",
    }) as any, {
      params: Promise.resolve({ id: "session-1" }),
    })

    expect(res.status).toBe(403)
    expect(bookClientIntoSessionTxMock).not.toHaveBeenCalled()
  })

  it("returns 404 when session is not accessible", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", roles: ["CLIENT"] } })
    classSessionFindFirstMock.mockResolvedValue(null)

    const { POST } = await import(
      "../../app/api/client/classes/sessions/[id]/book/route"
    )

    const res = await POST(new Request("http://localhost/api/client/classes/sessions/session-1/book", {
      method: "POST",
    }) as any, {
      params: Promise.resolve({ id: "session-1" }),
    })

    expect(res.status).toBe(404)
  })

  it("books successfully and returns 201", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "u1",
        roles: ["CLIENT"],
        email: "client@example.com",
        name: "Client",
      },
    })

    bookClientIntoSessionTxMock.mockResolvedValue({
      booking: { id: "booking-1", status: "BOOKED" },
      result: "booked",
      session: {
        startsAt: new Date("2026-03-01T10:00:00.000Z"),
        classTemplate: {
          name: "HIIT",
          locationLabel: "Hitsona Bangor",
        },
      },
    })

    const { POST } = await import(
      "../../app/api/client/classes/sessions/[id]/book/route"
    )

    const res = await POST(new Request("http://localhost/api/client/classes/sessions/session-1/book", {
      method: "POST",
    }) as any, {
      params: Promise.resolve({ id: "session-1" }),
    })

    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.result).toBe("booked")
    expect(bookClientIntoSessionTxMock).toHaveBeenCalled()
    expect(sendBookingNotificationsMock).toHaveBeenCalled()
    expect(logAuditActionMock).toHaveBeenCalled()
  })
})
