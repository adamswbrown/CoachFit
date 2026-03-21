"use client"

import { useState, useEffect, useCallback, Fragment, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { CoachNoteEditor } from "@/components/coach/CoachNoteEditor"
import { generateWeeklyEmailDraft } from "@/lib/utils/email-draft"
import { Role } from "@/lib/types"

// ── Cohorts Tab Types ──

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

// ── Weekly Review Tab Types ──

type AdherenceThresholds = {
  greenMinimum: number
  amberMinimum: number
}

type AttentionMissedCheckinsPolicy = "option_a" | "option_b"

type SortKey =
  | "priority"
  | "name"
  | "checkIns"
  | "score"
  | "streak"
  | "lastCheckIn"
  | "lastEvaluated"

interface ClientStreak {
  clientId: string
  currentStreak: number
  daysSinceLastCheckIn: number
  status: "green" | "amber" | "red"
}

const DEFAULT_ADHERENCE: AdherenceThresholds = {
  greenMinimum: 6,
  amberMinimum: 3,
}

interface ClientSummary {
  clientId: string
  name: string | null
  email: string
  stats: {
    checkInCount: number
    checkInRate: number
    expectedCheckIns?: number
    effectiveCheckInFrequencyDays?: number
    avgWeight: number | null
    weightTrend: number | null
    avgSteps: number | null
    avgCalories: number | null
    avgSleepMins: number | null
  }
  lastCheckInDate: string | null
}

interface WeeklySummariesResponse {
  weekStart: string
  weekEnd: string
  clients: ClientSummary[]
}

interface WeeklyResponse {
  loomUrl?: string | null
  note?: string | null
}

interface CohortOption {
  id: string
  name: string
  coachId: string
  coachName: string | null
  coachEmail: string
  type: string | null
  cohortStartDate: string | null
}

interface ChallengeProgressData {
  daysCompleted: number
  totalDays: number
  streak: number
  checkInRate: number
  percentComplete: number
}

interface OwnerOption {
  id: string
  name: string | null
  email: string
}

interface ClientAttention {
  clientId: string
  name: string | null
  email: string
  attentionScore: {
    score: number
    priority: string // "red" | "amber" | "green"
    reasons: string[]
    calculatedAt: string
  } | null
  topInsights: Array<{
    id: string
    title: string
    description: string
    priority: string
    icon: string
  }>
}

// ── Cohorts Tab Helpers ──

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

function formatCohortDate(dateStr: string | null): string {
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

// ── Weekly Review Tab Helpers ──

/**
 * Determine priority based on attention score + adherence check
 * This ensures clients who haven't checked in don't show as "on track"
 */
function getDisplayPriority(
  attention: { score: number; priority: string } | null,
  checkInCount: number,
  expectedCheckIns: number,
  thresholds: AdherenceThresholds,
  missedCheckinsPolicy: AttentionMissedCheckinsPolicy
): "red" | "amber" | "green" {
  const greenThreshold = Math.max(
    1,
    Math.ceil((thresholds.greenMinimum / 7) * expectedCheckIns)
  )
  const amberThreshold = Math.max(
    0,
    Math.ceil((thresholds.amberMinimum / 7) * expectedCheckIns)
  )

  // If adherence is critically low, always red (overrides attention)
  if (checkInCount < amberThreshold) {
    return "red"
  }

  const missedCheckIns = Math.max(0, expectedCheckIns - checkInCount)
  if (missedCheckinsPolicy === "option_b" && missedCheckIns >= 1) {
    return "red"
  }

  if (missedCheckinsPolicy === "option_a") {
    if (missedCheckIns >= 2) return "red"
    if (missedCheckIns === 1) {
      if (attention?.priority === "red") return "red"
      return "amber"
    }
  }

  // If no attention score, use adherence check
  if (!attention) {
    if (checkInCount >= greenThreshold) return "green"
    return "amber"
  }

  // Otherwise use attention priority
  return attention.priority as "red" | "amber" | "green"
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0]
}

function getConfidenceLabel(attention: ClientAttention["attentionScore"] | null): string {
  if (!attention) return "\u2014"
  const signalCount = attention.reasons.length
  if (signalCount >= 3) return "High"
  if (signalCount === 2) return "Medium"
  if (signalCount === 1) return "Low"
  return "\u2014"
}

function formatDateTime(value: string | null): string {
  if (!value) return "\u2014"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "\u2014"
  return parsed.toLocaleString()
}

/**
 * Calculate the current challenge week number from cohort start date and selected week.
 * Returns 1-based week number, or null if cohort has no start date or selected week is before start.
 */
function getChallengeWeekNumber(cohortStartDate: string | null, selectedWeekStart: string): number | null {
  if (!cohortStartDate) return null
  const start = new Date(cohortStartDate)
  const selected = new Date(selectedWeekStart)
  start.setHours(0, 0, 0, 0)
  selected.setHours(0, 0, 0, 0)
  const diffMs = selected.getTime() - start.getTime()
  if (diffMs < 0) return null
  return Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1
}

// ══════════════════════════════════════════════════════════════════════
// Tab 1: Cohorts content (the ENTIRE existing challenges page content)
// ══════════════════════════════════════════════════════════════════════

function CohortsTabContent() {
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
    <>
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
            Create your first challenge &rarr;
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
                        {c.durationWeeks ?? 6} weeks &middot; Starts {formatCohortDate(c.cohortStartDate)} &middot; {c.memberCount} enrolled
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
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Tab 2: Weekly Review content (the ENTIRE existing weekly-review page)
// ══════════════════════════════════════════════════════════════════════

function WeeklyReviewTabContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const isAdmin = session?.user?.roles?.includes(Role.ADMIN) ?? false
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<WeeklySummariesResponse | null>(null)
  const [attentionData, setAttentionData] = useState<ClientAttention[]>([])
  const [adherence, setAdherence] = useState<AdherenceThresholds>(DEFAULT_ADHERENCE)
  const [missedCheckinsPolicy, setMissedCheckinsPolicy] =
    useState<AttentionMissedCheckinsPolicy>("option_a")
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>("")
  const [loomUrls, setLoomUrls] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savingClient, setSavingClient] = useState<string | null>(null)
  const [copiedClient, setCopiedClient] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<"all" | "red" | "amber" | "green">("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("priority")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([])
  const [cohortOptions, setCohortOptions] = useState<CohortOption[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("")
  const [selectedCohortId, setSelectedCohortId] = useState<string>("")
  const [questionnaireStatus, setQuestionnaireStatus] = useState<Record<string, {
    weekNumber: number
    status: string
    updatedAt: string
    submittedAt?: string | null
  }[]>>({})
  const [streakData, setStreakData] = useState<Record<string, ClientStreak>>({})
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderToast, setReminderToast] = useState<string | null>(null)
  const [bulkToast, setBulkToast] = useState<string | null>(null)
  const [challengeProgressData, setChallengeProgressData] = useState<Record<string, ChallengeProgressData>>({})
  const [respondingToClient, setRespondingToClient] = useState<string | null>(null)
  const [sharedNotesByClient, setSharedNotesByClient] = useState<Record<string, any[]>>({})
  const isChallengeSelected = (() => {
    if (!selectedCohortId) return false
    const selected = cohortOptions.find((c) => c.id === selectedCohortId)
    return selected?.type === "CHALLENGE"
  })()

  // Initialize week on mount + read cohortId from URL
  useEffect(() => {
    setSelectedWeekStart(formatDateISO(getMonday(new Date())))
    const urlCohortId = searchParams.get("cohortId")
    if (urlCohortId) {
      setSelectedCohortId(urlCohortId)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    const fetchOwners = async () => {
      try {
        const res = await fetch("/api/admin/coaches")
        if (!res.ok) return
        const data = await res.json()
        setOwnerOptions(data.coaches || [])
      } catch (err) {
        console.error("Failed to fetch coach owners", err)
      }
    }

    fetchOwners()
  }, [isAdmin])

  useEffect(() => {
    const fetchCohorts = async () => {
      try {
        const params = new URLSearchParams()
        if (isAdmin && selectedOwnerId) {
          params.set("ownerId", selectedOwnerId)
        }
        const res = await fetch(`/api/cohorts${params.toString() ? `?${params.toString()}` : ""}`)
        if (!res.ok) return
        const data = await res.json()
        setCohortOptions(data || [])
      } catch (err) {
        console.error("Failed to fetch cohorts", err)
      }
    }

    fetchCohorts()
  }, [isAdmin, selectedOwnerId])

  useEffect(() => {
    setSelectedCohortId("")
  }, [selectedOwnerId])

  // Fetch challenge progress when a CHALLENGE cohort is selected
  useEffect(() => {
    if (!isChallengeSelected || !selectedCohortId) {
      setChallengeProgressData({})
      return
    }

    const fetchChallengeProgress = async () => {
      try {
        const res = await fetch(`/api/challenges/${selectedCohortId}/progress/batch`)
        if (res.ok) {
          const data = await res.json()
          setChallengeProgressData(data.progress || {})
        }
      } catch (err) {
        console.error("Failed to fetch challenge progress:", err)
      }
    }
    fetchChallengeProgress()
  }, [selectedCohortId, isChallengeSelected])

  // Fetch adherence thresholds (coach-accessible)
  useEffect(() => {
    const fetchAdherence = async () => {
      try {
        const res = await fetch("/api/coach-dashboard/adherence-settings")
        if (!res.ok) return
        const data = await res.json()
        const green = data?.data?.adherenceGreenMinimum
        const amber = data?.data?.adherenceAmberMinimum
        const policy = data?.data?.attentionMissedCheckinsPolicy

        if (typeof green === "number" && typeof amber === "number") {
          setAdherence({
            greenMinimum: green,
            amberMinimum: amber,
          })
        }
        if (policy === "option_a" || policy === "option_b") {
          setMissedCheckinsPolicy(policy)
        }
      } catch (err) {
        console.error("Failed to fetch adherence settings", err)
      }
    }

    fetchAdherence()
  }, [])

  // Fetch weekly summaries and attention data when week is selected
  useEffect(() => {
    if (!selectedWeekStart) return

    const doFetch = async () => {
      setLoading(true)
      try {
        // Fetch summaries
        const summaryParams = new URLSearchParams({ weekStart: selectedWeekStart })
        if (selectedCohortId) {
          summaryParams.set("cohortId", selectedCohortId)
        } else if (isAdmin && selectedOwnerId) {
          summaryParams.set("ownerId", selectedOwnerId)
        }
        const res = await fetch(
          `/api/coach-dashboard/weekly-summaries?${summaryParams.toString()}`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const responseData: WeeklySummariesResponse = await res.json()
        setData(responseData)

        // Fetch attention scores in parallel
        const attentionRes = await fetch(
          `/api/coach-dashboard/client-attention-scores`
        )
        let attention: ClientAttention[] = []
        if (attentionRes.ok) {
          const attentionResponse = await attentionRes.json()
          attention = attentionResponse.data || []
        }
        setAttentionData(attention)

        // Fetch existing responses for each client
        const newLoomUrls: Record<string, string> = {}
        const newNotes: Record<string, string> = {}

        for (const client of responseData.clients) {
          try {
            const responseRes = await fetch(
              `/api/coach-dashboard/weekly-response?clientId=${client.clientId}&weekStart=${selectedWeekStart}`
            )
            if (responseRes.ok) {
              const response: WeeklyResponse = await responseRes.json()
              if (response.loomUrl) {
                newLoomUrls[client.clientId] = response.loomUrl
              }
              if (response.note) {
                newNotes[client.clientId] = response.note
              }
            }
          } catch (err) {
            console.error(`Error fetching response for client ${client.clientId}:`, err)
          }
        }

        setLoomUrls(newLoomUrls)
        setNotes(newNotes)

        // Fetch questionnaire status for all clients
        try {
          const questionnaireParams = new URLSearchParams()
          if (selectedCohortId) {
            questionnaireParams.set("cohortId", selectedCohortId)
          }
          const questionnaireRes = await fetch(
            `/api/coach/weekly-questionnaire-status${questionnaireParams.toString() ? `?${questionnaireParams.toString()}` : ""}`
          )
          if (questionnaireRes.ok) {
            const questionnaireData = await questionnaireRes.json()

            // Group by userId
            const statusByUser: Record<string, any[]> = {}
            questionnaireData.responses?.forEach((resp: any) => {
              if (!statusByUser[resp.userId]) {
                statusByUser[resp.userId] = []
              }
              statusByUser[resp.userId].push({
                weekNumber: resp.weekNumber,
                status: resp.status,
                updatedAt: resp.updatedAt,
                submittedAt: resp.submittedAt,
              })
            })
            setQuestionnaireStatus(statusByUser)
          }
        } catch (err) {
          console.error('Failed to fetch questionnaire status:', err)
        }

        // Fetch client streaks
        try {
          const streakRes = await fetch(`/api/coach-dashboard/client-streaks`)
          if (streakRes.ok) {
            const streakResponse = await streakRes.json()
            const streakByClient: Record<string, ClientStreak> = {}
            for (const s of streakResponse.clients || []) {
              streakByClient[s.clientId] = s
            }
            setStreakData(streakByClient)
          }
        } catch (err) {
          console.error('Failed to fetch client streaks:', err)
        }

        // Fetch shared notes for each client to show "Responded" indicator
        try {
          const selectedCohort = cohortOptions.find((c) => c.id === selectedCohortId)
          const weekNum = getChallengeWeekNumber(selectedCohort?.cohortStartDate ?? null, selectedWeekStart)
          const sharedNotesMap: Record<string, any[]> = {}

          await Promise.all(
            responseData.clients.map(async (client) => {
              try {
                const notesRes = await fetch(
                  `/api/clients/${client.clientId}/coach-notes`
                )
                if (notesRes.ok) {
                  const allNotes = await notesRes.json()
                  const notesArr = Array.isArray(allNotes) ? allNotes : []
                  const shared = notesArr.filter(
                    (n: any) =>
                      n.sharedWithClient === true &&
                      (weekNum === null || n.weekNumber === weekNum)
                  )
                  if (shared.length > 0) {
                    sharedNotesMap[client.clientId] = shared
                  }
                }
              } catch (err) {
                console.error(`Failed to fetch shared notes for ${client.clientId}:`, err)
              }
            })
          )

          setSharedNotesByClient(sharedNotesMap)
        } catch (err) {
          console.error('Failed to fetch shared notes:', err)
        }
      } catch (err) {
        console.error("Error fetching data:", err)
        setData(null)
        setAttentionData([])
      } finally {
        setLoading(false)
      }
    }

    doFetch()
  }, [selectedWeekStart, selectedCohortId, selectedOwnerId, isAdmin])

  const handleSaveResponse = async (clientId: string) => {
    setSavingClient(clientId)
    try {
      const res = await fetch(`/api/coach-dashboard/weekly-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          weekStart: selectedWeekStart,
          loomUrl: loomUrls[clientId] || null,
          note: notes[clientId] || null,
        }),
      })

      if (res.ok) {
        setTimeout(() => setSavingClient(null), 1000)
      }
    } catch (err) {
      console.error("Error saving weekly response:", err)
      setSavingClient(null)
    }
  }

  const handleCopyEmail = (client: ClientSummary) => {
    const emailDraft = generateWeeklyEmailDraft({
      clientName: client.name,
      weekStart: selectedWeekStart,
      stats: client.stats,
      loomUrl: loomUrls[client.clientId],
    })

    navigator.clipboard.writeText(emailDraft)
    setCopiedClient(client.clientId)
    setTimeout(() => setCopiedClient(null), 2000)
  }

  const handleWeekChange = (direction: "prev" | "next") => {
    const currentDate = new Date(selectedWeekStart)
    if (direction === "prev") {
      currentDate.setDate(currentDate.getDate() - 7)
    } else {
      currentDate.setDate(currentDate.getDate() + 7)
    }
    setSelectedWeekStart(formatDateISO(getMonday(currentDate)))
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
        const summaryParams = new URLSearchParams({ weekStart: selectedWeekStart })
        if (selectedCohortId) {
          summaryParams.set("cohortId", selectedCohortId)
        } else if (isAdmin && selectedOwnerId) {
          summaryParams.set("ownerId", selectedOwnerId)
        }
        const res = await fetch(
          `/api/coach-dashboard/weekly-summaries?${summaryParams.toString()}`
        )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const responseData: WeeklySummariesResponse = await res.json()
      setData(responseData)

      // Fetch attention scores
      const attentionRes = await fetch(
        `/api/coach-dashboard/client-attention-scores?refresh=1`
      )
      let attention: ClientAttention[] = []
      if (attentionRes.ok) {
        const attentionResponse = await attentionRes.json()
        attention = attentionResponse.data || []
      }
      setAttentionData(attention)

      // Fetch existing responses for each client
      const newLoomUrls: Record<string, string> = {}
      const newNotes: Record<string, string> = {}

      for (const client of responseData.clients) {
        try {
          const responseRes = await fetch(
            `/api/coach-dashboard/weekly-response?clientId=${client.clientId}&weekStart=${selectedWeekStart}`
          )
          if (responseRes.ok) {
            const response: WeeklyResponse = await responseRes.json()
            if (response.loomUrl) {
              newLoomUrls[client.clientId] = response.loomUrl
            }
            if (response.note) {
              newNotes[client.clientId] = response.note
            }
          }
        } catch (err) {
          console.error(`Error fetching response for client ${client.clientId}:`, err)
        }
      }

      setLoomUrls(newLoomUrls)
      setNotes(newNotes)

      // Fetch questionnaire status for all clients
      try {
        const questionnaireParams = new URLSearchParams()
        if (selectedCohortId) {
          questionnaireParams.set("cohortId", selectedCohortId)
        }
        const questionnaireRes = await fetch(
          `/api/coach/weekly-questionnaire-status${questionnaireParams.toString() ? `?${questionnaireParams.toString()}` : ""}`
        )
        if (questionnaireRes.ok) {
          const questionnaireData = await questionnaireRes.json()

          // Group by userId
          const statusByUser: Record<string, any[]> = {}
          questionnaireData.responses?.forEach((resp: any) => {
            if (!statusByUser[resp.userId]) {
              statusByUser[resp.userId] = []
            }
            statusByUser[resp.userId].push({
              weekNumber: resp.weekNumber,
              status: resp.status,
              updatedAt: resp.updatedAt,
              submittedAt: resp.submittedAt,
            })
          })
          setQuestionnaireStatus(statusByUser)
        }
      } catch (err) {
        console.error('Failed to fetch questionnaire status:', err)
      }

      // Fetch client streaks
      try {
        const streakRes = await fetch(`/api/coach-dashboard/client-streaks`)
        if (streakRes.ok) {
          const streakResponse = await streakRes.json()
          const streakByClient: Record<string, ClientStreak> = {}
          for (const s of streakResponse.clients || []) {
            streakByClient[s.clientId] = s
          }
          setStreakData(streakByClient)
        }
      } catch (err) {
        console.error('Failed to fetch client streaks:', err)
      }

      // Fetch shared notes for responded indicator
      try {
        const selectedCohort = cohortOptions.find((c) => c.id === selectedCohortId)
        const weekNum = getChallengeWeekNumber(selectedCohort?.cohortStartDate ?? null, selectedWeekStart)
        const sharedNotesMap: Record<string, any[]> = {}

        await Promise.all(
          responseData.clients.map(async (client) => {
            try {
              const notesRes = await fetch(
                `/api/clients/${client.clientId}/coach-notes`
              )
              if (notesRes.ok) {
                const allNotes = await notesRes.json()
                const notesArr = Array.isArray(allNotes) ? allNotes : []
                const shared = notesArr.filter(
                  (n: any) =>
                    n.sharedWithClient === true &&
                    (weekNum === null || n.weekNumber === weekNum)
                )
                if (shared.length > 0) {
                  sharedNotesMap[client.clientId] = shared
                }
              }
            } catch (err) {
              console.error(`Failed to fetch shared notes for ${client.clientId}:`, err)
            }
          })
        )

        setSharedNotesByClient(sharedNotesMap)
      } catch (err) {
        console.error('Failed to fetch shared notes:', err)
      }
    } catch (err) {
      console.error("Error recalculating:", err)
    } finally {
      setRecalculating(false)
    }
  }

  const handleSendQuestionnaireReminder = async (cohortId: string, weekNumber: number) => {
    setSendingReminder(true)
    try {
      const res = await fetch('/api/coach-dashboard/send-questionnaire-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cohortId, weekNumber }),
      })

      if (res.ok) {
        const data = await res.json()
        setReminderToast(`Sent reminder to ${data.sent} client(s)`)
        setTimeout(() => setReminderToast(null), 3000)
      } else {
        const error = await res.json()
        setReminderToast(error.error || 'Failed to send reminders')
        setTimeout(() => setReminderToast(null), 3000)
      }
    } catch (err) {
      console.error('Error sending reminders:', err)
      setReminderToast('Failed to send reminders')
      setTimeout(() => setReminderToast(null), 3000)
    } finally {
      setSendingReminder(false)
    }
  }

  // Derive a display priority for a client using attention (if available) and adherence thresholds
  const getClientPriority = (client: ClientSummary): "red" | "amber" | "green" => {
    const attention = attentionData.find((att) => att.clientId === client.clientId)
    return getDisplayPriority(
      attention?.attentionScore || null,
      client.stats.checkInCount,
      client.stats.expectedCheckIns ?? 7,
      adherence,
      missedCheckinsPolicy
    )
  }

  // Summaries for the priority cards
  const getSummary = () => {
    if (!data) return { red: 0, amber: 0, green: 0, total: 0 }

    const counts = { red: 0, amber: 0, green: 0 }
    for (const client of data.clients) {
      const priority = getClientPriority(client)
      counts[priority] += 1
    }

    return { ...counts, total: data.clients.length }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    if (key === "score" || key === "lastCheckIn" || key === "lastEvaluated") {
      setSortDirection("desc")
    } else {
      setSortDirection("asc")
    }
  }

  const handleToggleSelection = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    )
  }

  const handleToggleSelectAll = (clientIds: string[]) => {
    const allSelected = clientIds.length > 0 && clientIds.every((id) => selectedClientIds.includes(id))
    if (allSelected) {
      setSelectedClientIds((prev) => prev.filter((id) => !clientIds.includes(id)))
    } else {
      setSelectedClientIds((prev) => Array.from(new Set([...prev, ...clientIds])))
    }
  }

  const handleBulkCopyEmailDrafts = async (rows: Array<{ client: ClientSummary }>) => {
    if (rows.length === 0) return
    const combined = rows
      .map(({ client }) =>
        generateWeeklyEmailDraft({
          clientName: client.name,
          weekStart: selectedWeekStart,
          stats: client.stats,
          loomUrl: loomUrls[client.clientId],
        })
      )
      .join("\n\n---\n\n")
    try {
      await navigator.clipboard.writeText(combined)
      setBulkToast(`Copied ${rows.length} email draft(s)`)
      setTimeout(() => setBulkToast(null), 2500)
    } catch (err) {
      console.error("Failed to copy bulk email drafts:", err)
      setBulkToast("Failed to copy email drafts")
      setTimeout(() => setBulkToast(null), 2500)
    }
  }

  const getTableRows = () => {
    if (!data) return []
        const attentionByClient = new Map(attentionData.map((att) => [att.clientId, att]))
        const search = searchTerm.trim().toLowerCase()
        const priorityOrder = { red: 0, amber: 1, green: 2 }

    const baseRows = data.clients.map((client) => {
      const attention = attentionByClient.get(client.clientId)
      const streak = streakData[client.clientId] || null
        return {
          client,
          attention,
          streak,
          priority: getDisplayPriority(
            attention?.attentionScore || null,
            client.stats.checkInCount,
            client.stats.expectedCheckIns ?? 7,
            adherence,
            missedCheckinsPolicy
          ),
          score: attention?.attentionScore?.score ?? 0,
          reasons: attention?.attentionScore?.reasons ?? [],
          calculatedAt: attention?.attentionScore?.calculatedAt ?? null,
        }
      })

    const filtered = baseRows.filter((row) => {
      if (priorityFilter !== "all" && row.priority !== priorityFilter) return false
      if (!search) return true
      const name = row.client.name?.toLowerCase() || ""
      const email = row.client.email.toLowerCase()
      return name.includes(search) || email.includes(search)
    })

    const direction = sortDirection === "asc" ? 1 : -1

    return filtered.sort((a, b) => {
      switch (sortKey) {
        case "name": {
          const aName = a.client.name || a.client.email
          const bName = b.client.name || b.client.email
          return aName.localeCompare(bName) * direction
        }
        case "checkIns":
          return (a.client.stats.checkInCount - b.client.stats.checkInCount) * direction
        case "score":
          return (a.score - b.score) * direction
        case "streak":
          return ((a.streak?.currentStreak ?? 0) - (b.streak?.currentStreak ?? 0)) * direction
        case "lastCheckIn": {
          const aTime = a.client.lastCheckInDate ? new Date(a.client.lastCheckInDate).getTime() : 0
          const bTime = b.client.lastCheckInDate ? new Date(b.client.lastCheckInDate).getTime() : 0
          return (aTime - bTime) * direction
        }
        case "lastEvaluated": {
          const aTime = a.calculatedAt ? new Date(a.calculatedAt).getTime() : 0
          const bTime = b.calculatedAt ? new Date(b.calculatedAt).getTime() : 0
          return (aTime - bTime) * direction
        }
        case "priority":
        default: {
          if (a.priority !== b.priority) {
            return (priorityOrder[a.priority] - priorityOrder[b.priority]) * direction
          }
          return (b.score - a.score) * direction
        }
      }
    })
  }

  if (!selectedWeekStart) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-neutral-600">Loading...</p>
      </div>
    )
  }

  const tableRows = getTableRows()
  const visibleClientIds = tableRows.map((row) => row.client.clientId)
  const selectedRows = tableRows.filter((row) => selectedClientIds.includes(row.client.clientId))
  const allVisibleSelected =
    visibleClientIds.length > 0 &&
    visibleClientIds.every((id) => selectedClientIds.includes(id))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">
          Weekly Review Queue
        </h1>
        <p className="text-neutral-600 mt-2">
          Review your clients' weekly progress and send personalized updates
        </p>
      </div>

      {/* Adherence Thresholds Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Adherence Thresholds:</span> Green &#x2705; ({adherence.greenMinimum}+ check-ins) &bull; Amber &#x1F7E1; ({adherence.amberMinimum}-{Math.max(adherence.greenMinimum - 1, adherence.amberMinimum)} check-ins) &bull; Red &#x1F534; (0-{Math.max(adherence.amberMinimum - 1, 0)} check-ins)
          <br />
          <span className="text-xs text-blue-700 mt-1 block">
            These values are configured in Admin Settings
          </span>
        </p>
      </div>

      {/* Toast Notification */}
      {reminderToast && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
          {reminderToast}
        </div>
      )}
      {bulkToast && (
        <div className="fixed top-16 right-4 z-50 bg-neutral-900 text-white px-6 py-3 rounded-lg shadow-lg">
          {bulkToast}
        </div>
      )}

      {/* Cohort Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isAdmin && (
            <label className="text-sm text-neutral-700">
              Cohort Owner
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
              >
                <option value="">All owners</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name || owner.email}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm text-neutral-700">
            Cohort
            <select
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
            >
              <option value="">
                {isAdmin && selectedOwnerId ? "All owner cohorts" : "All cohorts"}
              </option>
              {cohortOptions.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                  {isAdmin && (cohort.coachName || cohort.coachEmail)
                    ? ` \u2014 ${cohort.coachName || cohort.coachEmail}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Week Selector */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6 flex items-center justify-between gap-4">
        <button
          onClick={() => handleWeekChange("prev")}
          className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          &larr; Previous Week
        </button>
        <div className="text-center flex-1">
          <div className="text-sm text-neutral-600">Selected Week</div>
          <div className="text-lg font-semibold text-neutral-900">
            {data
              ? `${new Date(data.weekStart).toLocaleDateString()} - ${new Date(
                  data.weekEnd
                ).toLocaleDateString()}`
              : selectedWeekStart}
          </div>
        </div>
        <button
          onClick={() => handleWeekChange("next")}
          disabled={
            formatDateISO(getMonday(new Date(selectedWeekStart))) >=
            formatDateISO(getMonday(new Date()))
          }
          className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Week &rarr;
        </button>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {recalculating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Recalculating...
            </>
          ) : (
            <>
              &#x27F3; Recalculate
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-700 font-medium mb-1">Red (Needs Attention)</div>
            <div className="text-2xl font-bold text-red-900">{getSummary().red}</div>
            <div className="text-xs text-red-600 mt-1">&lt; 40% check-in rate</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-sm text-amber-700 font-medium mb-1">Amber (Watch Closely)</div>
            <div className="text-2xl font-bold text-amber-900">{getSummary().amber}</div>
            <div className="text-xs text-amber-600 mt-1">40-70% check-in rate</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-700 font-medium mb-1">Green (Stable)</div>
            <div className="text-2xl font-bold text-green-900">{getSummary().green}</div>
            <div className="text-xs text-green-600 mt-1">&gt; 70% check-in rate</div>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="text-sm text-neutral-700 font-medium mb-1">Total Clients</div>
            <div className="text-2xl font-bold text-neutral-900">{getSummary().total}</div>
            <div className="text-xs text-neutral-600 mt-1">
              {selectedCohortId
                ? cohortOptions.find((cohort) => cohort.id === selectedCohortId)?.name || "Selected cohort"
                : isAdmin && selectedOwnerId
                ? ownerOptions.find((owner) => owner.id === selectedOwnerId)?.name ||
                  ownerOptions.find((owner) => owner.id === selectedOwnerId)?.email ||
                  "Selected owner"
                : "All cohorts"}
            </div>
          </div>
        </div>
      )}

      {/* Priority Filters */}
      {data && data.clients.length > 0 && (
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setPriorityFilter("all")}
            className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
              priorityFilter === "all"
                ? "bg-blue-600 text-white"
                : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            All ({getSummary().total})
          </button>
          <button
            onClick={() => setPriorityFilter("red")}
            className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
              priorityFilter === "red"
                ? "bg-red-600 text-white"
                : "bg-white border border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            Red ({getSummary().red})
          </button>
          <button
            onClick={() => setPriorityFilter("amber")}
            className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
              priorityFilter === "amber"
                ? "bg-amber-600 text-white"
                : "bg-white border border-amber-300 text-amber-700 hover:bg-amber-50"
            }`}
          >
            Amber ({getSummary().amber})
          </button>
          <button
            onClick={() => setPriorityFilter("green")}
            className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
              priorityFilter === "green"
                ? "bg-green-600 text-white"
                : "bg-white border border-green-300 text-green-700 hover:bg-green-50"
            }`}
          >
            Green ({getSummary().green})
          </button>
        </div>
      )}

      {data && (
        <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search clients by name or email..."
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
            />
          </div>
          <div className="text-xs text-neutral-500">
            Sort by clicking table headers
          </div>
        </div>
      )}

      {/* Client List */}
      {data && tableRows.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center">
          <p className="text-neutral-600">
            {priorityFilter === "all"
              ? "No clients found for this week. Add clients to your cohorts to see their weekly summaries here."
              : `No ${priorityFilter} priority clients for this week.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedRows.length > 0 && (
            <div className="bg-white rounded-lg border border-neutral-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-neutral-700">
                Selected {selectedRows.length} client{selectedRows.length === 1 ? "" : "s"}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleBulkCopyEmailDrafts(selectedRows)}
                  className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Copy Email Drafts
                </button>
                <button
                  onClick={() => setSelectedClientIds([])}
                  className="px-3 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={() => handleToggleSelectAll(visibleClientIds)}
                      />
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer"
                      onClick={() => handleSort("name")}
                    >
                      Client
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer"
                      onClick={() => handleSort("priority")}
                    >
                      RAG
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer"
                      onClick={() => handleSort("score")}
                    >
                      Severity
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Confidence</th>
                    <th className="text-left px-4 py-3 font-medium">Reasons</th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer"
                      onClick={() => handleSort("checkIns")}
                    >
                      Check-ins
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer"
                      onClick={() => handleSort("streak")}
                    >
                      Streak
                    </th>
                    {isChallengeSelected && (
                      <th className="text-left px-4 py-3 font-medium">Challenge</th>
                    )}
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer"
                      onClick={() => handleSort("lastCheckIn")}
                    >
                      Last check-in
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium cursor-pointer"
                      onClick={() => handleSort("lastEvaluated")}
                    >
                      Last evaluated
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => {
                    const client = row.client
                    const attention = row.attention
                    const priorityColor = row.priority
                    const expectedCheckIns = client.stats.expectedCheckIns ?? 7
                    const greenThreshold = Math.max(
                      1,
                      Math.ceil((adherence.greenMinimum / 7) * expectedCheckIns)
                    )
                    const amberThreshold = Math.max(
                      0,
                      Math.ceil((adherence.amberMinimum / 7) * expectedCheckIns)
                    )
                    const isExpanded = expandedClient === client.clientId
                    const ragClass =
                      priorityColor === "red"
                        ? "bg-red-100 text-red-800"
                        : priorityColor === "amber"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-green-100 text-green-800"

                    return (
                      <Fragment key={client.clientId}>
                        <tr
                          className={`border-t border-neutral-100 ${
                            priorityColor === "red"
                              ? "bg-red-50/40"
                              : priorityColor === "amber"
                              ? "bg-amber-50/40"
                              : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedClientIds.includes(client.clientId)}
                              onChange={() => handleToggleSelection(client.clientId)}
                            />
                          </td>
                          <td className="px-4 py-3 text-neutral-900">
                            <div className="font-medium">{client.name || client.email}</div>
                            <div className="text-xs text-neutral-500">{client.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${ragClass}`}
                            >
                              {priorityColor.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {attention?.attentionScore ? row.score : "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {getConfidenceLabel(attention?.attentionScore || null)}
                          </td>
                          <td className="px-4 py-3 text-neutral-600">
                            {row.reasons.length > 0 ? row.reasons.join(" \u2022 ") : "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {client.stats.checkInCount}/{client.stats.expectedCheckIns ?? 7} ({Math.round(client.stats.checkInRate * 100)}%)
                          </td>
                          <td className="px-4 py-3">
                            {row.streak ? (
                              <span
                                className={`inline-flex items-center gap-1 text-sm font-medium ${
                                  row.streak.status === "green"
                                    ? "text-green-700"
                                    : row.streak.status === "amber"
                                    ? "text-amber-700"
                                    : "text-red-700"
                                }`}
                                title={`${row.streak.daysSinceLastCheckIn} day(s) since last check-in`}
                              >
                                {"\uD83D\uDD25"} {row.streak.currentStreak}
                              </span>
                            ) : (
                              <span className="text-neutral-400">{"\u2014"}</span>
                            )}
                          </td>
                          {isChallengeSelected && (
                            <td className="px-4 py-3">
                              {challengeProgressData[client.clientId] ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        challengeProgressData[client.clientId].checkInRate >= 0.7
                                          ? "bg-green-500"
                                          : challengeProgressData[client.clientId].checkInRate >= 0.4
                                          ? "bg-amber-500"
                                          : "bg-red-500"
                                      }`}
                                      style={{ width: `${challengeProgressData[client.clientId].percentComplete}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-neutral-600">
                                    {challengeProgressData[client.clientId].percentComplete}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-neutral-400">{"\u2014"}</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 text-neutral-700">
                            {client.lastCheckInDate
                              ? new Date(client.lastCheckInDate).toLocaleDateString()
                              : "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {formatDateTime(row.calculatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/clients/${client.clientId}/weekly-review?weekStart=${selectedWeekStart}&from=weekly-review`}
                                className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors whitespace-nowrap"
                              >
                                Full Review
                              </Link>
                              {sharedNotesByClient[client.clientId]?.length > 0 ? (
                                <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-50 rounded whitespace-nowrap">
                                  Responded &#x2713;
                                </span>
                              ) : (
                                <button
                                  onClick={() =>
                                    setRespondingToClient(
                                      respondingToClient === client.clientId ? null : client.clientId
                                    )
                                  }
                                  className="px-3 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors whitespace-nowrap"
                                >
                                  {respondingToClient === client.clientId ? "Cancel" : "Write Response"}
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setExpandedClient(isExpanded ? null : client.clientId)
                                }
                                className="px-3 py-1 text-xs font-medium text-neutral-600 bg-neutral-100 rounded hover:bg-neutral-200 transition-colors"
                              >
                                {isExpanded ? "Hide" : "Expand"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {respondingToClient === client.clientId && (
                          <tr className="border-t border-neutral-100">
                            <td colSpan={isChallengeSelected ? 12 : 11} className="p-4 bg-purple-50/30">
                              <div className="max-w-xl">
                                <div className="text-sm font-medium text-neutral-700 mb-2">
                                  Write a shared response for {client.name || client.email}
                                </div>
                                <CoachNoteEditor
                                  clientId={client.clientId}
                                  defaultSharedWithClient={true}
                                  weekNumber={
                                    getChallengeWeekNumber(
                                      cohortOptions.find((c) => c.id === selectedCohortId)?.cohortStartDate ?? null,
                                      selectedWeekStart
                                    ) ?? undefined
                                  }
                                  onSaved={() => {
                                    setRespondingToClient(null)
                                    // Optimistically mark as responded
                                    setSharedNotesByClient((prev) => ({
                                      ...prev,
                                      [client.clientId]: [
                                        ...(prev[client.clientId] || []),
                                        { sharedWithClient: true, weekNumber: getChallengeWeekNumber(
                                          cohortOptions.find((c) => c.id === selectedCohortId)?.cohortStartDate ?? null,
                                          selectedWeekStart
                                        ) },
                                      ],
                                    }))
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                        {isExpanded && (
                          <tr className="border-t border-neutral-100">
                            <td colSpan={isChallengeSelected ? 12 : 11} className="p-4 bg-white">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-4">
                                  <div>
                                    <div className="text-sm font-semibold text-neutral-900 mb-1">
                                      Check-ins: {client.stats.checkInCount}/{client.stats.expectedCheckIns ?? 7}{" "}
                                      <span className="text-xs text-neutral-600">
                                        ({Math.round(client.stats.checkInRate * 100)}%)
                                      </span>
                                    </div>
                                    <div className="w-full bg-neutral-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${
                                          client.stats.checkInCount >= greenThreshold
                                            ? "bg-green-500"
                                            : client.stats.checkInCount >= amberThreshold
                                            ? "bg-amber-500"
                                            : "bg-red-500"
                                        }`}
                                        style={{
                                          width: `${(client.stats.checkInRate * 100).toFixed(0)}%`,
                                        }}
                                      ></div>
                                    </div>
                                  </div>

                                  {questionnaireStatus[client.clientId] &&
                                    questionnaireStatus[client.clientId].length > 0 && (
                                      <div className="text-sm text-neutral-600">
                                        Questionnaires:{" "}
                                        {questionnaireStatus[client.clientId].map((q) => {
                                          const hoursSinceUpdate = Math.floor(
                                            (Date.now() - new Date(q.updatedAt).getTime()) /
                                              (1000 * 60 * 60)
                                          )
                                          const submittedLabel = q.submittedAt
                                            ? `Submitted ${new Date(q.submittedAt).toLocaleString()}`
                                            : "Submitted"
                                          return (
                                            <span key={q.weekNumber} className="mr-2">
                                              W{q.weekNumber}:{" "}
                                              {q.status === "completed" ? (
                                                <span
                                                  className="text-green-600 cursor-help"
                                                  title={submittedLabel}
                                                >
                                                  &#x2713;
                                                </span>
                                              ) : q.status === "in_progress" ? (
                                                <span
                                                  className="text-red-600 cursor-help"
                                                  title={`Last saved ${hoursSinceUpdate} hours ago`}
                                                >
                                                  &#x25D0;
                                                </span>
                                              ) : (
                                                <span className="text-neutral-400">&#x2717;</span>
                                              )}
                                            </span>
                                          )
                                        })}
                                      </div>
                                    )}

                                  {attention?.topInsights.length ? (
                                    <div className="flex flex-wrap gap-2">
                                      {attention.topInsights.map((insight) => (
                                        <div
                                          key={insight.id}
                                          className="text-xs bg-white px-2 py-1 rounded border border-neutral-200"
                                        >
                                          <span className="font-semibold">
                                            {insight.icon} {insight.title}:
                                          </span>{" "}
                                          {insight.description}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  {isChallengeSelected && challengeProgressData[client.clientId] && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                      <div className="text-sm font-semibold text-blue-900 mb-2">Challenge Progress</div>
                                      <div className="grid grid-cols-3 gap-3 text-sm">
                                        <div>
                                          <span className="text-blue-700">Days:</span>{" "}
                                          <span className="font-medium">
                                            {challengeProgressData[client.clientId].daysCompleted}/{challengeProgressData[client.clientId].totalDays}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-blue-700">Check-in Rate:</span>{" "}
                                          <span className="font-medium">
                                            {challengeProgressData[client.clientId].percentComplete}%
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-blue-700">Streak:</span>{" "}
                                          <span className="font-medium">
                                            {challengeProgressData[client.clientId].streak}d
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                      Loom Video URL
                                    </label>
                                    <input
                                      type="text"
                                      value={loomUrls[client.clientId] || ""}
                                      onChange={(e) =>
                                        setLoomUrls((prev) => ({
                                          ...prev,
                                          [client.clientId]: e.target.value,
                                        }))
                                      }
                                      placeholder="https://www.loom.com/share/..."
                                      className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                      Notes (optional)
                                    </label>
                                    <textarea
                                      value={notes[client.clientId] || ""}
                                      onChange={(e) =>
                                        setNotes((prev) => ({
                                          ...prev,
                                          [client.clientId]: e.target.value,
                                        }))
                                      }
                                      placeholder="Add private notes for this week..."
                                      rows={3}
                                      className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                                    />
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveResponse(client.clientId)}
                                      disabled={savingClient === client.clientId}
                                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
                                    >
                                      {savingClient === client.clientId ? "Saving..." : "\uD83D\uDCBE Save"}
                                    </button>
                                    <button
                                      onClick={() => handleCopyEmail(client)}
                                      className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                      {copiedClient === client.clientId
                                        ? "\u2713 Copied!"
                                        : "\uD83D\uDCCB Email Draft"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Main page with tabs
// ══════════════════════════════════════════════════════════════════════

function ChallengesPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get("tab") === "weekly-review" ? "weekly-review" : "cohorts"
  const [activeTab, setActiveTab] = useState(initialTab)

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === "cohorts") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    router.push(`/coach-dashboard/challenges?${params.toString()}`)
  }

  return (
    <CoachLayout>
      <div className="max-w-4xl mx-auto">
        {/* Tab buttons */}
        <div className="flex gap-1 mb-6 bg-neutral-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => handleTabChange("cohorts")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "cohorts"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Cohorts
          </button>
          <button
            onClick={() => handleTabChange("weekly-review")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "weekly-review"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Weekly Review
          </button>
        </div>

        {activeTab === "cohorts" ? <CohortsTabContent /> : <WeeklyReviewTabContent />}
      </div>
    </CoachLayout>
  )
}

export default function CoachChallengesPage() {
  return (
    <Suspense fallback={<CoachLayout><div className="max-w-4xl mx-auto animate-pulse"><div className="h-10 w-64 bg-neutral-200 rounded mb-6" /><div className="h-64 bg-neutral-200 rounded-xl" /></div></CoachLayout>}>
      <ChallengesPageContent />
    </Suspense>
  )
}
