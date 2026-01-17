"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { Role } from "@/lib/types"
import { generateWeeklyEmailDraft } from "@/lib/utils/email-draft"

interface ClientSummary {
  clientId: string
  name: string | null
  email: string
  stats: {
    checkInCount: number
    checkInRate: number
    avgWeight: number | null
    weightTrend: number | null
    avgSteps: number | null
    avgCalories: number | null
    avgSleepMins: number | null
  }
  lastCheckInDate: string | null
}

interface WeeklySummariesResponse {
  weekStart: string
  weekEnd: string
  clients: ClientSummary[]
}

interface WeeklyResponse {
  loomUrl?: string | null
  note?: string | null
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

export default function WeeklyReviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<WeeklySummariesResponse | null>(null)
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(
    formatDate(getMonday(new Date()))
  )
  const [loomUrls, setLoomUrls] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savingClient, setSavingClient] = useState<string | null>(null)
  const [copiedClient, setCopiedClient] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !session.user.roles.includes(Role.COACH)) {
      router.push("/client-dashboard")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session) {
      fetchWeeklySummaries()
    }
  }, [session, selectedWeekStart])

  const fetchWeeklySummaries = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/coach-dashboard/weekly-summaries?weekStart=${selectedWeekStart}`
      )
      if (res.ok) {
        const responseData = await res.json()
        setData(responseData)

        // Fetch existing responses for each client
        for (const client of responseData.clients) {
          fetchWeeklyResponse(client.clientId)
        }
      }
    } catch (err) {
      console.error("Error fetching weekly summaries:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchWeeklyResponse = async (clientId: string) => {
    try {
      const res = await fetch(
        `/api/coach-dashboard/weekly-response?clientId=${clientId}&weekStart=${selectedWeekStart}`
      )
      if (res.ok) {
        const response: WeeklyResponse = await res.json()
        if (response.loomUrl) {
          setLoomUrls((prev) => ({ ...prev, [clientId]: response.loomUrl || "" }))
        }
        if (response.note) {
          setNotes((prev) => ({ ...prev, [clientId]: response.note || "" }))
        }
      }
    } catch (err) {
      console.error("Error fetching weekly response:", err)
    }
  }

  const handleSaveResponse = async (clientId: string) => {
    setSavingClient(clientId)
    try {
      const res = await fetch(`/api/coach-dashboard/weekly-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          weekStart: selectedWeekStart,
          loomUrl: loomUrls[clientId] || null,
          note: notes[clientId] || null,
        }),
      })

      if (res.ok) {
        // Show success feedback briefly
        setTimeout(() => setSavingClient(null), 1000)
      }
    } catch (err) {
      console.error("Error saving weekly response:", err)
    } finally {
      if (savingClient === clientId) {
        setSavingClient(null)
      }
    }
  }

  const handleCopyEmail = (client: ClientSummary) => {
    const emailDraft = generateWeeklyEmailDraft({
      clientName: client.name,
      weekStart: selectedWeekStart,
      stats: client.stats,
      loomUrl: loomUrls[client.clientId],
    })

    navigator.clipboard.writeText(emailDraft)
    setCopiedClient(client.clientId)
    setTimeout(() => setCopiedClient(null), 2000)
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
      // Force refresh the weekly summaries data
      await fetchWeeklySummaries()
    } finally {
      setRecalculating(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading weekly review queue...</p>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">
            Weekly Review Queue
          </h1>
          <p className="text-neutral-600 mt-2">
            Review your clients' weekly progress and send personalized updates
          </p>
        </div>

        {/* Week Selector */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6 flex items-center justify-between gap-4">
          <button
            onClick={() => handleWeekChange("prev")}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            ← Previous Week
          </button>
          <div className="text-center flex-1">
            <div className="text-sm text-neutral-600">Selected Week</div>
            <div className="text-lg font-semibold text-neutral-900">
              {data
                ? `${new Date(data.weekStart).toLocaleDateString()} - ${new Date(
                    data.weekEnd
                  ).toLocaleDateString()}`
                : selectedWeekStart}
            </div>
          </div>
          <button
            onClick={() => handleWeekChange("next")}
            disabled={
              formatDate(getMonday(new Date(selectedWeekStart))) >=
              formatDate(getMonday(new Date()))
            }
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Client List */}
        {data && data.clients.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center">
            <p className="text-neutral-600">
              No clients found for this week. Add clients to your cohorts to see their
              weekly summaries here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.clients.map((client) => {
              const adherenceColor =
                client.stats.checkInCount >= 6
                  ? "green"
                  : client.stats.checkInCount >= 4
                  ? "yellow"
                  : "red"

              return (
                <div
                  key={client.clientId}
                  className="bg-white rounded-lg border border-neutral-200 p-6"
                >
                  {/* Client Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">
                        {client.name || client.email}
                      </h3>
                      {client.name && (
                        <p className="text-sm text-neutral-600">{client.email}</p>
                      )}
                    </div>
                    <Link
                      href={`/clients/${client.clientId}/weekly-review?weekStart=${selectedWeekStart}`}
                      className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Open Review →
                    </Link>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Check-ins</div>
                      <div
                        className={`text-2xl font-bold ${
                          adherenceColor === "green"
                            ? "text-green-600"
                            : adherenceColor === "yellow"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {client.stats.checkInCount}/7
                      </div>
                      <div className="text-xs text-neutral-500">
                        {Math.round(client.stats.checkInRate * 100)}%
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Weight</div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {client.stats.avgWeight !== null
                          ? `${client.stats.avgWeight.toFixed(1)}`
                          : "—"}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {client.stats.weightTrend !== null
                          ? `${client.stats.weightTrend > 0 ? "+" : ""}${client.stats.weightTrend.toFixed(1)} lbs`
                          : "No trend"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Steps</div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {client.stats.avgSteps !== null
                          ? client.stats.avgSteps.toLocaleString()
                          : "—"}
                      </div>
                      <div className="text-xs text-neutral-500">avg/day</div>
                    </div>

                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Calories</div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {client.stats.avgCalories !== null
                          ? client.stats.avgCalories.toLocaleString()
                          : "—"}
                      </div>
                      <div className="text-xs text-neutral-500">avg/day</div>
                    </div>

                    <div>
                      <div className="text-xs text-neutral-600 mb-1">Sleep</div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {client.stats.avgSleepMins !== null
                          ? `${Math.floor(client.stats.avgSleepMins / 60)}h ${
                              client.stats.avgSleepMins % 60
                            }m`
                          : "—"}
                      </div>
                      <div className="text-xs text-neutral-500">avg/night</div>
                    </div>
                  </div>

                  {/* Loom URL Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Loom Video URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={loomUrls[client.clientId] || ""}
                        onChange={(e) =>
                          setLoomUrls((prev) => ({
                            ...prev,
                            [client.clientId]: e.target.value,
                          }))
                        }
                        placeholder="https://www.loom.com/share/..."
                        className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                      <button
                        onClick={() => handleSaveResponse(client.clientId)}
                        disabled={savingClient === client.clientId}
                        className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
                      >
                        {savingClient === client.clientId ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Private Notes (optional)
                    </label>
                    <textarea
                      value={notes[client.clientId] || ""}
                      onChange={(e) =>
                        setNotes((prev) => ({
                          ...prev,
                          [client.clientId]: e.target.value,
                        }))
                      }
                      placeholder="Add private notes for this week..."
                      rows={2}
                      className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                    />
                  </div>

                  {/* Copy Email Button */}
                  <button
                    onClick={() => handleCopyEmail(client)}
                    className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    {copiedClient === client.clientId
                      ? "✓ Copied to Clipboard!"
                      : "📋 Copy Email Draft"}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
