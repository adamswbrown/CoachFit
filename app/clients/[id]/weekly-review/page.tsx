"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"

interface WeeklyEntry {
  date: string
  weightLbs: number | null
  steps: number | null
  calories: number | null
  sleepQuality: number | null
  perceivedEffort: number | null
  bmi: number | null
  hasEntry: boolean
}

interface WeeklySummary {
  weekStart: string
  weekEnd: string
  entries: WeeklyEntry[]
  summary: {
    checkInCount: number
    checkInRate: number
    avgWeight: number | null
    weightTrend: number | null
    avgSteps: number | null
    avgCalories: number | null
    avgBMI: number | null
    adherenceScore: number
  }
  previousWeek: {
    weekStart: string
    weekEnd: string
    checkInCount: number
    checkInRate: number
    avgWeight: number | null
    avgSteps: number | null
  } | null
}

interface CoachNote {
  id: string
  weekStart: string
  noteDate: string
  note: string
  createdAt: string
  updatedAt: string
}

interface Client {
  id: string
  name: string | null
  email: string
}

/**
 * Get Monday of a given date (start of week)
 */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

/**
 * Get date label for display
 */
function getDateLabel(date: string, index: number): string {
  const entryDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const entryDateNormalized = new Date(entryDate)
  entryDateNormalized.setHours(0, 0, 0, 0)

  if (entryDateNormalized.getTime() === today.getTime()) {
    return "Today"
  }

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return days[index]
}

export default function WeeklyReviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null)
  const [coachNote, setCoachNote] = useState<CoachNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(
    formatDate(getMonday(new Date()))
  )
  const [noteText, setNoteText] = useState("")
  const [noteDate, setNoteDate] = useState(formatDate(new Date()))
  const [savingNote, setSavingNote] = useState(false)
  const [allNotes, setAllNotes] = useState<CoachNote[]>([])
  const [showAllNotes, setShowAllNotes] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [loomUrl, setLoomUrl] = useState("")
  const [weeklyNote, setWeeklyNote] = useState("")
  const [savingWeeklyResponse, setSavingWeeklyResponse] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
      // Only redirect clients who aren't coaches or admins
      if (session.user.roles.includes(Role.CLIENT)) {
        router.push("/client-dashboard")
      } else {
        router.push("/login")
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (session && clientId) {
      const loadData = async () => {
        setLoading(true)
        try {
          await Promise.all([
            fetchClient(),
            fetchWeeklySummary(),
            fetchCoachNote(),
          ])
          // Fetch weekly response separately - don't block page load if it fails
          fetchWeeklyResponse().catch((err) =>
            console.error("Failed to fetch weekly response:", err)
          )
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }
  }, [session, clientId, selectedWeekStart])

  const fetchClient = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}`)
      if (res.ok) {
        const data = await res.json()
        setClient(data)
      }
    } catch (err) {
      console.error("Error fetching client:", err)
    }
  }

  const fetchWeeklySummary = async () => {
    try {
      const res = await fetch(
        `/api/clients/${clientId}/weekly-summary?weekStart=${selectedWeekStart}`
      )
      if (res.ok) {
        const data = await res.json()
        setWeeklySummary(data)
      }
    } catch (err) {
      console.error("Error fetching weekly summary:", err)
    }
  }

  const fetchCoachNote = async () => {
    try {
      const res = await fetch(
        `/api/clients/${clientId}/coach-notes?weekStart=${selectedWeekStart}`
      )
      if (res.ok) {
        const data = await res.json()
        setCoachNote(data)
        setNoteText(data?.note || "")
        if (data?.noteDate) {
          setNoteDate(data.noteDate)
        }
      }
    } catch (err) {
      console.error("Error fetching coach note:", err)
    }
  }

  const fetchAllNotes = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/coach-notes`)
      if (res.ok) {
        const data = await res.json()
        setAllNotes(data || [])
      }
    } catch (err) {
      console.error("Error fetching all notes:", err)
    }
  }

  const fetchWeeklyResponse = async () => {
    try {
      const res = await fetch(
        `/api/coach-dashboard/weekly-response?clientId=${clientId}&weekStart=${selectedWeekStart}`
      )
      if (res.ok) {
        const data = await res.json()
        setLoomUrl(data?.loomUrl || "")
        setWeeklyNote(data?.note || "")
      }
    } catch (err) {
      console.error("Error fetching weekly response:", err)
    }
  }

  const handleSaveWeeklyResponse = async () => {
    setSavingWeeklyResponse(true)
    try {
      const res = await fetch(`/api/coach-dashboard/weekly-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          weekStart: selectedWeekStart,
          loomUrl: loomUrl || null,
          note: weeklyNote || null,
        }),
      })

      if (res.ok) {
        // Success feedback handled by UI state
      }
    } catch (err) {
      console.error("Error saving weekly response:", err)
    } finally {
      setSavingWeeklyResponse(false)
    }
  }

  useEffect(() => {
    if (session && clientId && showAllNotes) {
      fetchAllNotes()
    }
  }, [session, clientId, showAllNotes])

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      return
    }

    setSavingNote(true)
    try {
      const res = await fetch(`/api/clients/${clientId}/coach-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weekStart: selectedWeekStart,
          noteDate: noteDate,
          note: noteText,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setCoachNote(data)
        if (showAllNotes) {
          fetchAllNotes()
        }
      }
    } catch (err) {
      console.error("Error saving coach note:", err)
    } finally {
      setSavingNote(false)
    }
  }

  const handleWeekChange = (direction: "prev" | "next") => {
    const currentDate = new Date(selectedWeekStart)
    if (direction === "prev") {
      currentDate.setDate(currentDate.getDate() - 7)
    } else {
      currentDate.setDate(currentDate.getDate() + 7)
    }
    setSelectedWeekStart(formatDate(getMonday(currentDate)))
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      // Force refresh the weekly summary data
      await fetchWeeklySummary()
    } finally {
      setRecalculating(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading weekly review...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (!weeklySummary) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-neutral-500">No data available for this week.</p>
        </div>
      </div>
    )
  }

  const adherenceColor =
    weeklySummary.summary.adherenceScore >= 80
      ? "green"
      : weeklySummary.summary.adherenceScore >= 60
      ? "yellow"
      : "red"

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header with Client Name */}
        <div className="mb-6">
          <Link
            href="/coach-dashboard"
            className="text-sm text-neutral-600 hover:text-neutral-900 mb-2 inline-block"
          >
            ← Back to Clients
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {client?.name || client?.email || "Client"}
            {client?.name && <span className="text-neutral-500 font-normal"> - {client?.email}</span>}
          </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-neutral-200 mb-6">
          <nav className="flex gap-6 overflow-x-auto">
            <Link
              href={`/clients/${clientId}`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Overview
            </Link>
            <Link
              href={`/clients/${clientId}/entries`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Entries
            </Link>
            <Link
              href={`/clients/${clientId}/weekly-review`}
              className="px-1 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px whitespace-nowrap"
            >
              Weekly Review
            </Link>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Training
            </span>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Tasks
            </span>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Metrics
            </span>
            <Link
              href={`/clients/${clientId}/settings`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Settings
            </Link>
          </nav>
        </div>

        <div className="mb-6">
          <p className="text-neutral-600 text-sm">
            Week of {new Date(weeklySummary.weekStart).toLocaleDateString()} -{" "}
            {new Date(weeklySummary.weekEnd).toLocaleDateString()}
          </p>
        </div>

        {/* Week Selector */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6 flex items-center justify-between gap-4">
          <button
            onClick={() => handleWeekChange("prev")}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ← Previous Week
          </button>
          <div className="text-center flex-1">
            <input
              type="week"
              value={`${selectedWeekStart.split("-")[0]}-W${Math.ceil(
                (new Date(selectedWeekStart).getDate() +
                  new Date(selectedWeekStart).getDay()) /
                  7
              )}`}
              onChange={(e) => {
                const [yearStr, weekStr] = e.target.value.split("-W")
                const year = parseInt(yearStr, 10)
                const week = parseInt(weekStr, 10)
                if (!isNaN(year) && !isNaN(week)) {
                  const date = new Date(year, 0, 1 + (week - 1) * 7)
                  setSelectedWeekStart(formatDate(getMonday(date)))
                }
              }}
              className="px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => handleWeekChange("next")}
            disabled={
              formatDate(getMonday(new Date(selectedWeekStart))) >=
              formatDate(getMonday(new Date()))
            }
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Week →
          </button>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {recalculating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Recalculating...
              </>
            ) : (
              <>
                ⟳ Recalculate
              </>
            )}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">Check-In Adherence</div>
            <div
              className={`text-3xl font-bold ${
                adherenceColor === "green"
                  ? "text-neutral-700"
                  : adherenceColor === "yellow"
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {weeklySummary.summary.checkInCount}/7
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {Math.round(weeklySummary.summary.checkInRate * 100)}% completion
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">Weight Trend</div>
            <div
              className={`text-3xl font-bold ${
                weeklySummary.summary.weightTrend !== null
                  ? weeklySummary.summary.weightTrend > 0
                    ? "text-red-600"
                    : weeklySummary.summary.weightTrend < 0
                    ? "text-neutral-700"
                    : "text-neutral-900"
                  : "text-neutral-900"
              }`}
            >
              {weeklySummary.summary.weightTrend !== null
                ? `${weeklySummary.summary.weightTrend > 0 ? "+" : ""}${weeklySummary.summary.weightTrend.toFixed(1)} lbs`
                : "—"}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {weeklySummary.summary.avgWeight !== null
                ? `Avg: ${weeklySummary.summary.avgWeight.toFixed(1)} lbs`
                : "No weight data"}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">Avg Steps</div>
            <div className="text-3xl font-bold text-neutral-900">
              {weeklySummary.summary.avgSteps !== null
                ? weeklySummary.summary.avgSteps.toLocaleString()
                : "—"}
            </div>
            <div className="text-xs text-neutral-500 mt-1">This week</div>
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">BMI Change</div>
            <div className="text-3xl font-bold text-neutral-900">
              {weeklySummary.summary.avgBMI !== null
                ? weeklySummary.summary.avgBMI.toFixed(1)
                : "—"}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Average BMI</div>
          </div>
        </div>

        {/* Day-by-Day Grid */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Day-by-Day Breakdown</h2>
          <div className="grid grid-cols-7 gap-2">
            {weeklySummary.entries.map((entry, index) => {
              const dateLabel = getDateLabel(entry.date, index)
              const entryStatus = entry.hasEntry
                ? entry.weightLbs !== null ||
                  entry.steps !== null ||
                  entry.calories !== null
                  ? "complete"
                  : "partial"
                : "missing"

              return (
                <div
                  key={entry.date}
                  className={`p-3 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                    entryStatus === "complete"
                      ? "bg-neutral-50 border-neutral-200"
                      : entryStatus === "partial"
                      ? "bg-neutral-50 border-neutral-200"
                      : "bg-neutral-50 border-neutral-200"
                  }`}
                >
                  <div className="text-xs font-medium text-neutral-700 mb-1">
                    {dateLabel}
                  </div>
                  <div className="text-xs text-neutral-500 mb-2">
                    {new Date(entry.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  {entry.hasEntry ? (
                    <div className="space-y-1">
                      {entry.weightLbs !== null && (
                        <div className="text-xs">
                          <span className="text-neutral-600">W:</span>{" "}
                          <span className="font-medium">
                            {entry.weightLbs.toFixed(1)} lbs
                          </span>
                        </div>
                      )}
                      {entry.steps !== null && (
                        <div className="text-xs">
                          <span className="text-neutral-600">S:</span>{" "}
                          <span className="font-medium">
                            {entry.steps.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {entry.sleepQuality !== null && (
                        <div className="text-xs">
                          <span className="text-neutral-600">Sleep:</span>{" "}
                          <span className="font-medium">{entry.sleepQuality}/10</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-400 italic">No entry</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Week-over-Week Comparison */}
        {weeklySummary.previousWeek && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Week-over-Week Comparison</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-medium text-neutral-700 mb-2">
                  Previous Week
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-neutral-600">Check-ins:</span>{" "}
                    <span className="font-medium">
                      {weeklySummary.previousWeek.checkInCount}/7 (
                      {Math.round(weeklySummary.previousWeek.checkInRate * 100)}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-600">Avg Weight:</span>{" "}
                    <span className="font-medium">
                      {weeklySummary.previousWeek.avgWeight !== null
                        ? `${weeklySummary.previousWeek.avgWeight.toFixed(1)} lbs`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-600">Avg Steps:</span>{" "}
                    <span className="font-medium">
                      {weeklySummary.previousWeek.avgSteps !== null
                        ? weeklySummary.previousWeek.avgSteps.toLocaleString()
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-neutral-700 mb-2">
                  This Week
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-neutral-600">Check-ins:</span>{" "}
                    <span className="font-medium">
                      {weeklySummary.summary.checkInCount}/7 (
                      {Math.round(weeklySummary.summary.checkInRate * 100)}%)
                    </span>
                    {weeklySummary.summary.checkInRate >
                      weeklySummary.previousWeek.checkInRate && (
                      <span className="ml-2 text-neutral-700">↑</span>
                    )}
                    {weeklySummary.summary.checkInRate <
                      weeklySummary.previousWeek.checkInRate && (
                      <span className="ml-2 text-red-600">↓</span>
                    )}
                  </div>
                  <div>
                    <span className="text-neutral-600">Avg Weight:</span>{" "}
                    <span className="font-medium">
                      {weeklySummary.summary.avgWeight !== null
                        ? `${weeklySummary.summary.avgWeight.toFixed(1)} lbs`
                        : "—"}
                    </span>
                    {weeklySummary.summary.avgWeight !== null &&
                      weeklySummary.previousWeek.avgWeight !== null && (
                        <>
                          {weeklySummary.summary.avgWeight <
                            weeklySummary.previousWeek.avgWeight && (
                            <span className="ml-2 text-neutral-700">↓</span>
                          )}
                          {weeklySummary.summary.avgWeight >
                            weeklySummary.previousWeek.avgWeight && (
                            <span className="ml-2 text-red-600">↑</span>
                          )}
                        </>
                      )}
                  </div>
                  <div>
                    <span className="text-neutral-600">Avg Steps:</span>{" "}
                    <span className="font-medium">
                      {weeklySummary.summary.avgSteps !== null
                        ? weeklySummary.summary.avgSteps.toLocaleString()
                        : "—"}
                    </span>
                    {weeklySummary.summary.avgSteps !== null &&
                      weeklySummary.previousWeek.avgSteps !== null && (
                        <>
                          {weeklySummary.summary.avgSteps >
                            weeklySummary.previousWeek.avgSteps && (
                            <span className="ml-2 text-neutral-700">↑</span>
                          )}
                          {weeklySummary.summary.avgSteps <
                            weeklySummary.previousWeek.avgSteps && (
                            <span className="ml-2 text-red-600">↓</span>
                          )}
                        </>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Coach Response Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Weekly Coach Response</h2>
          <p className="text-sm text-neutral-600 mb-4">
            Save your Loom video link and notes for this week's review.
          </p>

          {/* Loom URL Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Loom Video URL
            </label>
            <input
              type="url"
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Weekly Note */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Weekly Notes
            </label>
            <textarea
              rows={4}
              value={weeklyNote}
              onChange={(e) => setWeeklyNote(e.target.value)}
              placeholder="Add notes about this week's coaching response..."
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          <button
            onClick={handleSaveWeeklyResponse}
            disabled={savingWeeklyResponse}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingWeeklyResponse ? "Saving..." : "Save Weekly Response"}
          </button>
        </div>

        {/* Coach Notes Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Coach Notes (Private)</h2>
            <button
              onClick={() => setShowAllNotes(!showAllNotes)}
              className="text-sm text-neutral-900 hover:text-blue-700 font-medium"
            >
              {showAllNotes ? "Hide All Notes" : "View All Notes"}
            </button>
          </div>

          {/* Date Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Note Date
            </label>
            <input
              type="date"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
              className="px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-blue-500 transition-all"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Select the date when this information was recorded
            </p>
          </div>

          <textarea
            rows={6}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your private notes about this client..."
            className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-blue-500 transition-all resize-none mb-4"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-neutral-500">
              These notes are private and will not be visible to the client.
            </p>
            <button
              onClick={handleSaveNote}
              disabled={savingNote || !noteText.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingNote ? "Saving..." : "Save Note"}
            </button>
          </div>
          {coachNote && (
            <div className="mt-4 text-xs text-neutral-500">
              Last updated:{" "}
              {new Date(coachNote.updatedAt).toLocaleDateString()}{" "}
              {new Date(coachNote.updatedAt).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* All Notes List */}
        {showAllNotes && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold mb-4">All Coach Notes</h3>
            {allNotes.length === 0 ? (
              <p className="text-neutral-500 text-sm">No notes yet. Add your first note above.</p>
            ) : (
              <div className="space-y-4">
                {allNotes.map((note) => (
                  <div
                    key={note.id}
                    className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-medium text-neutral-700">
                        {new Date(note.noteDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                      {note.note}
                    </p>
                    {note.weekStart && (
                      <div className="mt-2 text-xs text-neutral-500">
                        Week of: {new Date(note.weekStart).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
