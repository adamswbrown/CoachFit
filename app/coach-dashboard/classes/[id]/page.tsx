"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"

type ClassTemplateDetail = {
  id: string
  name: string
  classType: string
  description?: string | null
  locationLabel: string
  roomLabel?: string | null
  capacity: number
  waitlistEnabled: boolean
  waitlistCapacity: number
  bookingOpenHoursBefore: number
  bookingCloseMinutesBefore: number
  cancelCutoffMinutes: number
  creditsRequired: number
  ownerCoach?: { id: string; name: string | null; email: string }
}

type ClassSessionDetail = {
  id: string
  startsAt: string
  endsAt: string
  status: string
  instructor?: { id: string; name: string | null; email: string } | null
  _count?: { bookings: number }
}

type BookingRow = {
  id: string
  status: string
  waitlistPosition: number | null
  client: { id: string; name: string | null; email: string }
}

type ClientOption = {
  id: string
  label: string
}

const weekdayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
]

export default function CoachClassTemplateDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const templateId = params?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [template, setTemplate] = useState<ClassTemplateDetail | null>(null)
  const [sessions, setSessions] = useState<ClassSessionDetail[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])

  const [bookingClientId, setBookingClientId] = useState("")
  const [manualClientId, setManualClientId] = useState("")
  const [bookingBusy, setBookingBusy] = useState(false)

  const [generateBusy, setGenerateBusy] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    weekdays: [1, 3, 5],
    startTime: "06:30",
    durationMinutes: 25,
    instructorId: "",
    capacityOverride: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return

    if (!isAdminOrCoach(session.user)) {
      if (session.user.roles.includes(Role.CLIENT)) {
        router.push("/client-dashboard")
      } else {
        router.push("/login")
      }
      return
    }

    if (!templateId) return
    void loadTemplateData(templateId)
    void loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, templateId])

  const loadTemplateData = async (id: string) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/classes/${id}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load class template")
      }

      const data = await res.json()
      setTemplate(data.template)
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load class template")
    } finally {
      setLoading(false)
    }
  }

  const loadClients = async () => {
    try {
      const res = await fetch("/api/coach-dashboard/overview")
      if (!res.ok) return
      const data = await res.json()
      const options = (data?.clients || [])
        .filter((client: any) => Boolean(client?.id))
        .map((client: any) => ({
          id: client.id,
          label: `${client.name || client.email} (${client.email})`,
        }))
      setClients(options)
    } catch {
      // keep empty options
    }
  }

  const loadBookings = async (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setBookings([])
    try {
      const res = await fetch(`/api/classes/sessions/${sessionId}/bookings`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load bookings")
      }
      const data = await res.json()
      setBookings(data.bookings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings")
    }
  }

  const selectedSession = useMemo(
    () => sessions.find((sessionRow) => sessionRow.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  )

  const handleToggleWeekday = (day: number) => {
    setGenerateForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((item) => item !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b),
    }))
  }

  const handleGenerateSessions = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateId) return

    setGenerateBusy(true)
    setError(null)

    try {
      const payload: any = {
        startDate: generateForm.startDate,
        endDate: generateForm.endDate,
        weekdays: generateForm.weekdays,
        startTime: generateForm.startTime,
        durationMinutes: Number(generateForm.durationMinutes),
      }

      if (generateForm.instructorId) {
        payload.instructorId = generateForm.instructorId
      }

      if (generateForm.capacityOverride) {
        payload.capacityOverride = Number(generateForm.capacityOverride)
      }

      const res = await fetch(`/api/classes/${templateId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to generate sessions")
      }

      await loadTemplateData(templateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate sessions")
    } finally {
      setGenerateBusy(false)
    }
  }

  const handleCoachBookClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSessionId) return

    const clientId = bookingClientId || manualClientId
    if (!clientId) {
      setError("Select a client or enter a client ID")
      return
    }

    setBookingBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/classes/sessions/${selectedSessionId}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create booking")
      }

      await loadBookings(selectedSessionId)
      if (templateId) {
        await loadTemplateData(templateId)
      }
      setBookingClientId("")
      setManualClientId("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create booking")
    } finally {
      setBookingBusy(false)
    }
  }

  const handleBookingStatusUpdate = async (bookingId: string, nextStatus: string) => {
    if (!selectedSessionId) return

    setError(null)
    try {
      const res = await fetch(`/api/classes/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body:
          nextStatus === "CANCEL"
            ? JSON.stringify({ action: "CANCEL" })
            : JSON.stringify({ status: nextStatus }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update booking")
      }

      await loadBookings(selectedSessionId)
      if (templateId) {
        await loadTemplateData(templateId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update booking")
    }
  }

  if (loading) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto py-8">Loading class template...</div>
      </CoachLayout>
    )
  }

  if (!session?.user || !isAdminOrCoach(session.user) || !template) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href="/coach-dashboard/classes" className="text-sm text-neutral-600 hover:underline">
              Back to classes
            </Link>
            <h1 className="text-2xl font-semibold text-neutral-900 mt-1">{template.name}</h1>
            <p className="text-sm text-neutral-600 mt-1">
              {template.classType} • {template.locationLabel} • Capacity {template.capacity}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        )}

        <section className="bg-white border border-neutral-200 rounded-lg p-4">
          <h2 className="font-semibold text-neutral-900 mb-3">Generate Sessions</h2>
          <form onSubmit={handleGenerateSessions} className="grid gap-3">
            <div className="grid md:grid-cols-4 gap-3">
              <input
                type="date"
                value={generateForm.startDate}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-neutral-300 rounded-md"
                required
              />
              <input
                type="date"
                value={generateForm.endDate}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-neutral-300 rounded-md"
                required
              />
              <input
                type="time"
                value={generateForm.startTime}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, startTime: e.target.value }))}
                className="px-3 py-2 border border-neutral-300 rounded-md"
                required
              />
              <input
                type="number"
                min={5}
                max={240}
                value={generateForm.durationMinutes}
                onChange={(e) =>
                  setGenerateForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value) || 25 }))
                }
                className="px-3 py-2 border border-neutral-300 rounded-md"
                placeholder="Duration"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {weekdayOptions.map((option) => {
                const active = generateForm.weekdays.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleToggleWeekday(option.value)}
                    className={`px-3 py-1.5 text-xs rounded-full border ${
                      active
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-white text-neutral-700 border-neutral-300"
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <input
                value={generateForm.instructorId}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, instructorId: e.target.value }))}
                className="px-3 py-2 border border-neutral-300 rounded-md"
                placeholder="Instructor user ID (optional)"
              />
              <input
                value={generateForm.capacityOverride}
                onChange={(e) => setGenerateForm((prev) => ({ ...prev, capacityOverride: e.target.value }))}
                className="px-3 py-2 border border-neutral-300 rounded-md"
                placeholder="Capacity override (optional)"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={generateBusy || generateForm.weekdays.length === 0}
                className="px-4 py-2 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {generateBusy ? "Generating..." : "Generate Sessions"}
              </button>
            </div>
          </form>
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200">
              <h2 className="font-semibold text-neutral-900">Sessions</h2>
            </div>
            {sessions.length === 0 ? (
              <div className="p-4 text-sm text-neutral-600">No sessions yet.</div>
            ) : (
              <div className="max-h-[560px] overflow-y-auto">
                {sessions.map((sessionRow) => {
                  const active = selectedSessionId === sessionRow.id
                  return (
                    <button
                      key={sessionRow.id}
                      onClick={() => loadBookings(sessionRow.id)}
                      className={`w-full text-left px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 ${
                        active ? "bg-neutral-100" : ""
                      }`}
                    >
                      <div className="text-sm font-medium text-neutral-900">
                        {new Date(sessionRow.startsAt).toLocaleString("en-GB", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </div>
                      <div className="text-xs text-neutral-600 mt-1">
                        {sessionRow.status} • {sessionRow._count?.bookings ?? 0} bookings
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between gap-2">
              <h2 className="font-semibold text-neutral-900">Session Bookings</h2>
              {selectedSession && (
                <span className="text-xs text-neutral-600">
                  {new Date(selectedSession.startsAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
              )}
            </div>

            {!selectedSessionId ? (
              <div className="p-4 text-sm text-neutral-600">Select a session to view bookings.</div>
            ) : (
              <div className="p-4 space-y-4">
                <form onSubmit={handleCoachBookClient} className="grid gap-2">
                  <label className="text-xs font-medium text-neutral-700">Add booking</label>
                  <select
                    value={bookingClientId}
                    onChange={(e) => setBookingClientId(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 rounded-md text-sm"
                  >
                    <option value="">Select existing client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={manualClientId}
                    onChange={(e) => setManualClientId(e.target.value)}
                    placeholder="Or paste client UUID"
                    className="px-3 py-2 border border-neutral-300 rounded-md text-sm"
                  />
                  <button
                    type="submit"
                    disabled={bookingBusy}
                    className="px-3 py-2 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {bookingBusy ? "Booking..." : "Book Client"}
                  </button>
                </form>

                {bookings.length === 0 ? (
                  <div className="text-sm text-neutral-600">No bookings for this session.</div>
                ) : (
                  <div className="space-y-2">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="border border-neutral-200 rounded-md p-3">
                        <div className="text-sm font-medium text-neutral-900">
                          {booking.client.name || booking.client.email}
                        </div>
                        <div className="text-xs text-neutral-600 mt-1">
                          {booking.client.email} • {booking.status}
                          {booking.waitlistPosition ? ` • WL #${booking.waitlistPosition}` : ""}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button
                            onClick={() => handleBookingStatusUpdate(booking.id, "ATTENDED")}
                            className="px-2 py-1 text-xs rounded border border-neutral-300 hover:bg-neutral-50"
                          >
                            Mark attended
                          </button>
                          <button
                            onClick={() => handleBookingStatusUpdate(booking.id, "NO_SHOW")}
                            className="px-2 py-1 text-xs rounded border border-neutral-300 hover:bg-neutral-50"
                          >
                            Mark no-show
                          </button>
                          <button
                            onClick={() => handleBookingStatusUpdate(booking.id, "CANCEL")}
                            className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </CoachLayout>
  )
}
