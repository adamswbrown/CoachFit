"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"

interface Client {
  id: string
  name: string | null
  email: string
}

interface AnalyticsData {
  summary: {
    latestWeight: number | null
    firstWeight: number | null
    weightChange: number | null
    latestBMI: number | null
    firstBMI: number | null
    bmiChange: number | null
    avgSteps7d: number | null
    avgSteps30d: number | null
    avgCalories7d: number | null
    avgCalories30d: number | null
  }
  entries: Array<{
    date: string
    weightLbs: number | null
    steps: number | null
    calories: number | null
    sleepQuality: number | null
    perceivedEffort: number | null
    bmi: number | null
  }>
}

interface CoachNote {
  id: string
  note: string
  noteDate: string
  createdAt: string
}

export default function ClientOverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [coachNotes, setCoachNotes] = useState<CoachNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user.roles.includes("CLIENT")) {
      router.push("/client-dashboard")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session && clientId) {
      loadData()
    }
  }, [session, clientId])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchClient(),
        fetchAnalytics(),
        fetchEntries(),
        fetchCoachNotes(),
      ])
    } catch (err) {
      console.error("Error loading client overview data:", err)
      setError("Failed to load client data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const fetchClient = async () => {
    const data = await fetchWithRetry<Client>(`/api/clients/${clientId}`)
    setClient(data)
  }

  const fetchAnalytics = async () => {
    const data = await fetchWithRetry<AnalyticsData>(`/api/clients/${clientId}/analytics`)
    setAnalytics(data)
  }

  const fetchEntries = async () => {
    const data = await fetchWithRetry<any[]>(`/api/clients/${clientId}/entries?limit=10`)
    setEntries(data)
  }

  const fetchCoachNotes = async () => {
    try {
      const data = await fetchWithRetry<{ notes: CoachNote[] }>(`/api/clients/${clientId}/coach-notes`)
      setCoachNotes(data.notes || [])
    } catch (err) {
      // Coach notes are optional, don't fail if they don't exist
      setCoachNotes([])
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading client overview...</p>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

  if (error || !client) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Failed to load client data</h3>
                <p className="text-red-800 text-sm mb-4">{error || "Client not found"}</p>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </CoachLayout>
    )
  }

  const hasEntries = analytics?.entries && analytics.entries.length > 0
  const recentEntries = entries.slice(0, 5)
  const lastEntry = entries[0]
  
  // Calculate check-in stats
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekEntries = entries.filter((e: any) => new Date(e.date) >= weekAgo)
  const checkInCount7d = weekEntries.length
  
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)
  const monthEntries = entries.filter((e: any) => new Date(e.date) >= monthAgo)
  const checkInCount30d = monthEntries.length

  // Format weight change percentage
  const weightChangePercent = analytics?.summary.weightChange && analytics?.summary.firstWeight
    ? ((analytics.summary.weightChange / analytics.summary.firstWeight) * 100).toFixed(1)
    : null

  // Get last 30 days of data for charts
  const chartData = hasEntries
    ? analytics!.entries
        .filter((e) => {
          const entryDate = new Date(e.date)
          return entryDate >= monthAgo
        })
        .slice(-30)
    : []

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
            {client.name || client.email}
            {client.name && <span className="text-neutral-500 font-normal"> - {client.email}</span>}
          </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-neutral-200 mb-6">
          <nav className="flex gap-6 overflow-x-auto">
            <Link
              href={`/clients/${clientId}`}
              className="px-1 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px whitespace-nowrap"
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
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Training Section */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Training</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">LAST 7 DAYS</div>
                  <div className="text-2xl font-semibold text-neutral-900">
                    {checkInCount7d}/7 Tracked
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">LAST 30 DAYS</div>
                  <div className="text-2xl font-semibold text-neutral-900">
                    {checkInCount30d}/30 Tracked
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">NEXT WEEK</div>
                  <div className="text-2xl font-semibold text-neutral-900">
                    0 Assigned
                  </div>
                </div>
              </div>
              {lastEntry && (
                <div className="pt-4 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-neutral-600">
                        Last Check-In: {new Date(lastEntry.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </div>
                      {lastEntry.weightLbs && (
                        <div className="text-sm text-neutral-500 mt-1">
                          Weight: {lastEntry.weightLbs.toFixed(1)} lbs
                          {lastEntry.steps && ` • Steps: ${lastEntry.steps.toLocaleString()}`}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/clients/${clientId}/entries`}
                      className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 text-sm font-medium transition-colors"
                    >
                      View Entries
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Body Metrics Overview */}
            {hasEntries && (
              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-6">Body Metrics Overview</h2>
                
                <div className="space-y-6">
                  {/* Weight */}
                  {analytics?.summary.latestWeight && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">Weight</div>
                          <div className="text-2xl font-semibold text-neutral-900 mt-1">
                            {analytics.summary.latestWeight.toFixed(1)} lbs
                            {weightChangePercent && (
                              <span className={`text-sm ml-2 ${analytics.summary.weightChange! < 0 ? "text-green-600" : analytics.summary.weightChange! > 0 ? "text-red-600" : "text-neutral-600"}`}>
                                {analytics.summary.weightChange! < 0 ? "↓" : analytics.summary.weightChange! > 0 ? "↑" : "→"} {Math.abs(parseFloat(weightChangePercent))}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Simple weight chart placeholder */}
                      <div className="h-24 bg-neutral-50 rounded border border-neutral-200 flex items-end justify-start gap-1 p-2">
                        {chartData.filter(e => e.weightLbs !== null).slice(-14).map((entry, idx) => {
                          const maxWeight = Math.max(...chartData.filter(e => e.weightLbs !== null).map(e => e.weightLbs!))
                          const minWeight = Math.min(...chartData.filter(e => e.weightLbs !== null).map(e => e.weightLbs!))
                          const range = maxWeight - minWeight || 1
                          const height = entry.weightLbs ? ((entry.weightLbs - minWeight) / range) * 100 : 0
                          return (
                            <div
                              key={idx}
                              className="flex-1 bg-blue-500 rounded-t"
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`${entry.weightLbs?.toFixed(1)} lbs`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sleep */}
                  {chartData.some(e => e.sleepQuality !== null) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">Sleep Quality</div>
                          <div className="text-2xl font-semibold text-neutral-900 mt-1">
                            {chartData.filter(e => e.sleepQuality !== null).length > 0
                              ? `${(chartData.filter(e => e.sleepQuality !== null).reduce((sum, e) => sum + (e.sleepQuality || 0), 0) / chartData.filter(e => e.sleepQuality !== null).length).toFixed(1)}/10`
                              : "—"}
                          </div>
                        </div>
                      </div>
                      {/* Simple sleep chart placeholder */}
                      <div className="h-24 bg-neutral-50 rounded border border-neutral-200 flex items-end justify-start gap-1 p-2">
                        {chartData.filter(e => e.sleepQuality !== null).slice(-14).map((entry, idx) => {
                          const height = entry.sleepQuality ? (entry.sleepQuality / 10) * 100 : 0
                          return (
                            <div
                              key={idx}
                              className="flex-1 bg-indigo-500 rounded-t"
                              style={{ height: `${height}%` }}
                              title={`${entry.sleepQuality}/10`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Steps */}
                  {analytics?.summary.avgSteps7d && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-sm font-medium text-neutral-900">Steps</div>
                          <div className="text-2xl font-semibold text-neutral-900 mt-1">
                            {analytics.summary.avgSteps7d.toLocaleString()} Average last 7 days
                          </div>
                        </div>
                      </div>
                      {/* Simple steps chart placeholder */}
                      <div className="h-24 bg-neutral-50 rounded border border-neutral-200 flex items-end justify-start gap-1 p-2">
                        {chartData.filter(e => e.steps !== null).slice(-7).map((entry, idx) => {
                          const maxSteps = Math.max(...chartData.filter(e => e.steps !== null).map(e => e.steps!))
                          const height = entry.steps ? (entry.steps / maxSteps) * 100 : 0
                          return (
                            <div
                              key={idx}
                              className="flex-1 bg-green-500 rounded-t"
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`${entry.steps?.toLocaleString()} steps`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!hasEntries && (
              <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="font-medium text-neutral-900 mb-1">No entries yet</h3>
                <p className="text-sm text-neutral-500">
                  This client hasn't logged any check-ins yet.
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar Cards */}
          <div className="space-y-6">
            {/* Profile */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">Profile</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-neutral-500">Email</div>
                  <div className="text-neutral-900 font-medium">{client.email}</div>
                </div>
                <div>
                  <div className="text-neutral-500">Local Time</div>
                  <div className="text-neutral-900 font-medium">
                    {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} - {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </div>
                </div>
              </div>
            </div>

            {/* Updates */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">Updates</h3>
              {recentEntries.length > 0 ? (
                <div className="space-y-3">
                  {recentEntries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="text-sm text-neutral-600">
                      <div className="font-medium text-neutral-900">
                        {client.name || client.email} updated body metrics
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {new Date(entry.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric"
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-500">No recent updates</div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-4">Notes</h3>
              {coachNotes.length > 0 ? (
                <div className="space-y-3">
                  {coachNotes.slice(0, 3).map((note) => (
                    <div key={note.id} className="text-sm">
                      <div className="text-neutral-900">{note.note}</div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {new Date(note.noteDate || note.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-500 italic">No notes yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}
