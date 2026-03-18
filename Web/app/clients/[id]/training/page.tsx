"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

interface Workout {
  id: string
  workoutType: string
  startTime: string
  endTime: string
  durationSecs: number
  caloriesActive: number | null
  distanceMeters: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
  sourceDevice: string | null
}

interface ClientInfo {
  id: string
  name: string | null
  email: string
  CohortMembership?: { Cohort: { id: string; name: string } }[]
}

const WORKOUT_EMOJI: Record<string, string> = {
  running: "🏃",
  walking: "🚶",
  cycling: "🚴",
  swimming: "🏊",
  strength_training: "🏋️",
  hiit: "🔥",
  yoga: "🧘",
  hiking: "🥾",
  rowing: "🚣",
  dance: "💃",
  pilates: "🤸",
  elliptical: "🏃",
  cross_training: "⚡",
  core_training: "💪",
  flexibility: "🤸",
  cooldown: "❄️",
  mixed_cardio: "❤️",
  jump_rope: "🪢",
  stair_climbing: "🪜",
  stairs: "🪜",
  other: "🏅",
}

const TYPE_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
]

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDistance(meters: number | null): string | null {
  if (!meters) return null
  const km = meters / 1000
  if (km >= 1) return `${km.toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function formatType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

export default function ClientTrainingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<ClientInfo | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    if (status === "loading") return
    if (!session?.user || !isAdminOrCoach(session.user as { roles: Role[] })) {
      router.push("/dashboard")
      return
    }
    loadData()
  }, [session, status, clientId, days])

  const loadData = async () => {
    setLoading(true)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const [clientRes, workoutsRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/healthkit/workouts?clientId=${clientId}&startDate=${startDate.toISOString()}`),
      ])

      if (clientRes.ok) {
        const data = await clientRes.json()
        setClient(data.client || data)
      }

      if (workoutsRes.ok) {
        const data = await workoutsRes.json()
        setWorkouts(data.workouts || [])
      }
    } finally {
      setLoading(false)
    }
  }

  // Summary stats
  const stats = useMemo(() => {
    const totalWorkouts = workouts.length
    const totalMinutes = workouts.reduce((sum, w) => sum + w.durationSecs, 0) / 60
    const totalCalories = workouts.reduce((sum, w) => sum + (w.caloriesActive || 0), 0)
    const avgDuration = totalWorkouts > 0 ? (totalMinutes / totalWorkouts) : 0
    const avgHeartRate = (() => {
      const withHR = workouts.filter(w => w.avgHeartRate)
      if (withHR.length === 0) return null
      return Math.round(withHR.reduce((sum, w) => sum + w.avgHeartRate!, 0) / withHR.length)
    })()

    return { totalWorkouts, totalMinutes, totalCalories, avgDuration, avgHeartRate }
  }, [workouts])

  // Workouts per week chart data
  const weeklyData = useMemo(() => {
    const weeks: Record<string, { week: string, count: number, minutes: number, calories: number }> = {}
    workouts.forEach(w => {
      const d = new Date(w.startTime)
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay() + 1) // Monday
      const key = weekStart.toISOString().split("T")[0]
      if (!weeks[key]) weeks[key] = { week: key, count: 0, minutes: 0, calories: 0 }
      weeks[key].count++
      weeks[key].minutes += Math.round(w.durationSecs / 60)
      weeks[key].calories += w.caloriesActive || 0
    })
    return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week))
  }, [workouts])

  // Workout type breakdown
  const typeBreakdown = useMemo(() => {
    const types: Record<string, { name: string, count: number, minutes: number }> = {}
    workouts.forEach(w => {
      const t = w.workoutType
      if (!types[t]) types[t] = { name: formatType(t), count: 0, minutes: 0 }
      types[t].count++
      types[t].minutes += Math.round(w.durationSecs / 60)
    })
    return Object.values(types).sort((a, b) => b.minutes - a.minutes)
  }, [workouts])

  if (loading && !client) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <Link href="/coach-dashboard" className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">
          ← Back to Clients
        </Link>
        <h1 className="text-2xl font-bold mb-1">
          {client?.name || "Client"} <span className="text-neutral-400 font-normal text-lg">– {client?.email}</span>
        </h1>

        {/* Tabs */}
        <div className="border-b border-neutral-200 mb-6 mt-4">
          <nav className="flex gap-6 overflow-x-auto">
            <Link href={`/clients/${clientId}`} className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap">Overview</Link>
            <Link href={`/clients/${clientId}/entries`} className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap">Entries</Link>
            {client?.CohortMembership && client.CohortMembership.length > 0 && (
              <Link href={`/clients/${clientId}/weekly-review`} className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap">Weekly Review</Link>
            )}
            <Link href={`/clients/${clientId}/training`} className="px-1 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px whitespace-nowrap">Training</Link>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">Tasks</span>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">Metrics</span>
            <Link href={`/clients/${clientId}/settings`} className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap">Settings</Link>
          </nav>
        </div>

        {/* Date range filter */}
        <div className="flex gap-2 mb-6">
          {[7, 14, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                days === d
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Workouts" value={stats.totalWorkouts.toString()} />
          <StatCard label="Total Time" value={formatDuration(stats.totalMinutes * 60)} />
          <StatCard label="Calories Burned" value={stats.totalCalories > 0 ? stats.totalCalories.toLocaleString() : "—"} />
          <StatCard label="Avg Duration" value={stats.avgDuration > 0 ? `${Math.round(stats.avgDuration)}m` : "—"} />
          <StatCard label="Avg Heart Rate" value={stats.avgHeartRate ? `${stats.avgHeartRate} bpm` : "—"} />
        </div>

        {workouts.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
            <p className="text-neutral-500 text-lg">No workouts recorded in the last {days} days</p>
            <p className="text-neutral-400 text-sm mt-2">Workouts sync automatically from the client&apos;s Apple Health via the CoachFit iOS app.</p>
          </div>
        ) : (
          <>
            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Workouts per week */}
              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Weekly Volume</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={v => {
                      const d = new Date(v)
                      return `${d.getDate()}/${d.getMonth() + 1}`
                    }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        name === "count" ? `${value} workouts` : `${value} min`,
                        name === "count" ? "Workouts" : "Duration"
                      ]}
                      labelFormatter={v => `Week of ${v}`}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Type breakdown */}
              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">By Type</h2>
                {typeBreakdown.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={220}>
                      <PieChart>
                        <Pie
                          data={typeBreakdown}
                          dataKey="minutes"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={40}
                        >
                          {typeBreakdown.map((_, i) => (
                            <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${value} min`, "Duration"]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {typeBreakdown.map((t, i) => (
                        <div key={t.name} className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                          <span className="flex-1">{WORKOUT_EMOJI[t.name.toLowerCase().replace(/ /g, "_")] || "🏅"} {t.name}</span>
                          <span className="text-neutral-500">{t.count}× · {formatDuration(t.minutes * 60)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-neutral-400 text-sm">No data</p>
                )}
              </div>
            </div>

            {/* Workout list */}
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100">
                <h2 className="text-lg font-semibold">All Workouts ({workouts.length})</h2>
              </div>
              <div className="divide-y divide-neutral-100">
                {workouts
                  .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                  .map(w => (
                    <div key={w.id} className="px-6 py-4 flex items-center gap-4">
                      <span className="text-2xl">{WORKOUT_EMOJI[w.workoutType] || "🏅"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900">{formatType(w.workoutType)}</div>
                        <div className="text-sm text-neutral-500">
                          {new Date(w.startTime).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {new Date(w.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {w.sourceDevice && <span className="text-neutral-400"> · {w.sourceDevice}</span>}
                        </div>
                      </div>
                      <div className="flex gap-6 text-sm text-right">
                        <div>
                          <div className="font-medium">{formatDuration(w.durationSecs)}</div>
                          <div className="text-neutral-400">duration</div>
                        </div>
                        {w.caloriesActive && (
                          <div>
                            <div className="font-medium">{w.caloriesActive}</div>
                            <div className="text-neutral-400">kcal</div>
                          </div>
                        )}
                        {w.distanceMeters && (
                          <div>
                            <div className="font-medium">{formatDistance(w.distanceMeters)}</div>
                            <div className="text-neutral-400">distance</div>
                          </div>
                        )}
                        {w.avgHeartRate && (
                          <div>
                            <div className="font-medium">{w.avgHeartRate} <span className="text-neutral-400">/ {w.maxHeartRate || "—"}</span></div>
                            <div className="text-neutral-400">avg/max bpm</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </CoachLayout>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}
