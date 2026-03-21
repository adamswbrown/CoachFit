"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface Challenge {
  id: string
  name: string
  coachId: string
  cohortStartDate: string | null
  durationWeeks: number | null
  durationConfig: string
  memberCount: number
}

function getChallengeStatus(c: Challenge): { label: string; color: string } {
  if (!c.cohortStartDate) return { label: "Draft", color: "bg-neutral-100 text-neutral-600" }
  const start = new Date(c.cohortStartDate)
  const now = new Date()
  const weeks = c.durationWeeks ?? 6
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7)
  if (now < start) return { label: "Registration Open", color: "bg-blue-100 text-blue-700" }
  if (now > end) return { label: "Completed", color: "bg-neutral-100 text-neutral-600" }
  const elapsed = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000)) + 1
  return { label: `Week ${elapsed} of ${weeks}`, color: "bg-green-100 text-green-700" }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Not set"
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default function CoachChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchChallenges = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/challenges", { credentials: "include" })
      if (!res.ok) throw new Error("Fetch failed")
      const data = await res.json()
      setChallenges(Array.isArray(data) ? data : [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchChallenges() }, [fetchChallenges])

  return (
    <CoachLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Challenges</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Manage challenge cohorts and track participant progress.</p>
          </div>
          <a
            href="/cohorts"
            className="px-3 py-2 text-sm font-medium border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-lg"
          >
            Create Challenge
          </a>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-neutral-200 p-5 animate-pulse">
                <div className="h-5 w-48 bg-neutral-200 rounded mb-2" />
                <div className="h-4 w-64 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center">
            <p className="text-sm text-red-600 mb-2">Failed to load challenges.</p>
            <button onClick={fetchChallenges} className="text-sm text-neutral-600 underline hover:no-underline">Try again</button>
          </div>
        )}

        {!loading && !error && challenges.length === 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
            <p className="text-neutral-500 mb-3">No challenge cohorts yet.</p>
            <a href="/cohorts" className="text-sm font-medium text-green-600 hover:text-green-700">
              Create your first challenge →
            </a>
          </div>
        )}

        {!loading && !error && challenges.length > 0 && (
          <div className="space-y-3">
            {challenges.map((c) => {
              const status = getChallengeStatus(c)
              return (
                <div key={c.id} className="bg-white rounded-xl border border-neutral-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-neutral-900">{c.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-500">
                        {c.durationWeeks ?? 6} weeks &middot; Starts {formatDate(c.cohortStartDate)} &middot; {c.memberCount} enrolled
                      </p>
                    </div>
                    <Link
                      href={`/coach-dashboard/weekly-review?cohortId=${c.id}`}
                      className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Review Participants
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
