"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

// ─── Types ──────────────────────────────────────────────────────────────────

type BookingStatus = "BOOKED" | "CANCELLED" | "ATTENDED" | "NO_SHOW" | "LATE_CANCEL"

interface Booking {
  id: string
  status: BookingStatus
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateDisplay(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatTimeDisplay(isoString: string): string {
  const d = new Date(isoString)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const period = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`
}

function isCancelFree(startsAt: string, cutoffMinutes: number): boolean {
  return Date.now() < new Date(startsAt).getTime() - cutoffMinutes * 60000
}

function getCutoffTime(startsAt: string, cutoffMinutes: number): string {
  const d = new Date(new Date(startsAt).getTime() - cutoffMinutes * 60000)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const period = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BookingStatus }) {
  const config: Record<BookingStatus, { label: string; className: string }> = {
    BOOKED: { label: "Booked", className: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700" },
    ATTENDED: { label: "Attended", className: "bg-blue-100 text-blue-700" },
    NO_SHOW: { label: "No Show", className: "bg-red-100 text-red-700" },
    LATE_CANCEL: { label: "Late Cancel", className: "bg-amber-100 text-amber-700" },
  }
  const { label, className } = config[status] ?? { label: status, className: "bg-neutral-100 text-neutral-600" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─── Instructor Avatar ────────────────────────────────────────────────────────

function InstructorAvatar({ name, image }: { name: string; image?: string | null }) {
  if (image) {
    return <img src={image} alt={name} className="w-8 h-8 rounded-full object-cover" />
  }
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 text-xs font-semibold flex-shrink-0">
      {getInitials(name)}
    </div>
  )
}

// ─── Cancel Confirm ───────────────────────────────────────────────────────────

interface CancelConfirmProps {
  booking: Booking
  onClose: () => void
  onCancelled: () => void
}

function CancelConfirm({ booking, onClose, onCancelled }: CancelConfirmProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const free = isCancelFree(booking.session.startsAt, booking.session.classTemplate.cancelCutoffMinutes)
  const cutoffTime = getCutoffTime(booking.session.startsAt, booking.session.classTemplate.cancelCutoffMinutes)

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
          <h3 className="text-lg font-bold text-neutral-900 mb-1">Cancel booking?</h3>
          <p className="text-sm font-medium text-neutral-700 mb-1">
            {booking.session.classTemplate.name}
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            {formatDateDisplay(booking.session.startsAt)} at {formatTimeDisplay(booking.session.startsAt)}
          </p>

          {free ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-green-800 font-medium">Free cancellation</p>
              <p className="text-xs text-green-700 mt-0.5">
                1 credit will be refunded. Cutoff: {cutoffTime}
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-amber-800 font-medium">Late cancellation</p>
              <p className="text-xs text-amber-700 mt-0.5">
                The cutoff was {cutoffTime} — your credit will not be refunded.
              </p>
            </div>
          )}

          {state === "error" && (
            <p className="text-sm text-red-600 mb-3">{errorMsg}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg px-4 py-2.5 font-medium text-sm"
            >
              Keep it
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

// ─── Booking Card ─────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: Booking
  onCancelClick?: () => void
}

function BookingCard({ booking, onCancelClick }: BookingCardProps) {
  const borderColor = classTypeColor(booking.session.classTemplate.classType)
  const isUpcoming = booking.status === "BOOKED" && new Date(booking.session.startsAt) > new Date()
  const canCancel = isUpcoming && onCancelClick

  return (
    <div
      className="bg-white rounded-xl border border-neutral-200 p-4"
      style={{ borderLeftWidth: 4, borderLeftColor: borderColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-neutral-900 text-sm">
              {booking.session.classTemplate.name}
            </span>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-xs text-neutral-500 mb-2">
            {formatDateDisplay(booking.session.startsAt)} · {formatTimeDisplay(booking.session.startsAt)}
          </p>
          <div className="flex items-center gap-2">
            <InstructorAvatar
              name={booking.session.instructor.name}
              image={booking.session.instructor.image}
            />
            <span className="text-xs text-neutral-500">{booking.session.instructor.name}</span>
          </div>
        </div>

        {canCancel && (
          <button
            onClick={onCancelClick}
            className="text-xs text-red-600 hover:text-red-700 font-medium flex-shrink-0 mt-0.5"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/classes/bookings", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load bookings")
      const data = await res.json()
      setBookings(data.bookings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const handleCancelled = useCallback(() => {
    fetchBookings()
  }, [fetchBookings])

  const now = new Date()
  const upcoming = bookings.filter(
    (b) => b.status === "BOOKED" && new Date(b.session.startsAt) > now
  )
  const past = bookings.filter(
    (b) => b.status !== "BOOKED" || new Date(b.session.startsAt) <= now
  )

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3">
        <Link href="/client-dashboard/classes" className="text-neutral-400 hover:text-neutral-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-neutral-900">My Bookings</h1>
      </div>

      <div className="px-4 pb-24 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white rounded-xl border border-neutral-200 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-700 mb-2">{error}</p>
            <button onClick={fetchBookings} className="text-xs text-red-600 underline">
              Try again
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-neutral-500 font-medium">No bookings yet</p>
            <p className="text-neutral-400 text-sm mt-1 mb-4">Book a class to see it here</p>
            <Link
              href="/client-dashboard/classes"
              className="inline-block bg-green-600 hover:bg-green-700 text-white rounded-lg px-5 py-2.5 font-medium text-sm"
            >
              Browse classes
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-700 mb-3">
                  Upcoming
                  <span className="ml-2 text-xs font-normal text-neutral-400">({upcoming.length})</span>
                </h2>
                <div className="space-y-2">
                  {upcoming.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onCancelClick={() => setCancelBooking(booking)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-700 mb-3">
                  Past
                  <span className="ml-2 text-xs font-normal text-neutral-400">({past.length})</span>
                </h2>
                <div className="space-y-2">
                  {past.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </section>
            )}

            {upcoming.length === 0 && past.length > 0 && (
              <div className="text-center pt-2">
                <Link
                  href="/client-dashboard/classes"
                  className="inline-block bg-green-600 hover:bg-green-700 text-white rounded-lg px-5 py-2.5 font-medium text-sm"
                >
                  Book another class
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

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
