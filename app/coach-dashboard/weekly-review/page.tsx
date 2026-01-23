"use client"

import { useState, useEffect, Fragment } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { generateWeeklyEmailDraft } from "@/lib/utils/email-draft"
import { Role } from "@/lib/types"

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
  | "lastCheckIn"
  | "lastEvaluated"

const DEFAULT_ADHERENCE: AdherenceThresholds = {
  greenMinimum: 6,
  amberMinimum: 3,
}

/**
 * Determine priority based on attention score + adherence check
 * This ensures clients who haven't checked in don't show as "on track"
 */
function getDisplayPriority(
  attention: { score: number; priority: string } | null,
  checkInCount: number,
  thresholds: AdherenceThresholds,
  missedCheckinsPolicy: AttentionMissedCheckinsPolicy
): "red" | "amber" | "green" {
  // If adherence is critically low, always red (overrides attention)
  if (checkInCount < thresholds.amberMinimum) {
    return "red"
  }

  const missedCheckIns = Math.max(0, 7 - checkInCount)
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
    if (checkInCount >= thresholds.greenMinimum) return "green"
    return "amber"
  }

  // Otherwise use attention priority
  return attention.priority as "red" | "amber" | "green"
}

interface ClientSummary {
  clientId: string
  name: string | null
  email: string
  stats: {
    checkInCount: number
    checkInRate: number
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

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function getConfidenceLabel(attention: ClientAttention["attentionScore"] | null): string {
  if (!attention) return "—"
  const signalCount = attention.reasons.length
  if (signalCount >= 3) return "High"
  if (signalCount === 2) return "Medium"
  if (signalCount === 1) return "Low"
  return "—"
}

function formatDateTime(value: string | null): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleString()
}

export default function WeeklyReviewPage() {
  const { data: session } = useSession()
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
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderToast, setReminderToast] = useState<string | null>(null)
  const [bulkToast, setBulkToast] = useState<string | null>(null)

  // Initialize week on mount
  useEffect(() => {
    setSelectedWeekStart(formatDate(getMonday(new Date())))
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
    setSelectedWeekStart(formatDate(getMonday(currentDate)))
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
        return {
          client,
          attention,
          priority: getDisplayPriority(
            attention?.attentionScore || null,
            client.stats.checkInCount,
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
      <CoachLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-neutral-600">Loading...</p>
        </div>
      </CoachLayout>
    )
  }

  const tableRows = getTableRows()
  const visibleClientIds = tableRows.map((row) => row.client.clientId)
  const selectedRows = tableRows.filter((row) => selectedClientIds.includes(row.client.clientId))
  const allVisibleSelected =
    visibleClientIds.length > 0 &&
    visibleClientIds.every((id) => selectedClientIds.includes(id))

  return (
    <CoachLayout>
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
            <span className="font-semibold">Adherence Thresholds:</span> Green ✅ ({adherence.greenMinimum}+ check-ins) • Amber 🟡 ({adherence.amberMinimum}-{Math.max(adherence.greenMinimum - 1, adherence.amberMinimum)} check-ins) • Red 🔴 (0-{Math.max(adherence.amberMinimum - 1, 0)} check-ins)
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
                      ? ` — ${cohort.coachName || cohort.coachEmail}`
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
            ← Previous Week
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
              formatDate(getMonday(new Date(selectedWeekStart))) >=
              formatDate(getMonday(new Date()))
            }
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Week →
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
                ⟳ Recalculate
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
                              {attention?.attentionScore ? row.score : "—"}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {getConfidenceLabel(attention?.attentionScore || null)}
                            </td>
                            <td className="px-4 py-3 text-neutral-600">
                              {row.reasons.length > 0 ? row.reasons.join(" • ") : "—"}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {client.stats.checkInCount}/7 ({Math.round(client.stats.checkInRate * 100)}%)
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {client.lastCheckInDate
                                ? new Date(client.lastCheckInDate).toLocaleDateString()
                                : "—"}
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
                          {isExpanded && (
                            <tr className="border-t border-neutral-100">
                              <td colSpan={10} className="p-4 bg-white">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  <div className="lg:col-span-2 space-y-4">
                                    <div>
                                      <div className="text-sm font-semibold text-neutral-900 mb-1">
                                        Check-ins: {client.stats.checkInCount}/7{" "}
                                        <span className="text-xs text-neutral-600">
                                          ({Math.round(client.stats.checkInRate * 100)}%)
                                        </span>
                                      </div>
                                      <div className="w-full bg-neutral-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full ${
                                            client.stats.checkInCount >= adherence.greenMinimum
                                              ? "bg-green-500"
                                              : client.stats.checkInCount >= adherence.amberMinimum
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
                                                    ✓
                                                  </span>
                                                ) : q.status === "in_progress" ? (
                                                  <span
                                                    className="text-red-600 cursor-help"
                                                    title={`Last saved ${hoursSinceUpdate} hours ago`}
                                                  >
                                                    ◐
                                                  </span>
                                                ) : (
                                                  <span className="text-neutral-400">✗</span>
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
                                        {savingClient === client.clientId ? "Saving..." : "💾 Save"}
                                      </button>
                                      <button
                                        onClick={() => handleCopyEmail(client)}
                                        className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                      >
                                        {copiedClient === client.clientId
                                          ? "✓ Copied!"
                                          : "📋 Email Draft"}
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
    </CoachLayout>
  )
}
