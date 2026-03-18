"use client"

import { useState, useEffect } from "react"

interface StreakData {
  currentStreak: number
  longestStreak: number
}

const MILESTONE_THRESHOLDS = [7, 14, 30, 60, 90]

function getNextMilestone(currentStreak: number): number | null {
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (currentStreak < threshold) {
      return threshold
    }
  }
  return null
}

function isAtMilestone(currentStreak: number): boolean {
  return MILESTONE_THRESHOLDS.includes(currentStreak)
}

export function StreakCard() {
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStreak() {
      try {
        const res = await fetch("/api/client/streak")
        if (!res.ok) {
          throw new Error("Failed to load streak")
        }
        const data = await res.json()
        setStreak(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load streak")
      } finally {
        setLoading(false)
      }
    }
    fetchStreak()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-5 border border-neutral-200 animate-pulse">
        <div className="h-4 bg-neutral-200 rounded w-24 mb-3" />
        <div className="h-8 bg-neutral-200 rounded w-40 mb-2" />
        <div className="h-3 bg-neutral-200 rounded w-32" />
      </div>
    )
  }

  if (error || !streak) {
    return null
  }

  const { currentStreak, longestStreak } = streak
  const atMilestone = isAtMilestone(currentStreak)
  const nextMilestone = getNextMilestone(currentStreak)
  const daysToNext = nextMilestone ? nextMilestone - currentStreak : null

  const cardBg = atMilestone
    ? "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300"
    : "bg-white border-neutral-200"

  const headingColor = atMilestone ? "text-amber-900" : "text-neutral-900"
  const subtextColor = atMilestone ? "text-amber-700" : "text-neutral-500"

  return (
    <div className={`rounded-lg p-5 border ${cardBg}`}>
      <p className={`text-xs uppercase tracking-wide ${subtextColor} mb-1`}>
        Check-in Streak
      </p>

      {currentStreak === 0 ? (
        <>
          <p className={`text-lg font-semibold ${headingColor}`}>
            Start your streak!
          </p>
          <p className={`text-sm ${subtextColor} mt-1`}>
            Check in today to begin.
          </p>
        </>
      ) : (
        <>
          <p className={`text-2xl font-semibold ${headingColor}`}>
            {"\uD83D\uDD25"} {currentStreak}-day streak
          </p>
          <div className={`text-sm ${subtextColor} mt-1 space-y-0.5`}>
            <p>Best: {longestStreak} days</p>
            {daysToNext !== null && (
              <p>{daysToNext} day{daysToNext !== 1 ? "s" : ""} to next milestone</p>
            )}
            {atMilestone && (
              <p className="text-amber-800 font-medium">
                {"\uD83C\uDFC6"} Milestone reached!
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
