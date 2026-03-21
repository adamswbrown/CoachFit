"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { CreditBalance } from "@/components/credits/credit-balance"
import Link from "next/link"

// ─── Types ─────────────────────────────────────────────────────────────────

interface ClassTemplate {
  id: string
  name: string
  classType: string
  capacity: number
  creditsRequired: number
  cancelCutoffMinutes: number
}

interface Instructor {
  id: string
  name: string
  image?: string | null
}

interface ClassSession {
  id: string
  startsAt: string
  endsAt: string
  status: string
  capacityOverride?: number | null
  classTemplate: ClassTemplate
  instructor: Instructor
  _count: { bookings: number }
  spotsRemaining: number
}

interface Booking {
  id: string
  status: string
  createdAt: string
  canceledAt?: string | null
  session: {
    id: string
    startsAt: string
    endsAt: string
    classTemplate: {
      name: string
      classType: string
      cancelCutoffMinutes: number
    }
    instructor: {
      name: string
      image?: string | null
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function getDateRange(days = 14): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    dates.push(d)
  }
  return dates
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatTime(isoString: string): { hour: string; period: string; duration?: string } {
  const d = new Date(isoString)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const period = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  const displayMinutes = minutes.toString().padStart(2, "0")
  return { hour: `${displayHour}:${displayMinutes}`, period }
}

function getDurationMinutes(startsAt: string, endsAt: string): number {
  return Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function classTypeColor(classType: string): string {
  switch (classType.toUpperCase()) {
    case "HIIT":
      return "#452ddb"
    case "CORE":
      return "#f2de24"
    default:
      return "#6b7280"
  }
}

function getSectionLabel(isoString: string): "Morning" | "Midday" | "Evening" {
  const hour = new Date(isoString).getHours()
  if (hour < 12) return "Morning"
  if (hour < 15) return "Midday"
  return "Evening"
}

function getTimeUntil(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now()
  if (diff <= 0) return "Now"
  const totalMins = Math.floor(diff / 60000)
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function getCutoffTime(startsAt: string, cutoffMinutes: number): string {
  const d = new Date(new Date(startsAt).getTime() - cutoffMinutes * 60000)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const period = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`
}

function isCancelFree(startsAt: string, cutoffMinutes: number): boolean {
  return Date.now() < new Date(startsAt).getTime() - cutoffMinutes * 60000
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function InstructorAvatar({ name, image, size = 40 }: { name: string; image?: string | null; size?: number }) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 text-xs font-semibold flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {getInitials(name)}
    </div>
  )
}

function AvailabilityBadge({ spotsRemaining, status }: { spotsRemaining: number; status: string }) {
  if (status === "CANCELLED") {
    return <span className="text-xs text-neutral-400">Cancelled</span>
  }
  if (spotsRemaining === 0) {
    return <span className="text-xs text-neutral-400 font-medium">Full</span>
  }
  if (spotsRemaining <= 2) {
    return <span className="text-xs text-red-600 font-semibold">{spotsRemaining} spot left!</span>
  }
  if (spotsRemaining <= 4) {
    return <span className="text-xs text-amber-600 font-medium">{spotsRemaining} spots left</span>
  }
  return <span className="text-xs text-neutral-500">{spotsRemaining} spots</span>
}

// ─── Booking Sheet ──────────────────────────────────────────────────────────

interface BookingSheetProps {
  session: ClassSession
  onClose: () => void
  onBooked: () => void
  creditBalance: number | null
}

function BookingSheet({ session, onClose, onBooked, creditBalance }: BookingSheetProps) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const { hour, period } = formatTime(session.startsAt)
  const duration = getDurationMinutes(session.startsAt, session.endsAt)
  const cutoffTime = getCutoffTime(session.startsAt, session.classTemplate.cancelCutoffMinutes)
  const noCredits = creditBalance !== null && creditBalance === 0
  const borderColor = classTypeColor(session.classTemplate.classType)

  const handleBook = useCallback(async () => {
    setState("loading")
    setErrorMsg("")
    try {
      const res = await fetch("/api/classes/book", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Booking failed")
      }
      setState("success")
      setTimeout(() => {
        onBooked()
        onClose()
      }, 2000)
    } catch (err) {
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong")
    }
  }, [session.id, onBooked, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-lg mx-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-neutral-300 rounded-full" />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div
                className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white mb-1"
                style={{ backgroundColor: borderColor }}
              >
                {session.classTemplate.classType}
              </div>
              <h2 className="text-xl font-bold text-neutral-900">{session.classTemplate.name}</h2>
              <p className="text-sm text-neutral-500 mt-0.5">
                {hour} {period} · {duration} min
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 -mt-1 -mr-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Instructor */}
          <div className="flex items-center gap-3 py-3 border-t border-b border-neutral-100 mb-4">
            <InstructorAvatar name={session.instructor.name} image={session.instructor.image} size={36} />
            <div>
              <p className="text-sm text-neutral-500">Instructor</p>
              <p className="text-sm font-medium text-neutral-900">{session.instructor.name}</p>
            </div>
            <div className="ml-auto text-right">
              <AvailabilityBadge spotsRemaining={session.spotsRemaining} status={session.status} />
            </div>
          </div>

          {/* Credit info */}
          <div className="flex items-center justify-between bg-neutral-50 rounded-lg px-4 py-3 mb-3">
            <span className="text-sm text-neutral-700">
              {session.classTemplate.creditsRequired} credit{session.classTemplate.creditsRequired !== 1 ? "s" : ""} will be deducted
            </span>
            <CreditBalance variant="inline" />
          </div>

          {/* Cancellation policy */}
          <p className="text-xs text-neutral-400 mb-5">
            Free cancellation until {cutoffTime} — cancellations after that are non-refundable.
          </p>

          {/* Success state */}
          {state === "success" && (
            <div className="flex flex-col items-center py-4 gap-2">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-neutral-900">You&apos;re booked!</p>
            </div>
          )}

          {/* Error state */}
          {state === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* No credits */}
          {noCredits && state !== "success" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-amber-800 font-medium">You need credits to book this class.</p>
              <Link href="/client-dashboard/credits" className="text-sm text-amber-700 underline mt-1 block">
                Buy credits →
              </Link>
            </div>
          )}

          {/* Action button */}
          {state !== "success" && (
            <button
              onClick={handleBook}
              disabled={state === "loading" || noCredits || session.spotsRemaining === 0}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-lg px-4 py-3 font-semibold text-base transition-colors"
            >
              {state === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Booking…
                </span>
              ) : session.spotsRemaining === 0 ? (
                "Class Full"
              ) : noCredits ? (
                "No Credits"
              ) : (
                "Book Class"
              )}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Cancel Confirm ─────────────────────────────────────────────────────────

interface CancelConfirmProps {
  booking: Booking
  onClose: () => void
  onCancelled: () => void
}

function CancelConfirm({ booking, onClose, onCancelled }: CancelConfirmProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const free = isCancelFree(booking.session.startsAt, booking.session.classTemplate.cancelCutoffMinutes)

  const handleCancel = useCallback(async () => {
    setState("loading")
    try {
      const res = await fetch(`/api/classes/book/${booking.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Cancellation failed")
      }
      onCancelled()
      onClose()
    } catch (err) {
      setState("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong")
    }
  }, [booking.id, onCancelled, onClose])

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-2">Cancel booking?</h3>
          <p className="text-sm text-neutral-600 mb-1">
            <span className="font-medium">{booking.session.classTemplate.name}</span>
          </p>
          {free ? (
            <p className="text-sm text-green-700 mb-5">
              1 credit will be refunded to your account.
            </p>
          ) : (
            <p className="text-sm text-amber-700 mb-5">
              The cancellation window has passed — your credit will not be refunded.
            </p>
          )}
          {state === "error" && (
            <p className="text-sm text-red-600 mb-3">{errorMsg}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg px-4 py-2.5 font-medium text-sm"
            >
              Keep booking
            </button>
            <button
              onClick={handleCancel}
              disabled={state === "loading"}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-neutral-200 text-white rounded-lg px-4 py-2.5 font-medium text-sm"
            >
              {state === "loading" ? "Cancelling…" : "Cancel class"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Class Card ─────────────────────────────────────────────────────────────

interface ClassCardProps {
  session: ClassSession
  isBooked: boolean
  onTap: () => void
}

function ClassCard({ session, isBooked, onTap }: ClassCardProps) {
  const { hour, period } = formatTime(session.startsAt)
  const duration = getDurationMinutes(session.startsAt, session.endsAt)
  const borderColor = classTypeColor(session.classTemplate.classType)
  const isDimmed = session.spotsRemaining === 0 && !isBooked
  const instructorShort = session.instructor.name.split(" ").map((n, i) => (i === 0 ? n : n[0] + ".")).join(" ")

  return (
    <button
      onClick={onTap}
      className={`w-full text-left bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3 transition-all active:scale-[0.98] ${isDimmed ? "opacity-60" : "hover:shadow-sm"}`}
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      {/* Time */}
      <div className="flex-shrink-0 w-14 text-center">
        <div className="text-lg font-bold text-neutral-900 leading-tight">{hour}</div>
        <div className="text-xs text-neutral-400 font-medium">{period}</div>
        <div className="text-xs text-neutral-400 mt-0.5">{duration} min</div>
      </div>

      {/* Class info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-neutral-900 text-sm">{session.classTemplate.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <InstructorAvatar name={session.instructor.name} image={session.instructor.image} size={20} />
          <span className="text-xs text-neutral-500">{instructorShort}</span>
        </div>
      </div>

      {/* Right: availability + action */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <AvailabilityBadge spotsRemaining={session.spotsRemaining} status={session.status} />
        {isBooked ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Booked</span>
        ) : session.spotsRemaining > 0 ? (
          <span className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-full font-medium">Book</span>
        ) : null}
      </div>
    </button>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ClientClassesPage() {
  const dates = getDateRange(14)
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(dates[0]))
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null)
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const dateStripRef = useRef<HTMLDivElement>(null)

  const fetchSessions = useCallback(async (date: string) => {
    setLoadingSessions(true)
    setError(null)
    try {
      const res = await fetch(`/api/classes/schedule?date=${date}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load schedule")
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule")
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const fetchBookings = useCallback(async () => {
    setLoadingBookings(true)
    try {
      const res = await fetch("/api/classes/bookings?status=BOOKED", { credentials: "include" })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBookings(data.bookings || [])
    } catch {
      // silently fail — bookings aren't critical for viewing the schedule
    } finally {
      setLoadingBookings(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions(selectedDate)
  }, [fetchSessions, selectedDate])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings, refreshKey])

  const handleBooked = useCallback(() => {
    setRefreshKey((k) => k + 1)
    fetchSessions(selectedDate)
  }, [fetchSessions, selectedDate])

  const handleCancelled = useCallback(() => {
    setRefreshKey((k) => k + 1)
    fetchSessions(selectedDate)
  }, [fetchSessions, selectedDate])

  // Bookings keyed by sessionId for quick lookup
  const bookedSessionIds = new Set(bookings.map((b) => b.session.id))
  const bookingBySessionId = Object.fromEntries(bookings.map((b) => [b.session.id, b]))

  // Today's upcoming booking (pinned card)
  const todayStr = formatDate(new Date())
  const todayBooking = bookings.find(
    (b) =>
      b.session.startsAt.startsWith(todayStr) &&
      b.status === "BOOKED" &&
      new Date(b.session.endsAt) > new Date()
  )

  // Group sessions into sections
  const sectionOrder: Array<"Morning" | "Midday" | "Evening"> = ["Morning", "Midday", "Evening"]
  const sectionedSessions: Record<string, ClassSession[]> = { Morning: [], Midday: [], Evening: [] }
  for (const s of sessions) {
    sectionedSessions[getSectionLabel(s.startsAt)].push(s)
  }

  // Dates with bookings (for dot indicator)
  const bookedDates = new Set(bookings.map((b) => b.session.startsAt.slice(0, 10)))

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Page header */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-neutral-900">Classes</h1>
        <CreditBalance
          variant="pill"
          onBalanceLoaded={(b) => setCreditBalance(b)}
          refreshKey={refreshKey}
        />
      </div>

      {/* Date strip */}
      <div
        ref={dateStripRef}
        className="flex gap-2 px-4 py-3 overflow-x-auto snap-x snap-mandatory scrollbar-none bg-white border-b border-neutral-100"
        style={{ scrollbarWidth: "none" }}
      >
        {dates.map((date) => {
          const dateStr = formatDate(date)
          const isToday = dateStr === formatDate(new Date())
          const isSelected = dateStr === selectedDate
          const hasBooking = bookedDates.has(dateStr)
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex-shrink-0 snap-start flex flex-col items-center px-3 py-2 rounded-xl min-w-[52px] transition-all ${
                isSelected
                  ? "bg-green-600 text-white shadow-sm"
                  : isToday
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide">
                {DAY_ABBR[date.getDay()]}
              </span>
              <span className="text-base font-bold leading-tight">{date.getDate()}</span>
              {hasBooking && (
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? "bg-white" : "bg-green-500"}`}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Today's pinned booking */}
      {todayBooking && selectedDate === todayStr && (
        <div className="px-4 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-900">{todayBooking.session.classTemplate.name}</p>
              <p className="text-xs text-green-700">
                {formatTime(todayBooking.session.startsAt).hour} {formatTime(todayBooking.session.startsAt).period} ·{" "}
                {todayBooking.session.instructor.name} · Starts in {getTimeUntil(todayBooking.session.startsAt)}
              </p>
            </div>
            <button
              onClick={() => setCancelBooking(todayBooking)}
              className="text-xs text-red-600 hover:text-red-700 font-medium flex-shrink-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule */}
      <div className="px-4 pb-24 pt-4 space-y-6">
        {loadingSessions ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white rounded-xl border border-neutral-200 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-700 mb-2">{error}</p>
            <button
              onClick={() => fetchSessions(selectedDate)}
              className="text-xs text-red-600 underline"
            >
              Try again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-neutral-500 font-medium">No classes on this day</p>
            <p className="text-neutral-400 text-sm mt-1">Try another date</p>
          </div>
        ) : (
          sectionOrder.map((section) => {
            const items = sectionedSessions[section]
            if (items.length === 0) return null
            return (
              <div key={section}>
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 px-1">
                  {section}
                </h3>
                <div className="space-y-2">
                  {items.map((session) => (
                    <ClassCard
                      key={session.id}
                      session={session}
                      isBooked={bookedSessionIds.has(session.id)}
                      onTap={() => {
                        if (bookedSessionIds.has(session.id)) {
                          setCancelBooking(bookingBySessionId[session.id])
                        } else {
                          setSelectedSession(session)
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}

        {/* Link to bookings history */}
        <div className="text-center">
          <Link
            href="/client-dashboard/classes/bookings"
            className="text-sm text-neutral-500 hover:text-neutral-700 underline"
          >
            View all my bookings →
          </Link>
        </div>
      </div>

      {/* Booking sheet */}
      {selectedSession && (
        <BookingSheet
          session={selectedSession}
          creditBalance={creditBalance}
          onClose={() => setSelectedSession(null)}
          onBooked={handleBooked}
        />
      )}

      {/* Cancel confirm */}
      {cancelBooking && (
        <CancelConfirm
          booking={cancelBooking}
          onClose={() => setCancelBooking(null)}
          onCancelled={handleCancelled}
        />
      )}
    </div>
  )
}
