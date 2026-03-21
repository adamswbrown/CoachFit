"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ClientLayout } from "@/components/layouts/ClientLayout"

// ─── Types ────────────────────────────────────────────────────────────────────

type CohortType = "TIMED" | "ONGOING" | "CHALLENGE" | "CUSTOM"

interface Challenge {
  id: string
  name: string
  type: CohortType
  coachId: string
  coachName: string
  cohortStartDate: string | null
  durationWeeks: number | null
  durationConfig: Record<string, unknown> | null
  _count: {
    memberships: number
  }
}

interface ActiveEnrollment {
  userId: string
  cohortId: string
  cohort: {
    id: string
    name: string
    type: CohortType
    cohortStartDate: string | null
    durationWeeks: number | null
    coachId: string
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "TBD"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function getChallengeStatus(challenge: Challenge): "open" | "in-progress" | "completed" {
  if (!challenge.cohortStartDate) return "open"
  const start = new Date(challenge.cohortStartDate)
  const now = new Date()
  if (now < start) return "open"

  if (challenge.durationWeeks) {
    const endMs = start.getTime() + challenge.durationWeeks * 7 * 24 * 60 * 60 * 1000
    if (now.getTime() > endMs) return "completed"
  }

  return "in-progress"
}

function StatusBadge({ status }: { status: "open" | "in-progress" | "completed" }) {
  const config = {
    open: { label: "Open", className: "bg-green-100 text-green-700" },
    "in-progress": { label: "In Progress", className: "bg-amber-100 text-amber-700" },
    completed: { label: "Completed", className: "bg-neutral-100 text-neutral-600" },
  }
  const { label, className } = config[status]
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

interface ConfirmDialogProps {
  challengeName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function ConfirmDialog({ challengeName, onConfirm, onCancel, loading }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <h2 className="text-base font-semibold text-neutral-900 mb-2">Join Challenge?</h2>
        <p className="text-sm text-neutral-600 mb-6">
          You are about to join <span className="font-medium">&ldquo;{challengeName}&rdquo;</span>. Are you sure?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Joining&hellip;
              </>
            ) : (
              "Join Challenge"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientChallengesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [challengesLoading, setChallengesLoading] = useState(true)
  const [challengesError, setChallengesError] = useState<string | null>(null)

  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [activeLoading, setActiveLoading] = useState(true)

  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Challenge | null>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null)

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // ── Fetch available challenges ─────────────────────────────────────────────
  const loadChallenges = useCallback(async () => {
    if (!session?.user) return
    setChallengesLoading(true)
    setChallengesError(null)
    try {
      const res = await fetch("/api/challenges", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load challenges")
      const data = await res.json()
      setChallenges(Array.isArray(data) ? data : data.challenges ?? [])
    } catch (err) {
      setChallengesError("Could not load challenges. Please try again.")
      console.error(err)
    } finally {
      setChallengesLoading(false)
    }
  }, [session?.user])

  // ── Fetch active enrollments ────────────────────────────────────────────────
  const loadActive = useCallback(async () => {
    if (!session?.user) return
    setActiveLoading(true)
    try {
      const res = await fetch("/api/challenges/active", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      const items = Array.isArray(data) ? data : data.challenges ?? []
      const ids = new Set<string>(
        items.map((e: ActiveEnrollment | { id: string }) => ("cohortId" in e ? e.cohortId : e.id))
      )
      setEnrolledIds(ids)
    } catch (err) {
      console.error("Could not load active challenges", err)
    } finally {
      setActiveLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    loadChallenges()
    loadActive()
  }, [loadChallenges, loadActive])

  // ── Enroll handler ─────────────────────────────────────────────────────────
  const handleEnroll = async (challenge: Challenge) => {
    setEnrolling(challenge.id)
    setEnrollError(null)
    setEnrollSuccess(null)
    try {
      const res = await fetch(`/api/challenges/${challenge.id}/enroll`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to join challenge.")
      }
      setEnrolledIds((prev) => new Set([...prev, challenge.id]))
      setEnrollSuccess(`You have joined "${challenge.name}"!`)
      setConfirmTarget(null)
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : "Something went wrong.")
      setConfirmTarget(null)
    } finally {
      setEnrolling(null)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <ClientLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-neutral-200 rounded" />
            <div className="h-4 w-72 bg-neutral-100 rounded" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-neutral-200 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </ClientLayout>
    )
  }

  if (!session?.user) return null

  const isLoading = challengesLoading || activeLoading

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Challenges</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Join a challenge to stay consistent and track your progress over time.
          </p>
        </div>

        {/* Success banner */}
        {enrollSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-800">{enrollSuccess}</p>
            <button
              onClick={() => setEnrollSuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800 text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Error banner */}
        {enrollError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>{enrollError}</span>
            <button onClick={() => setEnrollError(null)} className="text-red-600 hover:text-red-800 text-lg leading-none flex-shrink-0">
              &times;
            </button>
          </div>
        )}

        {/* Challenge list */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5 animate-pulse space-y-3">
                <div className="h-5 w-40 bg-neutral-200 rounded" />
                <div className="h-4 w-24 bg-neutral-100 rounded" />
                <div className="h-4 w-32 bg-neutral-100 rounded" />
                <div className="h-9 w-full bg-neutral-200 rounded-lg mt-4" />
              </div>
            ))}
          </div>
        ) : challengesError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {challengesError}
          </div>
        ) : challenges.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
            <svg className="w-12 h-12 text-neutral-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
            <p className="text-sm font-medium text-neutral-700">No challenges available right now</p>
            <p className="text-xs text-neutral-500 mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {challenges.map((challenge) => {
              const challengeStatus = getChallengeStatus(challenge)
              const isEnrolled = enrolledIds.has(challenge.id)

              return (
                <div
                  key={challenge.id}
                  className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col hover:border-neutral-300 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-neutral-900 leading-snug flex-1">
                      {challenge.name}
                    </h3>
                    <StatusBadge status={challengeStatus} />
                  </div>

                  {/* Meta info */}
                  <div className="space-y-1.5 mb-4 flex-1">
                    {challenge.durationWeeks && (
                      <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {challenge.durationWeeks} {challenge.durationWeeks === 1 ? "week" : "weeks"}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Starts {formatDate(challenge.cohortStartDate)}
                    </p>
                    <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      {(challenge as any)._count?.memberships ?? (challenge as any).memberCount ?? 0} enrolled
                    </p>
                    {challenge.coachName && (
                      <p className="text-xs text-neutral-400">
                        by {challenge.coachName}
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  {isEnrolled ? (
                    <Link
                      href={`/client-dashboard/challenges/${challenge.id}`}
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-medium border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors text-center"
                    >
                      View Progress
                    </Link>
                  ) : challengeStatus === "completed" ? (
                    <button
                      disabled
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-medium border border-neutral-200 text-neutral-400 cursor-not-allowed"
                    >
                      Challenge Ended
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmTarget(challenge)}
                      disabled={enrolling === challenge.id}
                      className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Join Challenge
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirm enrollment dialog */}
      {confirmTarget && (
        <ConfirmDialog
          challengeName={confirmTarget.name}
          loading={enrolling === confirmTarget.id}
          onConfirm={() => handleEnroll(confirmTarget)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </ClientLayout>
  )
}
