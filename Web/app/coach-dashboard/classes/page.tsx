"use client"

import { useState, useEffect, useCallback } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClassTemplate {
  id: string
  name: string
  classType: string
  description?: string | null
  capacity: number
  creditsRequired: number
  isActive: boolean
  locationLabel?: string | null
  ownerCoachId?: string | null
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(referenceDate: Date): Date[] {
  const start = new Date(referenceDate)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday-start
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function formatTimeDisplay(isoString: string): string {
  const d = new Date(isoString)
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const period = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`
}

function getDurationMinutes(startsAt: string, endsAt: string): number {
  return Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)
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

function classTypeBg(classType: string): string {
  switch (classType.toUpperCase()) {
    case "HIIT":
      return "bg-[#452ddb]/10 text-[#452ddb]"
    case "CORE":
      return "bg-yellow-100 text-yellow-800"
    default:
      return "bg-neutral-100 text-neutral-700"
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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function formatWeekRange(dates: Date[]): string {
  if (dates.length === 0) return ""
  const first = dates[0]
  const last = dates[dates.length - 1]
  return `${first.getDate()} ${first.toLocaleString("en-GB", { month: "short" })} – ${last.getDate()} ${last.toLocaleString("en-GB", { month: "short", year: "numeric" })}`
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    SCHEDULED: { label: "Scheduled", className: "bg-green-100 text-green-700" },
    CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700" },
    COMPLETED: { label: "Completed", className: "bg-blue-100 text-blue-700" },
    IN_PROGRESS: { label: "In Progress", className: "bg-amber-100 text-amber-700" },
  }
  const { label, className } = config[status] ?? { label: status, className: "bg-neutral-100 text-neutral-600" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: ClassSession
  onEdit: (session: ClassSession) => void
}

function SessionCard({ session, onEdit }: SessionCardProps) {
  const borderColor = classTypeColor(session.classTemplate.classType)
  const capacity = session.capacityOverride ?? session.classTemplate.capacity
  const duration = getDurationMinutes(session.startsAt, session.endsAt)

  return (
    <button
      onClick={() => onEdit(session)}
      className="w-full text-left bg-white rounded-xl border border-neutral-200 p-3 hover:shadow-sm transition-all active:scale-[0.99]"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${classTypeBg(session.classTemplate.classType)} mb-1`}>
            {session.classTemplate.classType}
          </span>
          <p className="text-sm font-semibold text-neutral-900">{session.classTemplate.name}</p>
        </div>
        <SessionStatusBadge status={session.status} />
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{formatTimeDisplay(session.startsAt)} · {duration} min</span>
        <span className="font-medium text-neutral-700">
          {session._count.bookings}/{capacity}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] font-semibold text-neutral-600 flex-shrink-0">
          {getInitials(session.instructor.name)}
        </div>
        <span className="text-xs text-neutral-500">{session.instructor.name}</span>
      </div>
    </button>
  )
}

// ─── Create Session Form ──────────────────────────────────────────────────────

interface CreateSessionFormProps {
  templates: ClassTemplate[]
  onClose: () => void
  onCreated: () => void
}

function CreateSessionForm({ templates, onClose, onCreated }: CreateSessionFormProps) {
  const [templateId, setTemplateId] = useState("")
  const [date, setDate] = useState(() => formatDate(new Date()))
  const [time, setTime] = useState("06:30")
  const [durationMinutes, setDurationMinutes] = useState(25)
  const [state, setState] = useState<"idle" | "loading" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!templateId) {
        setErrorMsg("Please select a class template")
        setState("error")
        return
      }
      setState("loading")
      setErrorMsg("")
      try {
        const startsAt = new Date(`${date}T${time}:00`).toISOString()
        const res = await fetch("/api/classes/sessions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, startsAt, durationMinutes }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to create session")
        }
        onCreated()
        onClose()
      } catch (err) {
        setState("error")
        setErrorMsg(err instanceof Error ? err.message : "Failed to create session")
      }
    },
    [templateId, date, time, durationMinutes, onCreated, onClose]
  )

  const activeTemplates = templates.filter((t) => t.isActive)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-neutral-900">Create Session</h2>
            <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Template */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Class Template
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                <option value="">Select a template…</option>
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.classType}) — {t.creditsRequired} credit{t.creditsRequired !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Start Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                min={5}
                max={180}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            {state === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg px-4 py-2.5 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={state === "loading"}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-neutral-200 text-white rounded-lg px-4 py-2.5 font-medium text-sm"
              >
                {state === "loading" ? "Creating…" : "Create Session"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Edit Session Panel ───────────────────────────────────────────────────────

interface EditSessionPanelProps {
  session: ClassSession
  onClose: () => void
  onUpdated: () => void
}

function EditSessionPanel({ session, onClose, onUpdated }: EditSessionPanelProps) {
  const [status, setStatus] = useState(session.status)
  const [cancelReason, setCancelReason] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const capacity = session.capacityOverride ?? session.classTemplate.capacity

  const handleUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setState("loading")
      setErrorMsg("")
      try {
        const body: Record<string, unknown> = { status }
        if (status === "CANCELLED" && cancelReason) {
          body.cancelReason = cancelReason
        }
        const res = await fetch(`/api/classes/sessions/${session.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Update failed")
        }
        onUpdated()
        onClose()
      } catch (err) {
        setState("error")
        setErrorMsg(err instanceof Error ? err.message : "Update failed")
      }
    },
    [session.id, status, cancelReason, onUpdated, onClose]
  )

  const borderColor = classTypeColor(session.classTemplate.classType)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-lg mx-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-neutral-300 rounded-full" />
        </div>
        <div className="px-5 pb-8 pt-2">
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
                {formatTimeDisplay(session.startsAt)} · {getDurationMinutes(session.startsAt, session.endsAt)} min
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-600 -mt-1 -mr-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-neutral-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-neutral-900">{session._count.bookings}</p>
              <p className="text-xs text-neutral-500 mt-0.5">Booked</p>
            </div>
            <div className="bg-neutral-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-neutral-900">{session.spotsRemaining}</p>
              <p className="text-xs text-neutral-500 mt-0.5">Available</p>
            </div>
            <div className="bg-neutral-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-neutral-900">{capacity}</p>
              <p className="text-xs text-neutral-500 mt-0.5">Capacity</p>
            </div>
          </div>

          {/* Edit form */}
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {status === "CANCELLED" && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Cancellation reason (optional)
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Instructor unavailable"
                  className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            )}

            {state === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-700">{errorMsg}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg px-4 py-2.5 font-medium text-sm"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={state === "loading"}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-neutral-200 text-white rounded-lg px-4 py-2.5 font-medium text-sm"
              >
                {state === "loading" ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachClassesPage() {
  const [weekDates, setWeekDates] = useState<Date[]>(() => getWeekDates(new Date()))
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [templates, setTemplates] = useState<ClassTemplate[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editSession, setEditSession] = useState<ClassSession | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const res = await fetch("/api/classes/templates", { credentials: "include" })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      // non-critical
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  const fetchWeekSessions = useCallback(async (dates: Date[]) => {
    setLoadingSessions(true)
    setError(null)
    try {
      // Fetch all 7 days in parallel
      const responses = await Promise.all(
        dates.map((d) =>
          fetch(`/api/classes/schedule?date=${formatDate(d)}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : { sessions: [] }))
            .catch(() => ({ sessions: [] }))
        )
      )
      const all: ClassSession[] = responses.flatMap((r) => r.sessions || [])
      // Sort by start time
      all.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      setSessions(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule")
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    fetchWeekSessions(weekDates)
  }, [fetchWeekSessions, weekDates, refreshKey])

  const handlePrevWeek = useCallback(() => {
    setWeekDates((prev) => {
      const newRef = new Date(prev[0])
      newRef.setDate(newRef.getDate() - 7)
      return getWeekDates(newRef)
    })
  }, [])

  const handleNextWeek = useCallback(() => {
    setWeekDates((prev) => {
      const newRef = new Date(prev[0])
      newRef.setDate(newRef.getDate() + 7)
      return getWeekDates(newRef)
    })
  }, [])

  const handleCreated = useCallback(() => setRefreshKey((k) => k + 1), [])
  const handleUpdated = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Group sessions by day index (0-6, Mon-Sun)
  const sessionsByDay: ClassSession[][] = weekDates.map((d) => {
    const dateStr = formatDate(d)
    return sessions.filter((s) => s.startsAt.startsWith(dateStr))
  })

  const totalSessions = sessions.length
  const totalBookings = sessions.reduce((sum, s) => sum + s._count.bookings, 0)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Classes</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Manage your weekly class schedule</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2.5 font-medium text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Session
        </button>
      </div>

      {/* Week navigation */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevWeek}
            className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-neutral-900">{formatWeekRange(weekDates)}</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {totalSessions} session{totalSessions !== 1 ? "s" : ""} · {totalBookings} booking{totalBookings !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={handleNextWeek}
            className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Class type legend */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#452ddb" }} />
            <span className="text-xs text-neutral-500">HIIT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#f2de24" }} />
            <span className="text-xs text-neutral-500">CORE</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Week grid */}
        {loadingSessions ? (
          <div className="grid grid-cols-7 gap-2">
            {DAY_LABELS.map((label) => (
              <div key={label} className="space-y-2">
                <div className="text-[10px] font-semibold text-neutral-400 uppercase text-center">{label}</div>
                <div className="h-16 bg-neutral-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, i) => {
              const isToday = formatDate(date) === formatDate(new Date())
              const daySessions = sessionsByDay[i]
              return (
                <div key={formatDate(date)} className="space-y-1.5">
                  {/* Day header */}
                  <div className={`text-center pb-1 ${isToday ? "" : ""}`}>
                    <div className="text-[10px] font-semibold text-neutral-400 uppercase">
                      {DAY_LABELS[i]}
                    </div>
                    <div
                      className={`text-sm font-bold mx-auto w-7 h-7 rounded-full flex items-center justify-center ${
                        isToday
                          ? "bg-green-600 text-white"
                          : "text-neutral-700"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>

                  {/* Sessions */}
                  <div className="space-y-1">
                    {daySessions.length === 0 ? (
                      <div className="h-12 border-2 border-dashed border-neutral-100 rounded-lg" />
                    ) : (
                      daySessions.map((session) => (
                        <button
                          key={session.id}
                          onClick={() => setEditSession(session)}
                          className="w-full rounded-lg p-1.5 text-left hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: `${classTypeColor(session.classTemplate.classType)}15`, borderLeft: `2px solid ${classTypeColor(session.classTemplate.classType)}` }}
                        >
                          <p className="text-[10px] font-bold leading-tight" style={{ color: classTypeColor(session.classTemplate.classType) }}>
                            {session.classTemplate.classType}
                          </p>
                          <p className="text-[10px] text-neutral-600 leading-tight">
                            {formatTimeDisplay(session.startsAt)}
                          </p>
                          <p className="text-[10px] text-neutral-400">
                            {session._count.bookings}/{session.capacityOverride ?? session.classTemplate.capacity}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Session list */}
      <div className="bg-white rounded-xl border border-neutral-200">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">This Week&apos;s Sessions</h2>
        </div>
        {loadingSessions ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-neutral-500 font-medium">No sessions this week</p>
            <p className="text-xs text-neutral-400 mt-1 mb-4">Create a session to get started</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Session
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} onEdit={setEditSession} />
            ))}
          </div>
        )}
      </div>

      {/* Templates summary */}
      {!loadingTemplates && templates.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-900">Class Templates</h2>
          </div>
          <div className="p-4 space-y-2">
            {templates
              .filter((t) => t.isActive)
              .map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-neutral-100"
                  style={{ borderLeftWidth: 3, borderLeftColor: classTypeColor(template.classType) }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{template.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {template.classType} · {template.capacity} capacity · {template.creditsRequired} credit{template.creditsRequired !== 1 ? "s" : ""}
                      {template.locationLabel && ` · ${template.locationLabel}`}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${classTypeBg(template.classType)}`}
                  >
                    {template.classType}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Create form modal */}
      {showCreateForm && (
        <CreateSessionForm
          templates={templates}
          onClose={() => setShowCreateForm(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Edit session panel */}
      {editSession && (
        <EditSessionPanel
          session={editSession}
          onClose={() => setEditSession(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
