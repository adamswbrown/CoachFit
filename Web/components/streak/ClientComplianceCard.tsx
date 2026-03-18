"use client"

import { useState, useEffect } from "react"

interface StreakData {
  currentStreak: number
  longestStreak: number
  lastCheckInDate: string | null
  daysSinceLastCheckIn: number | null
  milestones: Array<{
    id: string
    title: string
    achievedAt: string | null
    coachMessage: string | null
  }>
}

export function ClientComplianceCard({ clientId }: { clientId: string }) {
  const [data, setData] = useState<StreakData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStreak() {
      try {
        const res = await fetch(`/api/coach-dashboard/client-streaks`)
        if (!res.ok) return
        const json = await res.json()
        const client = json.clients?.find((c: { clientId: string }) => c.clientId === clientId)
        if (client) {
          setData({
            currentStreak: client.currentStreak,
            longestStreak: client.longestStreak,
            lastCheckInDate: client.lastCheckInDate,
            daysSinceLastCheckIn: client.daysSinceLastCheckIn,
            milestones: [],
          })
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchStreak()
  }, [clientId])

  if (loading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-neutral-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-neutral-200 rounded w-1/2" />
      </div>
    )
  }

  if (!data) return null

  const statusColor =
    data.daysSinceLastCheckIn === null
      ? "bg-neutral-100 text-neutral-600"
      : data.daysSinceLastCheckIn === 0
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : data.daysSinceLastCheckIn === 1
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-red-50 text-red-700 border-red-200"

  const statusLabel =
    data.daysSinceLastCheckIn === null
      ? "Never checked in"
      : data.daysSinceLastCheckIn === 0
      ? "Active today"
      : data.daysSinceLastCheckIn === 1
      ? "Missed yesterday"
      : `${data.daysSinceLastCheckIn} days since check-in`

  return (
    <div className={`border rounded-lg p-4 ${statusColor}`}>
      <h3 className="text-sm font-semibold mb-3">Compliance</h3>

      <div className="flex items-baseline gap-2 mb-2">
        {data.currentStreak > 0 && <span className="text-lg">🔥</span>}
        <span className="text-2xl font-bold">{data.currentStreak}</span>
        <span className="text-sm font-medium">day streak</span>
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="opacity-75">Status</span>
          <span className="font-medium">{statusLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-75">Longest streak</span>
          <span className="font-medium">{data.longestStreak} days</span>
        </div>
        {data.lastCheckInDate && (
          <div className="flex justify-between">
            <span className="opacity-75">Last check-in</span>
            <span className="font-medium">
              {new Date(data.lastCheckInDate + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
