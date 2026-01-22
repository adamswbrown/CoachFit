"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { DataSourceBadge } from "@/components/DataSourceBadge"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"
import { kgToLbs } from "@/lib/utils/unit-conversions"
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  ReferenceArea,
  Legend,
} from "recharts"

interface Entry {
  id: string
  date: string
  weightLbs: number | null
  steps: number | null
  calories: number | null
  sleepQuality: number | null
  perceivedStress: number | null
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
    perceivedStress: number | null
    bmi: number | null
  }>
}

export default function ClientEntriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [targetWeightLbs, setTargetWeightLbs] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const filterDate = searchParams.get("date")
  const selectedAnalyticsEntry = filterDate
    ? analytics?.entries.find((entry) => entry.date === filterDate)
    : null
  const hasBmiSeries = analytics?.entries.some((entry) => entry.bmi !== null) ?? false
  const latestWeight = analytics?.summary.latestWeight ?? null
  const goalDelta =
    targetWeightLbs != null && latestWeight != null ? latestWeight - targetWeightLbs : null
  const goalStatus =
    goalDelta == null
      ? "—"
      : goalDelta > 0
      ? `${goalDelta.toFixed(1)} lbs to goal`
      : goalDelta < 0
      ? `${Math.abs(goalDelta).toFixed(1)} lbs below goal`
      : "At goal"
  const weightLegendPayload = [
    { value: "Weight", type: "line", color: "#2563eb" },
    ...(hasBmiSeries ? [{ value: "BMI", type: "line", color: "#8b5cf6" }] : []),
    ...(targetWeightLbs != null
      ? [{ value: "Goal range", type: "rect", color: "rgba(37, 99, 235, 0.25)" }]
      : []),
  ]

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
          await Promise.all([fetchClient(), fetchEntries(), fetchAnalytics(), fetchPlan()])
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

  const fetchPlan = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/plan`)
      if (res.ok) {
        const data = await res.json()
        const targetKg = data?.plan?.targetWeightKg
        setTargetWeightLbs(typeof targetKg === "number" ? kgToLbs(targetKg) : null)
      }
    } catch (err) {
      console.error("Error fetching plan:", err)
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
            <Link
              href={`/clients/${clientId}/onboarding`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Onboarding
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
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6">
            <div className="bg-white rounded-lg border border-neutral-200 p-4 border border-neutral-200">
              <div className="text-xs text-neutral-600 mb-1">Latest Weight</div>
              <div className="text-2xl font-bold text-neutral-900">
                {analytics.summary.latestWeight !== null
                  ? `${analytics.summary.latestWeight.toFixed(1)} lbs`
                  : "—"}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-4 border border-neutral-200">
              <div className="text-xs text-neutral-600 mb-1">Weight Change</div>
              <div
                className={`text-2xl font-bold ${
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
            <div className="bg-white rounded-lg border border-neutral-200 p-4 border border-neutral-200">
              <div className="text-xs text-neutral-600 mb-1">Latest BMI</div>
              <div className="text-2xl font-bold text-neutral-900">
                {analytics.summary.latestBMI !== null
                  ? analytics.summary.latestBMI.toFixed(1)
                  : "—"}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-4 border border-neutral-200">
              <div className="text-xs text-neutral-600 mb-1">BMI Change</div>
              <div
                className={`text-2xl font-bold ${
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
            <div className="bg-white rounded-lg border border-neutral-200 p-4 border border-neutral-200">
              <div className="text-xs text-neutral-600 mb-1">Avg Steps (30d)</div>
              <div className="text-2xl font-bold text-neutral-900">
                {analytics.summary.avgSteps30d !== null
                  ? analytics.summary.avgSteps30d.toLocaleString()
                  : "—"}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-4 border border-neutral-200">
              <div className="text-xs text-neutral-600 mb-1">Avg Calories (30d)</div>
              <div className="text-2xl font-bold text-neutral-900">
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
            <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Weight Trend</h2>
                  <p className="text-xs text-neutral-500">
                    Goal: {targetWeightLbs != null ? `${targetWeightLbs.toFixed(1)} lbs` : "—"} ·{" "}
                    {goalStatus}
                  </p>
                </div>
                {filterDate && (
                  <span className="text-xs text-neutral-500">
                    Highlighting {filterDate}
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart
                  data={analytics.entries.filter(e => e.weightLbs !== null)}
                  margin={{ top: 4, right: 10, bottom: -6, left: -12 }}
                >
                  <defs>
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bmiFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                    minTickGap={20}
                    tickMargin={6}
                  />
                  <YAxis
                    yAxisId="weight"
                    orientation="left"
                    tick={{ fontSize: 12 }}
                    width={32}
                    domain={[
                      (min: number) => {
                        const goalMin = targetWeightLbs != null ? targetWeightLbs - 1 : min
                        return Math.floor(Math.min(min, goalMin) - 1)
                      },
                      (max: number) => {
                        const goalMax = targetWeightLbs != null ? targetWeightLbs + 1 : max
                        return Math.ceil(Math.max(max, goalMax) + 1)
                      },
                    ]}
                  />
                  {hasBmiSeries && (
                    <YAxis
                      yAxisId="bmi"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      width={32}
                      domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
                    />
                  )}
                  {filterDate && (
                    <ReferenceLine x={filterDate} stroke="#111827" strokeDasharray="3 3" />
                  )}
                  {targetWeightLbs != null && (
                    <ReferenceArea
                      y1={targetWeightLbs - 1}
                      y2={targetWeightLbs + 1}
                      fill="#2563eb"
                      fillOpacity={0.08}
                      stroke="none"
                      ifOverflow="extendDomain"
                    />
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
                  <Legend
                    align="right"
                    verticalAlign="top"
                    iconSize={10}
                    wrapperStyle={{ fontSize: "12px" }}
                    payload={weightLegendPayload}
                  />
                  <Area
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weightLbs"
                    fill="url(#weightFill)"
                    stroke="none"
                    fillOpacity={1}
                    connectNulls={false}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weightLbs"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 1.5 }}
                    connectNulls={false}
                  />
                  {filterDate && selectedAnalyticsEntry?.weightLbs !== null && selectedAnalyticsEntry?.weightLbs !== undefined && (
                    <ReferenceDot
                      x={filterDate}
                      y={selectedAnalyticsEntry.weightLbs}
                      yAxisId="weight"
                      r={5}
                      fill="#2563eb"
                      stroke="#1f2937"
                    />
                  )}
                  {hasBmiSeries && (
                    <Area
                      yAxisId="bmi"
                      type="monotone"
                      dataKey="bmi"
                      fill="url(#bmiFill)"
                      stroke="none"
                      fillOpacity={1}
                      connectNulls={false}
                    />
                  )}
                  {hasBmiSeries && (
                    <Line
                      yAxisId="bmi"
                      type="monotone"
                      dataKey="bmi"
                      stroke="#8b5cf6"
                      strokeWidth={1.75}
                      dot={{ r: 1.5 }}
                      connectNulls={false}
                      strokeDasharray="5 5"
                    />
                  )}
                  {filterDate && selectedAnalyticsEntry?.bmi !== null && selectedAnalyticsEntry?.bmi !== undefined && (
                    <ReferenceDot
                      x={filterDate}
                      y={selectedAnalyticsEntry.bmi}
                      yAxisId="bmi"
                      r={5}
                      fill="#8b5cf6"
                      stroke="#1f2937"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Steps Chart */}
            <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Steps Trend</h2>
                {filterDate && (
                  <span className="text-xs text-neutral-500">
                    Highlighting {filterDate}
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart
                  data={analytics.entries.filter(e => e.steps !== null)}
                  margin={{ top: 6, right: 10, bottom: 0, left: -8 }}
                >
                  <defs>
                    <linearGradient id="stepsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                    minTickGap={20}
                    tickMargin={6}
                  />
                  <YAxis tick={{ fontSize: 12 }} width={36} />
                  {filterDate && (
                    <ReferenceLine x={filterDate} stroke="#111827" strokeDasharray="3 3" />
                  )}
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: any) => {
                      if (value === null || value === undefined) return [null, "Steps"]
                      const numValue = typeof value === "number" ? value : parseFloat(value)
                      return isNaN(numValue) ? [null, "Steps"] : [numValue.toLocaleString(), "Steps"]
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="steps"
                    fill="url(#stepsFill)"
                    stroke="none"
                    fillOpacity={1}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="steps"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls={false}
                  />
                  {filterDate && selectedAnalyticsEntry?.steps !== null && selectedAnalyticsEntry?.steps !== undefined && (
                    <ReferenceDot
                      x={filterDate}
                      y={selectedAnalyticsEntry.steps}
                      r={5}
                      fill="#10b981"
                      stroke="#1f2937"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Perceived Stress Chart (if data available) */}
            {analytics.entries.some(e => e.perceivedStress !== null) && (
              <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Perceived Stress Trend</h2>
                  {filterDate && (
                    <span className="text-xs text-neutral-500">
                      Highlighting {filterDate}
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart
                    data={analytics.entries.filter(e => e.perceivedStress !== null)}
                    margin={{ top: 6, right: 10, bottom: 0, left: -8 }}
                  >
                    <defs>
                      <linearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={20}
                      tickMargin={6}
                    />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} width={36} />
                    {filterDate && (
                      <ReferenceLine x={filterDate} stroke="#111827" strokeDasharray="3 3" />
                    )}
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: any) => {
                        if (value === null || value === undefined) return [null, "Perceived Stress"]
                        const numValue = typeof value === "number" ? value : parseFloat(value)
                        return isNaN(numValue) ? [null, "Perceived Stress"] : [`${numValue}/10`, "Perceived Stress"]
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="perceivedStress"
                      fill="url(#stressFill)"
                      stroke="none"
                      fillOpacity={1}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="perceivedStress"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                    />
                    {filterDate && selectedAnalyticsEntry?.perceivedStress !== null && selectedAnalyticsEntry?.perceivedStress !== undefined && (
                      <ReferenceDot
                        x={filterDate}
                        y={selectedAnalyticsEntry.perceivedStress}
                        r={5}
                        fill="#ef4444"
                        stroke="#1f2937"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Entries Table */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-xl font-semibold">
              {filterDate ? `Entries for ${filterDate}` : "All Entries"}
            </h2>
            {filterDate && (
              <Link
                href={`/clients/${clientId}/entries`}
                className="text-sm text-neutral-600 hover:text-neutral-900"
              >
                Clear filter
              </Link>
            )}
          </div>
          {(filterDate
            ? entries.filter((entry) => entry.date.split("T")[0] === filterDate)
            : entries
          ).length === 0 ? (
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
                    <th className="text-left p-2">Effort</th>
                    <th className="text-left p-2">BMI</th>
                    <th className="text-left p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(filterDate
                    ? entries.filter((entry) => entry.date.split("T")[0] === filterDate)
                    : entries
                  ).map((entry) => {
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
                        <td className="p-2">{entry.perceivedStress !== null ? `${entry.perceivedStress}/10` : "—"}</td>
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
