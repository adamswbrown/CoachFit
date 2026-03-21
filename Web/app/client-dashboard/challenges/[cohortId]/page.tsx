"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { ClientLayout } from "@/components/layouts/ClientLayout"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressData {
  daysCompleted: number
  totalDays: number
  streak: number
  weeklyEntries: Record<string, number>
  checkInRate: number
  percentComplete: number
}

interface ActiveChallenge {
  userId: string
  cohortId: string
  cohort: {
    id: string
    name: string
    type: string
    cohortStartDate: string | null
    durationWeeks: number | null
    coachId: string
  }
}

// ─── Progress Ring Component ──────────────────────────────────────────────────

function ProgressRing({
  percent,
  size = 160,
  strokeWidth = 10,
}: {
  percent: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-neutral-200"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-green-500"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  )
}

// ─── Streak Calendar Component ────────────────────────────────────────────────

function StreakCalendar({
  cohortStartDate,
  durationWeeks,
  weeklyEntries,
}: {
  cohortStartDate: string | null
  durationWeeks: number | null
  weeklyEntries: Record<string, number>
}) {
  if (!cohortStartDate || !durationWeeks) {
    return (
      <p className="text-sm text-neutral-400 italic">Calendar unavailable — start date not set.</p>
    )
  }

  const start = new Date(cohortStartDate)
  // Align to Monday of the start week
  const dayOfWeek = start.getDay() // 0=Sun, 1=Mon...
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(start)
  weekStart.setDate(start.getDate() + offsetToMonday)

  const totalDays = durationWeeks * 7
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build a set of "days with entries" from weeklyEntries
  // weeklyEntries is { [weekNum: string]: entryCount }
  // We'll mark days per week based on the count (first N days of each week)
  const checkedDayIndices = new Set<number>()
  Object.entries(weeklyEntries).forEach(([weekNumStr, count]) => {
    const weekNum = parseInt(weekNumStr, 10) - 1 // 0-indexed
    const weekOffset = weekNum * 7
    for (let d = 0; d < Math.min(count, 7); d++) {
      checkedDayIndices.add(weekOffset + d)
    }
  })

  const weeks: { date: Date; index: number }[][] = []
  for (let w = 0; w < durationWeeks; w++) {
    const week: { date: Date; index: number }[] = []
    for (let d = 0; d < 7; d++) {
      const dayIndex = w * 7 + d
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + dayIndex)
      week.push({ date, index: dayIndex })
    }
    weeks.push(week)
  }

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]

  return (
    <div className="overflow-x-auto">
      {/* Day labels */}
      <div className="flex gap-1 mb-1 ml-0">
        {DAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="w-6 h-4 flex items-center justify-center text-[10px] font-medium text-neutral-400"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="space-y-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex gap-1">
            {week.map(({ date, index }) => {
              const cellDate = new Date(date)
              cellDate.setHours(0, 0, 0, 0)
              const isFuture = cellDate > today
              const isToday = cellDate.getTime() === today.getTime()
              const hasEntry = checkedDayIndices.has(index)

              let bg = "bg-neutral-100"
              if (!isFuture && hasEntry) bg = "bg-green-500"
              else if (!isFuture && !hasEntry) bg = "bg-neutral-200"

              return (
                <div
                  key={index}
                  title={cellDate.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                  className={`w-6 h-6 rounded-sm flex-shrink-0 ${bg} ${
                    isToday ? "ring-2 ring-green-600 ring-offset-1" : ""
                  }`}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-xs text-neutral-500">Checked in</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-neutral-200" />
          <span className="text-xs text-neutral-500">Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-neutral-100" />
          <span className="text-xs text-neutral-500">Upcoming</span>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subvalue,
  showBar,
  barPercent,
}: {
  label: string
  value: string | number
  subvalue?: string
  showBar?: boolean
  barPercent?: number
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <p className="text-xs font-medium text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      {subvalue && <p className="text-xs text-neutral-400 mt-0.5">{subvalue}</p>}
      {showBar && barPercent !== undefined && (
        <div className="mt-2 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(barPercent, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChallengeDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const cohortId = params?.cohortId as string

  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [progressLoading, setProgressLoading] = useState(true)
  const [progressError, setProgressError] = useState<string | null>(null)

  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null)
  const [challengeLoading, setChallengeLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // ── Fetch progress ─────────────────────────────────────────────────────────
  const loadProgress = useCallback(async () => {
    if (!session?.user || !cohortId) return
    setProgressLoading(true)
    setProgressError(null)
    try {
      const res = await fetch(`/api/challenges/${cohortId}/progress`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to load progress")
      const data: ProgressData = await res.json()
      setProgress(data)
    } catch (err) {
      setProgressError("Could not load your challenge progress.")
      console.error(err)
    } finally {
      setProgressLoading(false)
    }
  }, [session?.user, cohortId])

  // ── Fetch challenge details from active/history ────────────────────────────
  const loadChallenge = useCallback(async () => {
    if (!session?.user || !cohortId) return
    setChallengeLoading(true)
    try {
      // Try active first, then history
      const [activeRes, historyRes] = await Promise.all([
        fetch("/api/challenges/active", { credentials: "include" }),
        fetch("/api/challenges/history", { credentials: "include" }),
      ])
      const activeRaw = activeRes.ok ? await activeRes.json() : []
      const historyRaw = historyRes.ok ? await historyRes.json() : []

      // Agent 3 returns arrays of ChallengeWithMembership objects (id, name, cohortStartDate, ...)
      // Map to the shape this component expects
      const mapToActive = (items: any[]): ActiveChallenge[] =>
        items.map((c: any) => ({
          userId: "",
          cohortId: c.id,
          cohort: {
            id: c.id,
            name: c.name,
            type: "CHALLENGE",
            cohortStartDate: c.cohortStartDate,
            durationWeeks: c.durationWeeks,
            coachId: c.coachId,
          },
        }))

      const activeItems = Array.isArray(activeRaw) ? activeRaw : activeRaw.challenges ?? []
      const historyItems = Array.isArray(historyRaw) ? historyRaw : historyRaw.challenges ?? []

      const allChallenges: ActiveChallenge[] = [
        ...mapToActive(activeItems),
        ...mapToActive(historyItems),
      ]
      const found = allChallenges.find((c) => c.cohortId === cohortId)
      if (found) {
        setChallenge(found)
      } else {
        setUnauthorized(true)
      }
    } catch (err) {
      console.error("Could not load challenge details", err)
    } finally {
      setChallengeLoading(false)
    }
  }, [session?.user, cohortId])

  useEffect(() => {
    loadProgress()
    loadChallenge()
  }, [loadProgress, loadChallenge])

  // ── Computed values ────────────────────────────────────────────────────────
  const isCompleted = (() => {
    if (!challenge?.cohort.cohortStartDate || !challenge?.cohort.durationWeeks) return false
    const start = new Date(challenge.cohort.cohortStartDate)
    const endMs = start.getTime() + challenge.cohort.durationWeeks * 7 * 24 * 60 * 60 * 1000
    return Date.now() > endMs
  })()

  const currentWeek = (() => {
    if (!challenge?.cohort.cohortStartDate) return 1
    const start = new Date(challenge.cohort.cohortStartDate)
    const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
    return Math.min(Math.max(Math.ceil((diffDays + 1) / 7), 1), challenge.cohort.durationWeeks ?? 1)
  })()

  const daysRemaining = (() => {
    if (!progress) return 0
    return Math.max(progress.totalDays - progress.daysCompleted, 0)
  })()

  // ── Loading state ──────────────────────────────────────────────────────────
  if (status === "loading" || challengeLoading) {
    return (
      <ClientLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="animate-pulse space-y-5">
            <div className="h-6 w-48 bg-neutral-200 rounded" />
            <div className="h-48 bg-neutral-200 rounded-xl" />
            <div className="h-36 bg-neutral-200 rounded-xl" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-neutral-200 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </ClientLayout>
    )
  }

  if (!session?.user) return null

  if (unauthorized) {
    return (
      <ClientLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
            <p className="text-sm font-medium text-neutral-700">This challenge is not your active challenge.</p>
            <Link href="/client-dashboard/challenges" className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block">
              &larr; Back to Challenges
            </Link>
          </div>
        </div>
      </ClientLayout>
    )
  }

  return (
    <ClientLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Back link */}
        <Link
          href="/client-dashboard/challenges"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          All Challenges
        </Link>

        {/* Challenge title */}
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">
            {challenge?.cohort.name ?? "Challenge"}
          </h1>
          {challenge?.cohort.durationWeeks && (
            <p className="text-sm text-neutral-500 mt-1">
              {challenge.cohort.durationWeeks}-week challenge
            </p>
          )}
        </div>

        {/* Completed banner */}
        {isCompleted && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-base font-semibold text-green-800">Challenge Complete!</p>
            <p className="text-sm text-green-700 mt-1">
              Congratulations on completing the challenge!
            </p>
          </div>
        )}

        {/* Error state */}
        {progressError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {progressError}
          </div>
        )}

        {/* ── Hero Section ────────────────────────────────────────────────── */}
        {progressLoading ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col items-center animate-pulse">
            <div className="w-40 h-40 bg-neutral-200 rounded-full mb-4" />
            <div className="h-5 w-32 bg-neutral-200 rounded mb-2" />
            <div className="h-4 w-24 bg-neutral-100 rounded" />
          </div>
        ) : progress ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col items-center">
            {/* Progress ring */}
            <div className="relative mb-4">
              <ProgressRing
                percent={Math.min(progress.percentComplete, 100)}
                size={160}
                strokeWidth={12}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-neutral-900">
                  {Math.round(progress.percentComplete)}%
                </span>
                <span className="text-xs text-neutral-500">complete</span>
              </div>
            </div>

            {/* Week & days info */}
            <p className="text-base font-semibold text-neutral-900">
              Week {currentWeek} of {challenge?.cohort.durationWeeks ?? "?"}
            </p>
            <p className="text-sm text-neutral-500 mt-0.5">
              {daysRemaining > 0 ? `${daysRemaining} days remaining` : "Challenge finished"}
            </p>

            {/* Streak + total check-ins */}
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neutral-100 w-full justify-center">
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-900">
                  {progress.streak}-day streak 🔥
                </p>
                <p className="text-xs text-neutral-500">Current streak</p>
              </div>
              <div className="w-px h-8 bg-neutral-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-900">
                  {progress.daysCompleted}/{progress.totalDays}
                </p>
                <p className="text-xs text-neutral-500">Total check-ins</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Streak Calendar ─────────────────────────────────────────────── */}
        {challenge && (
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Check-in Calendar</h2>
            <StreakCalendar
              cohortStartDate={challenge.cohort.cohortStartDate}
              durationWeeks={challenge.cohort.durationWeeks}
              weeklyEntries={progress?.weeklyEntries ?? {}}
            />
          </div>
        )}

        {/* ── Quick Stats ─────────────────────────────────────────────────── */}
        {progress && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              label="Check-in Rate"
              value={`${Math.round(progress.checkInRate * 100)}%`}
              showBar
              barPercent={Math.round(progress.checkInRate * 100)}
            />
            <StatCard
              label="Current Streak"
              value={progress.streak}
              subvalue={progress.streak === 1 ? "day" : "days"}
            />
            <StatCard
              label="Days Checked In"
              value={progress.daysCompleted}
              subvalue={`of ${progress.totalDays} days`}
            />
          </div>
        )}
      </div>
    </ClientLayout>
  )
}
