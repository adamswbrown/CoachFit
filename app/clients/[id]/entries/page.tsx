"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { DataSourceBadge } from "@/components/DataSourceBadge"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface Entry {
  id: string
  date: string
  weightLbs: number | null
  steps: number | null
  calories: number | null
  sleepQuality: number | null
  perceivedEffort: number | null
  notes: string | null
  dataSources: string[] | null
  createdAt: string
}

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

export default function ClientEntriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
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
          await Promise.all([fetchClient(), fetchEntries(), fetchAnalytics()])
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }
  }, [session, clientId])

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

  const fetchEntries = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/entries`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch (err) {
      console.error("Error fetching entries:", err)
    }
  }

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/analytics`)
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data)
      }
    } catch (err) {
      console.error("Error fetching analytics:", err)
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div>Loading...</div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

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
              className="px-1 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px whitespace-nowrap"
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

        {/* Summary Stats Cards */}
        {analytics && analytics.summary && (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
              <div className="text-sm text-neutral-600 mb-1">Latest Weight</div>
              <div className="text-3xl font-bold text-neutral-900">
                {analytics.summary.latestWeight !== null
                  ? `${analytics.summary.latestWeight.toFixed(1)} lbs`
                  : "—"}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
              <div className="text-sm text-neutral-600 mb-1">Weight Change</div>
              <div
                className={`text-3xl font-bold ${
                  analytics.summary.weightChange !== null
                    ? analytics.summary.weightChange > 0
                      ? "text-neutral-700"
                      : analytics.summary.weightChange < 0
                      ? "text-neutral-700"
                      : "text-neutral-900"
                    : "text-neutral-900"
                }`}
              >
                {analytics.summary.weightChange !== null
                  ? `${analytics.summary.weightChange > 0 ? "+" : ""}${analytics.summary.weightChange.toFixed(1)} lbs`
                  : "—"}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
              <div className="text-sm text-neutral-600 mb-1">Latest BMI</div>
              <div className="text-3xl font-bold text-neutral-900">
                {analytics.summary.latestBMI !== null
                  ? analytics.summary.latestBMI.toFixed(1)
                  : "—"}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
              <div className="text-sm text-neutral-600 mb-1">BMI Change</div>
              <div
                className={`text-3xl font-bold ${
                  analytics.summary.bmiChange !== null
                    ? analytics.summary.bmiChange > 0
                      ? "text-neutral-700"
                      : analytics.summary.bmiChange < 0
                      ? "text-neutral-700"
                      : "text-neutral-900"
                    : "text-neutral-900"
                }`}
              >
                {analytics.summary.bmiChange !== null
                  ? `${analytics.summary.bmiChange > 0 ? "+" : ""}${analytics.summary.bmiChange.toFixed(1)}`
                  : "—"}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
              <div className="text-sm text-neutral-600 mb-1">Avg Steps (30d)</div>
              <div className="text-3xl font-bold text-neutral-900">
                {analytics.summary.avgSteps30d !== null
                  ? analytics.summary.avgSteps30d.toLocaleString()
                  : "—"}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
              <div className="text-sm text-neutral-600 mb-1">Avg Calories (30d)</div>
              <div className="text-3xl font-bold text-neutral-900">
                {analytics.summary.avgCalories30d !== null
                  ? analytics.summary.avgCalories30d.toLocaleString()
                  : "—"}
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {analytics && analytics.entries.length > 0 && (
          <>
            {/* Weight Chart with BMI (if available) */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Weight Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.entries.filter(e => e.weightLbs !== null)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis yAxisId="weight" orientation="left" />
                  {analytics.entries.some(e => e.bmi !== null) && (
                    <YAxis yAxisId="bmi" orientation="right" />
                  )}
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: any, name?: string) => {
                      const label = name || ""
                      if (value === null || value === undefined) return [null, label]
                      const numValue = typeof value === "number" ? value : parseFloat(value)
                      if (isNaN(numValue)) return [null, label]
                      if (name === "weightLbs") return [`${numValue.toFixed(1)} lbs`, "Weight"]
                      if (name === "bmi") return [numValue.toFixed(1), "BMI"]
                      return [numValue, label]
                    }}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weightLbs"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                  {analytics.entries.some(e => e.bmi !== null) && (
                    <Line
                      yAxisId="bmi"
                      type="monotone"
                      dataKey="bmi"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                      strokeDasharray="5 5"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Steps Chart */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Steps Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.entries.filter(e => e.steps !== null)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: any) => {
                      if (value === null || value === undefined) return [null, "Steps"]
                      const numValue = typeof value === "number" ? value : parseFloat(value)
                      return isNaN(numValue) ? [null, "Steps"] : [numValue.toLocaleString(), "Steps"]
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="steps"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sleep Quality Chart (if data available) */}
            {analytics.entries.some(e => e.sleepQuality !== null) && (
              <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Sleep Quality Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.entries.filter(e => e.sleepQuality !== null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis domain={[0, 10]} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: any) => {
                        if (value === null || value === undefined) return [null, "Sleep Quality"]
                        const numValue = typeof value === "number" ? value : parseFloat(value)
                        return isNaN(numValue) ? [null, "Sleep Quality"] : [`${numValue}/10`, "Sleep Quality"]
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sleepQuality"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Perceived Effort Chart (if data available) */}
            {analytics.entries.some(e => e.perceivedEffort !== null) && (
              <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Perceived Effort Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.entries.filter(e => e.perceivedEffort !== null)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis domain={[0, 10]} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: any) => {
                        if (value === null || value === undefined) return [null, "Perceived Effort"]
                        const numValue = typeof value === "number" ? value : parseFloat(value)
                        return isNaN(numValue) ? [null, "Perceived Effort"] : [`${numValue}/10`, "Perceived Effort"]
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="perceivedEffort"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Entries Table */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-xl font-semibold mb-4">All Entries</h2>
          {entries.length === 0 ? (
            <p className="text-neutral-500">No entries found for this client.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Source</th>
                    <th className="text-left p-2">Weight (lbs)</th>
                    <th className="text-left p-2">Steps</th>
                    <th className="text-left p-2">Calories</th>
                    <th className="text-left p-2">Sleep</th>
                    <th className="text-left p-2">Effort</th>
                    <th className="text-left p-2">BMI</th>
                    <th className="text-left p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    // Find corresponding analytics entry for BMI
                    const analyticsEntry = analytics?.entries.find(e => e.date === entry.date.split('T')[0])
                    return (
                      <tr key={entry.id} className="border-b">
                        <td className="p-2">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="p-2">
                          <DataSourceBadge dataSources={entry.dataSources} size="sm" />
                        </td>
                        <td className="p-2">{entry.weightLbs !== null ? entry.weightLbs.toFixed(1) : "—"}</td>
                        <td className="p-2">{entry.steps !== null ? entry.steps.toLocaleString() : "—"}</td>
                        <td className="p-2">{entry.calories !== null ? entry.calories.toLocaleString() : "—"}</td>
                        <td className="p-2">{entry.sleepQuality !== null ? `${entry.sleepQuality}/10` : "—"}</td>
                        <td className="p-2">{entry.perceivedEffort !== null ? `${entry.perceivedEffort}/10` : "—"}</td>
                        <td className="p-2">{analyticsEntry?.bmi !== null && analyticsEntry?.bmi !== undefined ? analyticsEntry.bmi.toFixed(1) : "—"}</td>
                        <td className="p-2 max-w-xs truncate" title={entry.notes || undefined}>
                          {entry.notes ? (
                            <span className="text-sm text-slate-600">{entry.notes}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </CoachLayout>
  )
}
