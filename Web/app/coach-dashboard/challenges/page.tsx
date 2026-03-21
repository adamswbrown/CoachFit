"use client"

import { useState, useEffect, useCallback } from "react"
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

interface ParticipantProgress {
  daysCompleted: number
  totalDays: number
  streak: number
  checkInRate: number
  percentComplete: number
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

function complianceColor(rate: number): string {
  if (rate >= 0.7) return "text-green-600"
  if (rate >= 0.4) return "text-amber-600"
  return "text-red-600"
}

function complianceLabel(rate: number): { label: string; color: string } {
  if (rate >= 0.7) return { label: "On Track", color: "bg-green-100 text-green-700" }
  if (rate >= 0.4) return { label: "Falling Behind", color: "bg-amber-100 text-amber-700" }
  return { label: "At Risk", color: "bg-red-100 text-red-700" }
}

export default function CoachChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [participants, setParticipants] = useState<Record<string, { name: string; progress: ParticipantProgress }[]>>({})
  const [loadingParticipants, setLoadingParticipants] = useState<string | null>(null)

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

  async function toggleExpand(challengeId: string) {
    if (expandedId === challengeId) {
      setExpandedId(null)
      return
    }
    setExpandedId(challengeId)
    if (participants[challengeId]) return

    setLoadingParticipants(challengeId)
    try {
      // Fetch cohort members via cohorts API
      const res = await fetch(`/api/cohorts/${challengeId}/clients`, { credentials: "include" })
      if (!res.ok) return
      const membersData = await res.json()
      const members = Array.isArray(membersData) ? membersData : membersData.data || []

      // Fetch progress for each member
      const progressPromises = members.map(async (m: { id?: string; userId?: string; name?: string; user?: { name?: string } }) => {
        const userId = m.userId || m.id
        if (!userId) return null
        try {
          const pRes = await fetch(`/api/challenges/${challengeId}/progress?clientId=${userId}`, { credentials: "include" })
          if (!pRes.ok) return { name: m.user?.name || m.name || "Unknown", progress: null }
          const pData = await pRes.json()
          return { name: m.user?.name || m.name || "Unknown", progress: pData }
        } catch {
          return { name: m.user?.name || m.name || "Unknown", progress: null }
        }
      })

      const results = (await Promise.all(progressPromises)).filter(Boolean) as { name: string; progress: ParticipantProgress | null }[]
      const withProgress = results
        .filter((r) => r.progress)
        .map((r) => ({ name: r.name, progress: r.progress as ParticipantProgress }))
        .sort((a, b) => a.progress.checkInRate - b.progress.checkInRate) // worst first

      setParticipants((prev) => ({ ...prev, [challengeId]: withProgress }))
    } catch {
      // Silently fail
    } finally {
      setLoadingParticipants(null)
    }
  }

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
              const isExpanded = expandedId === c.id
              const pList = participants[c.id] || []
              return (
                <div key={c.id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(c.id)}
                    className="w-full p-5 text-left hover:bg-neutral-50 transition-colors"
                  >
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
                      <svg
                        className={`w-5 h-5 text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-neutral-100 p-5">
                      <h4 className="text-sm font-medium text-neutral-700 mb-3">Participants</h4>
                      {loadingParticipants === c.id && (
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                          Loading...
                        </div>
                      )}
                      {loadingParticipants !== c.id && pList.length === 0 && (
                        <p className="text-sm text-neutral-400">No participant data available.</p>
                      )}
                      {pList.length > 0 && (
                        <div className="space-y-2">
                          {pList.map((p, i) => {
                            const cl = complianceLabel(p.progress.checkInRate)
                            return (
                              <div key={i} className="flex items-center gap-3 py-2 border-b border-neutral-50 last:border-0">
                                <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-medium text-neutral-600">
                                  {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-neutral-900 truncate">{p.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden max-w-[120px]">
                                      <div
                                        className={`h-full rounded-full ${p.progress.checkInRate >= 0.7 ? "bg-green-500" : p.progress.checkInRate >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                                        style={{ width: `${Math.round(p.progress.checkInRate * 100)}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-medium ${complianceColor(p.progress.checkInRate)}`}>
                                      {Math.round(p.progress.checkInRate * 100)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cl.color}`}>
                                    {cl.label}
                                  </span>
                                  <p className="text-[10px] text-neutral-400 mt-0.5">{p.progress.streak}d streak</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
