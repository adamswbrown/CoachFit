"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ClientLayout } from "@/components/layouts/ClientLayout"
import { isClient } from "@/lib/permissions"
import { Role } from "@/lib/types"

type SessionBooking = {
  id: string
  status: string
  waitlistPosition: number | null
}

type ClassSessionRow = {
  id: string
  startsAt: string
  endsAt: string
  bookingOpen: boolean
  bookedCount: number
  waitlistedCount: number
  capacity: number
  isFull: boolean
  myBooking: SessionBooking | null
  classTemplate: {
    id: string
    name: string
    classType: string
    description?: string | null
    locationLabel: string
    roomLabel?: string | null
    creditsRequired: number
    waitlistEnabled: boolean
    ownerCoach?: {
      id: string
      name: string | null
      email: string
    } | null
  }
  instructor?: {
    id: string
    name: string | null
    email: string
  } | null
}

type CreditProduct = {
  id: string
  name: string
  creditMode: string
  creditsPerPeriod: number | null
  periodType: string
  purchasePriceGbp: number | null
  appliesToClassTypes: string[]
}

type CreditSubmission = {
  id: string
  createdAt: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  revolutReference: string
  note?: string | null
  creditProduct: {
    id: string
    name: string
    creditMode: string
    creditsPerPeriod: number | null
  }
}

type CreditSummary = {
  balance: number
  availableCredits: number
  pendingSubmissions: number
}

type ClassNotification = {
  id: string
  createdAt: string
  kind: string | null
  className: string | null
  startsAt: string | null
  productName: string | null
  creditsApplied: number | null
  message: string
  actor: {
    id: string
    name: string | null
    email: string
  }
}

const defaultSubmissionForm = {
  creditProductId: "",
  revolutReference: "",
  note: "",
}

type CalendarView = "DAY" | "WEEK" | "MONTH"

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function toStartOfDay(value: Date | string): Date {
  const source = value instanceof Date ? value : new Date(value)
  return new Date(source.getFullYear(), source.getMonth(), source.getDate())
}

function addDays(value: Date, amount: number): Date {
  const date = toStartOfDay(value)
  date.setDate(date.getDate() + amount)
  return date
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function startOfWeek(value: Date): Date {
  const date = toStartOfDay(value)
  const dayOffsetFromMonday = (date.getDay() + 6) % 7
  return addDays(date, -dayOffsetFromMonday)
}

function endOfWeek(value: Date): Date {
  return addDays(startOfWeek(value), 6)
}

function startOfMonthGrid(value: Date): Date {
  return startOfWeek(new Date(value.getFullYear(), value.getMonth(), 1))
}

function endOfMonthGrid(value: Date): Date {
  return endOfWeek(new Date(value.getFullYear(), value.getMonth() + 1, 0))
}

function formatDateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-")
}

function getBookingActionFlags(sessionRow: ClassSessionRow) {
  const myBooking = sessionRow.myBooking
  const canBook = !myBooking && sessionRow.bookingOpen && !sessionRow.isFull
  const canJoinWaitlist =
    !myBooking &&
    sessionRow.bookingOpen &&
    sessionRow.isFull &&
    sessionRow.classTemplate.waitlistEnabled

  return { myBooking, canBook, canJoinWaitlist }
}

export default function ClientClassesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [sessions, setSessions] = useState<ClassSessionRow[]>([])
  const [products, setProducts] = useState<CreditProduct[]>([])
  const [submissions, setSubmissions] = useState<CreditSubmission[]>([])
  const [notifications, setNotifications] = useState<ClassNotification[]>([])
  const [creditSummary, setCreditSummary] = useState<CreditSummary>({
    balance: 0,
    availableCredits: 0,
    pendingSubmissions: 0,
  })

  const [bookingDisabled, setBookingDisabled] = useState(false)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const [submissionBusy, setSubmissionBusy] = useState(false)
  const [submissionForm, setSubmissionForm] = useState(defaultSubmissionForm)
  const [classTypeFilter, setClassTypeFilter] = useState("ALL")
  const [calendarView, setCalendarView] = useState<CalendarView>("DAY")
  const [focusDate, setFocusDate] = useState(() => toStartOfDay(new Date()))
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return

    if (!isClient(session.user)) {
      if (session.user.roles.includes(Role.COACH)) {
        router.push("/coach-dashboard")
      } else if (session.user.roles.includes(Role.ADMIN)) {
        router.push("/admin/overview")
      }
      return
    }

    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [classesRes, notificationsRes] = await Promise.all([
        fetch("/api/client/classes"),
        fetch("/api/client/classes/notifications"),
      ])

      if (notificationsRes.ok) {
        const notificationsJson = await notificationsRes.json()
        setNotifications(notificationsJson.notifications || [])
      } else {
        setNotifications([])
      }

      if (classesRes.status === 403) {
        const disabledPayload = await classesRes.json().catch(() => ({}))
        if (disabledPayload?.code === "CLASS_BOOKING_DISABLED") {
          setBookingDisabled(true)
          setSessions([])
          setProducts([])
          setSubmissions([])
          setCreditSummary({ balance: 0, availableCredits: 0, pendingSubmissions: 0 })
          setError("Class booking is currently disabled by your coach/admin.")
          return
        }
      }

      if (!classesRes.ok) {
        throw new Error("Failed to load classes")
      }

      const classesJson = await classesRes.json()

      const submissionsRes = await fetch("/api/client/classes/credit-submissions")
      if (!submissionsRes.ok) {
        throw new Error("Failed to load class credit submissions")
      }
      const submissionsJson = await submissionsRes.json()

      const loadedProducts: CreditProduct[] = classesJson.products || submissionsJson.products || []

      setBookingDisabled(false)
      setSessions(classesJson.sessions || [])
      setProducts(loadedProducts)
      setCreditSummary(classesJson.creditSummary || { balance: 0, availableCredits: 0, pendingSubmissions: 0 })
      setSubmissions(submissionsJson.submissions || [])
      if (!submissionForm.creditProductId && loadedProducts[0]?.id) {
        setSubmissionForm((prev) => ({ ...prev, creditProductId: loadedProducts[0].id }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classes")
    } finally {
      setLoading(false)
    }
  }

  const filteredSessions = useMemo(
    () =>
      sessions.filter((sessionRow) =>
        classTypeFilter === "ALL"
          ? true
          : sessionRow.classTemplate.classType === classTypeFilter,
      ),
    [sessions, classTypeFilter],
  )

  const classTypes = useMemo(() => {
    const types = new Set<string>()
    sessions.forEach((sessionRow) => types.add(sessionRow.classTemplate.classType))
    return ["ALL", ...Array.from(types).sort()]
  }, [sessions])

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, ClassSessionRow[]>()
    filteredSessions.forEach((sessionRow) => {
      const key = formatDateKey(toStartOfDay(sessionRow.startsAt))
      const current = grouped.get(key) || []
      current.push(sessionRow)
      grouped.set(key, current)
    })

    grouped.forEach((rows) => rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()))
    return grouped
  }, [filteredSessions])

  const daySessions = useMemo(() => {
    const key = formatDateKey(focusDate)
    return sessionsByDate.get(key) || []
  }, [focusDate, sessionsByDate])

  const weekDates = useMemo(() => {
    const start = startOfWeek(focusDate)
    return Array.from({ length: 7 }, (_, idx) => addDays(start, idx))
  }, [focusDate])

  const weekSessions = useMemo(
    () =>
      weekDates.map((date) => ({
        date,
        sessions: sessionsByDate.get(formatDateKey(date)) || [],
      })),
    [weekDates, sessionsByDate],
  )

  const monthDates = useMemo(() => {
    const start = startOfMonthGrid(focusDate)
    const end = endOfMonthGrid(focusDate)
    const dates: Date[] = []
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      dates.push(cursor)
    }
    return dates
  }, [focusDate])

  const selectedSession = useMemo(
    () => sessions.find((sessionRow) => sessionRow.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  )

  useEffect(() => {
    if (!selectedSessionId) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedSessionId(null)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [selectedSessionId])

  const handleBook = async (sessionId: string) => {
    if (bookingDisabled) {
      setError("Class booking is currently disabled by your coach/admin.")
      return
    }

    setBusySessionId(sessionId)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/client/classes/sessions/${sessionId}/book`, {
        method: "POST",
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to book class")
      }

      setMessage(data.message || "Booking updated")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book class")
    } finally {
      setBusySessionId(null)
    }
  }

  const handleCancel = async (bookingId: string, sessionId: string) => {
    if (bookingDisabled) {
      setError("Class booking is currently disabled by your coach/admin.")
      return
    }

    setBusySessionId(sessionId)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/client/classes/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel booking")
      }

      setMessage(data.lateCancel ? "Late cancel recorded" : "Booking cancelled")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel booking")
    } finally {
      setBusySessionId(null)
    }
  }

  const handleSubmitCredit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (bookingDisabled) {
      setError("Class booking is currently disabled by your coach/admin.")
      return
    }

    setSubmissionBusy(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch("/api/client/classes/credit-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionForm),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit credit")
      }

      setMessage("Credit submission sent for review")
      setSubmissionForm((prev) => ({ ...defaultSubmissionForm, creditProductId: prev.creditProductId }))
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit credit")
    } finally {
      setSubmissionBusy(false)
    }
  }

  const calendarTitle = useMemo(() => {
    if (calendarView === "DAY") {
      return focusDate.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "short",
      })
    }

    if (calendarView === "WEEK") {
      const start = startOfWeek(focusDate)
      const end = endOfWeek(focusDate)
      return `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
    }

    return focusDate.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    })
  }, [calendarView, focusDate])

  const moveFocusDate = (direction: -1 | 1) => {
    setFocusDate((currentDate) => {
      if (calendarView === "DAY") {
        return addDays(currentDate, direction)
      }
      if (calendarView === "WEEK") {
        return addDays(currentDate, direction * 7)
      }
      return new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1)
    })
  }

  const selectedSessionStart = selectedSession ? new Date(selectedSession.startsAt) : null
  const selectedSessionEnd = selectedSession ? new Date(selectedSession.endsAt) : null

  if (loading) {
    return (
      <ClientLayout>
        <div className="max-w-5xl mx-auto py-8">Loading classes...</div>
      </ClientLayout>
    )
  }

  if (!session?.user || !isClient(session.user)) {
    return null
  }

  return (
    <ClientLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Classes</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Book sessions, manage waitlists, and track class credits
            </p>
          </div>
          <Link
            href="/client-dashboard"
            className="px-3 py-2 text-sm rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          >
            Back to dashboard
          </Link>
        </div>

        {(error || message) && (
          <div
            className={`p-3 rounded-md border text-sm ${
              error
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
            }`}
          >
            {error || message}
          </div>
        )}

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900">Credit Balance</h2>
          <div className="grid md:grid-cols-3 gap-3 mt-3">
            <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3">
              <p className="text-xs text-neutral-600 uppercase">Available credits</p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">{creditSummary.availableCredits}</p>
            </div>
            <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3">
              <p className="text-xs text-neutral-600 uppercase">Account balance</p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">{creditSummary.balance}</p>
            </div>
            <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3">
              <p className="text-xs text-neutral-600 uppercase">Pending submissions</p>
              <p className="text-2xl font-semibold text-neutral-900 mt-1">{creditSummary.pendingSubmissions}</p>
            </div>
          </div>
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900">In-app Notifications</h2>
          {notifications.length === 0 ? (
            <div className="text-sm text-neutral-600 mt-3">No notifications yet.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {notifications.slice(0, 12).map((notification) => (
                <div key={notification.id} className="border border-neutral-200 rounded-md p-3 text-sm">
                  <div className="text-neutral-900 font-medium">{notification.message}</div>
                  <div className="text-xs text-neutral-600 mt-1">
                    {new Date(notification.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                    {notification.startsAt
                      ? ` • Session ${new Date(notification.startsAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {bookingDisabled && (
          <section className="bg-amber-50 border border-amber-300 rounded-lg p-4">
            <h2 className="font-semibold text-amber-900">Class Booking Disabled</h2>
            <p className="text-sm text-amber-800 mt-2">
              Booking and credit submission are temporarily disabled by your coach/admin.
            </p>
          </section>
        )}

        {!bookingDisabled && (
          <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900">Submit Class Credit</h2>
          <form onSubmit={handleSubmitCredit} className="grid gap-3 mt-3">
            <div className="grid md:grid-cols-2 gap-3">
              <select
                value={submissionForm.creditProductId}
                onChange={(e) =>
                  setSubmissionForm((prev) => ({ ...prev, creditProductId: e.target.value }))
                }
                className="px-3 py-2 border border-neutral-300 rounded-md"
                required
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.purchasePriceGbp != null ? ` (£${product.purchasePriceGbp})` : ""}
                  </option>
                ))}
              </select>
              <input
                value={submissionForm.revolutReference}
                onChange={(e) =>
                  setSubmissionForm((prev) => ({ ...prev, revolutReference: e.target.value }))
                }
                className="px-3 py-2 border border-neutral-300 rounded-md"
                placeholder="Revolut reference"
                required
              />
            </div>
            <textarea
              value={submissionForm.note}
              onChange={(e) => setSubmissionForm((prev) => ({ ...prev, note: e.target.value }))}
              className="px-3 py-2 border border-neutral-300 rounded-md"
              placeholder="Optional note"
              rows={2}
            />
            <div>
              <button
                type="submit"
                disabled={submissionBusy}
                className="px-4 py-2 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {submissionBusy ? "Submitting..." : "Submit for Approval"}
              </button>
            </div>
          </form>

          {submissions.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-neutral-900">Recent submissions</h3>
              {submissions.slice(0, 5).map((submission) => (
                <div key={submission.id} className="border border-neutral-200 rounded-md p-2 text-sm">
                  <div className="text-neutral-900 font-medium">{submission.creditProduct.name}</div>
                  <div className="text-xs text-neutral-600 mt-1">
                    Ref: {submission.revolutReference} • {submission.status} • {new Date(submission.createdAt).toLocaleDateString("en-GB")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {!bookingDisabled && (
          <section className="bg-white border border-neutral-200 rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-neutral-900">Book a Class</h2>
                <p className="text-sm text-neutral-600 mt-1">
                  Day view is default for fastest booking. Tap any class for full details and actions.
                </p>
              </div>
              <div className="inline-flex rounded-md border border-neutral-300 p-0.5 bg-neutral-50">
                {(["DAY", "WEEK", "MONTH"] as CalendarView[]).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setCalendarView(view)}
                    className={`px-3 py-1.5 text-xs font-medium rounded ${
                      calendarView === view
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-white"
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveFocusDate(-1)}
                  className="px-2.5 py-1.5 text-xs rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setFocusDate(toStartOfDay(new Date()))}
                  className="px-2.5 py-1.5 text-xs rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => moveFocusDate(1)}
                  className="px-2.5 py-1.5 text-xs rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                >
                  Next
                </button>
              </div>
              <div className="text-sm font-medium text-neutral-900">{calendarTitle}</div>
              <select
                value={classTypeFilter}
                onChange={(e) => setClassTypeFilter(e.target.value)}
                className="px-2 py-1.5 border border-neutral-300 rounded-md text-sm"
              >
                {classTypes.map((classType) => (
                  <option key={classType} value={classType}>
                    {classType}
                  </option>
                ))}
              </select>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="mt-4 text-sm text-neutral-600">No sessions available for this filter.</div>
            ) : (
              <div className="mt-4">
                {calendarView === "DAY" && (
                  <div className="space-y-3">
                    {daySessions.length === 0 ? (
                      <div className="text-sm text-neutral-600">
                        No classes on this day. Try week or month view to find the next session.
                      </div>
                    ) : (
                      daySessions.map((sessionRow) => {
                        const { myBooking, canBook, canJoinWaitlist } = getBookingActionFlags(sessionRow)
                        const startsAt = new Date(sessionRow.startsAt)
                        const endsAt = new Date(sessionRow.endsAt)

                        return (
                          <button
                            key={sessionRow.id}
                            type="button"
                            onClick={() => setSelectedSessionId(sessionRow.id)}
                            className="w-full text-left border border-neutral-200 rounded-lg p-3 hover:border-neutral-400 hover:bg-neutral-50 transition-colors"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-neutral-900">{sessionRow.classTemplate.name}</div>
                                <div className="text-xs text-neutral-600 mt-1">
                                  {startsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                  {" - "}
                                  {endsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                  {" • "}
                                  {sessionRow.classTemplate.classType}
                                </div>
                                <div className="text-xs text-neutral-600 mt-1">
                                  {sessionRow.classTemplate.locationLabel}
                                  {sessionRow.classTemplate.roomLabel ? ` • ${sessionRow.classTemplate.roomLabel}` : ""}
                                </div>
                                <div className="text-xs text-neutral-600 mt-1">
                                  {sessionRow.bookedCount}/{sessionRow.capacity} attending • {sessionRow.waitlistedCount} waitlisted
                                </div>
                              </div>
                              <div className="text-right">
                                {myBooking ? (
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                      myBooking.status === "BOOKED"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {myBooking.status}
                                    {myBooking.waitlistPosition ? ` • #${myBooking.waitlistPosition}` : ""}
                                  </span>
                                ) : canBook ? (
                                  <span className="inline-flex px-2 py-1 text-xs rounded-full bg-neutral-900 text-white">
                                    Book now
                                  </span>
                                ) : canJoinWaitlist ? (
                                  <span className="inline-flex px-2 py-1 text-xs rounded-full bg-neutral-100 text-neutral-700">
                                    Join waitlist
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2 py-1 text-xs rounded-full bg-neutral-100 text-neutral-600">
                                    {sessionRow.bookingOpen ? "Unavailable" : "Booking closed"}
                                  </span>
                                )}
                                <div className="text-[11px] text-neutral-500 mt-1">Tap for details</div>
                              </div>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}

                {calendarView === "WEEK" && (
                  <div className="overflow-x-auto">
                    <div className="min-w-[900px] grid grid-cols-7 gap-3">
                      {weekSessions.map(({ date, sessions: weekDaySessions }) => (
                        <div
                          key={formatDateKey(date)}
                          className={`rounded-lg border p-2 ${
                            isSameDay(date, toStartOfDay(new Date()))
                              ? "border-neutral-900 bg-neutral-50"
                              : "border-neutral-200"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setFocusDate(date)}
                            className={`w-full text-left rounded px-1 py-1 ${
                              isSameDay(date, focusDate) ? "bg-neutral-900 text-white" : "text-neutral-800 hover:bg-neutral-100"
                            }`}
                          >
                            <div className="text-xs font-semibold">{date.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                            <div className="text-xs">{date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                          </button>

                          <div className="mt-2 space-y-2">
                            {weekDaySessions.length === 0 ? (
                              <div className="text-[11px] text-neutral-500 px-1 py-2">No classes</div>
                            ) : (
                              weekDaySessions.map((sessionRow) => (
                                <button
                                  key={sessionRow.id}
                                  type="button"
                                  onClick={() => setSelectedSessionId(sessionRow.id)}
                                  className="w-full rounded-md border border-neutral-200 px-2 py-2 text-left hover:border-neutral-400 hover:bg-white"
                                >
                                  <div className="text-[11px] text-neutral-700">
                                    {new Date(sessionRow.startsAt).toLocaleTimeString("en-GB", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                    })}
                                  </div>
                                  <div className="text-xs font-medium text-neutral-900 mt-0.5">{sessionRow.classTemplate.name}</div>
                                  <div className="text-[11px] text-neutral-600 mt-0.5">
                                    {sessionRow.bookedCount}/{sessionRow.capacity} attending
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {calendarView === "MONTH" && (
                  <div>
                    <div className="grid grid-cols-7 gap-2">
                      {WEEKDAY_LABELS.map((weekday) => (
                        <div key={weekday} className="text-[11px] uppercase tracking-wide text-neutral-500 px-1">
                          {weekday}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2 mt-2">
                      {monthDates.map((date) => {
                        const dateKey = formatDateKey(date)
                        const monthDaySessions = sessionsByDate.get(dateKey) || []
                        const isCurrentMonth = date.getMonth() === focusDate.getMonth()
                        const isToday = isSameDay(date, toStartOfDay(new Date()))
                        const isFocused = isSameDay(date, focusDate)

                        return (
                          <div
                            key={dateKey}
                            className={`min-h-[120px] rounded-md border p-1.5 ${
                              isFocused
                                ? "border-neutral-900"
                                : isToday
                                  ? "border-neutral-400"
                                  : "border-neutral-200"
                            } ${isCurrentMonth ? "bg-white" : "bg-neutral-50"}`}
                          >
                            <button
                              type="button"
                              onClick={() => setFocusDate(date)}
                              className={`h-6 w-6 text-[11px] rounded-full ${
                                isFocused ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
                              }`}
                            >
                              {date.getDate()}
                            </button>
                            <div className="mt-1 space-y-1">
                              {monthDaySessions.slice(0, 3).map((sessionRow) => (
                                <button
                                  key={sessionRow.id}
                                  type="button"
                                  onClick={() => setSelectedSessionId(sessionRow.id)}
                                  className="w-full rounded border border-neutral-200 px-1.5 py-1 text-left hover:border-neutral-400"
                                >
                                  <div className="text-[10px] text-neutral-700">
                                    {new Date(sessionRow.startsAt).toLocaleTimeString("en-GB", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                    })}
                                  </div>
                                  <div className="text-[11px] font-medium text-neutral-900 leading-tight truncate">
                                    {sessionRow.classTemplate.name}
                                  </div>
                                </button>
                              ))}
                              {monthDaySessions.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFocusDate(date)
                                    setCalendarView("DAY")
                                  }}
                                  className="w-full text-left text-[11px] text-neutral-600 px-1.5 py-0.5 hover:text-neutral-900"
                                >
                                  +{monthDaySessions.length - 3} more
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              onClick={() => setSelectedSessionId(null)}
              className="absolute inset-0 bg-black/40"
              aria-label="Close class details"
            />
            <div className="relative w-full max-w-xl rounded-xl bg-white shadow-xl border border-neutral-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-900">{selectedSession.classTemplate.name}</h3>
                  <div className="text-sm text-neutral-600 mt-1">
                    {selectedSession.classTemplate.classType} • {selectedSession.classTemplate.creditsRequired} credit(s)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSessionId(null)}
                  className="px-2 py-1 text-sm rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-md border border-neutral-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">When</div>
                  <div className="text-neutral-900 mt-1">
                    {selectedSessionStart?.toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    •{" "}
                    {selectedSessionStart?.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                    {" - "}
                    {selectedSessionEnd?.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-neutral-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Who is running it</div>
                  <div className="text-neutral-900 mt-1">
                    {selectedSession.instructor?.name ||
                      selectedSession.classTemplate.ownerCoach?.name ||
                      "Coach TBC"}
                  </div>
                  {(selectedSession.instructor?.email || selectedSession.classTemplate.ownerCoach?.email) && (
                    <div className="text-xs text-neutral-600 mt-1">
                      {selectedSession.instructor?.email || selectedSession.classTemplate.ownerCoach?.email}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-neutral-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Where</div>
                  <div className="text-neutral-900 mt-1">{selectedSession.classTemplate.locationLabel}</div>
                  {selectedSession.classTemplate.roomLabel && (
                    <div className="text-xs text-neutral-600 mt-1">{selectedSession.classTemplate.roomLabel}</div>
                  )}
                </div>

                <div className="rounded-md border border-neutral-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Attendance</div>
                  <div className="text-neutral-900 mt-1">
                    {selectedSession.bookedCount}/{selectedSession.capacity} attending • {selectedSession.waitlistedCount} waitlisted
                  </div>
                </div>

                {selectedSession.classTemplate.description && (
                  <div className="rounded-md border border-neutral-200 p-3">
                    <div className="text-xs uppercase tracking-wide text-neutral-500">Class details</div>
                    <div className="text-neutral-900 mt-1">{selectedSession.classTemplate.description}</div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-neutral-600">
                  {selectedSession.bookingOpen ? "Booking is open" : "Booking window is closed"}
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const { myBooking, canBook, canJoinWaitlist } = getBookingActionFlags(selectedSession)
                    const busy = busySessionId === selectedSession.id

                    if (myBooking && (myBooking.status === "BOOKED" || myBooking.status === "WAITLISTED")) {
                      return (
                        <button
                          type="button"
                          onClick={() => handleCancel(myBooking.id, selectedSession.id)}
                          disabled={busy}
                          className="px-3 py-2 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy ? "Cancelling..." : "Cancel booking"}
                        </button>
                      )
                    }

                    if (canBook) {
                      return (
                        <button
                          type="button"
                          onClick={() => handleBook(selectedSession.id)}
                          disabled={busy}
                          className="px-3 py-2 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          {busy ? "Booking..." : "Book class"}
                        </button>
                      )
                    }

                    if (canJoinWaitlist) {
                      return (
                        <button
                          type="button"
                          onClick={() => handleBook(selectedSession.id)}
                          disabled={busy}
                          className="px-3 py-2 text-sm rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          {busy ? "Joining..." : "Join waitlist"}
                        </button>
                      )
                    }

                    return (
                      <span className="px-3 py-2 text-sm rounded-md bg-neutral-100 text-neutral-600">
                        {selectedSession.bookingOpen ? "Unavailable" : "Booking closed"}
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  )
}
