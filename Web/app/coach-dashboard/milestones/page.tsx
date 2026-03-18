"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"

interface MilestoneClient {
  id: string
  name: string | null
  email: string
}

interface MilestoneCohort {
  id: string
  name: string
}

interface Milestone {
  id: string
  coachId: string
  clientId: string | null
  cohortId: string | null
  title: string
  description: string | null
  type: string
  targetValue: number | null
  achievedAt: string | null
  message: string | null
  createdAt: string
  client: MilestoneClient | null
  cohort: MilestoneCohort | null
}

interface MilestonesResponse {
  milestones: Milestone[]
}

interface ClientOption {
  id: string
  name: string | null
  email: string
}

export default function MilestonesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Page state
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"streak" | "custom">("custom")
  const [targetValue, setTargetValue] = useState("")
  const [clientId, setClientId] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Message editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState("")
  const [savingMessage, setSavingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [messageSuccess, setMessageSuccess] = useState<string | null>(null)

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
    if (session) {
      fetchMilestones()
      fetchClients()
    }
  }, [session])

  async function fetchMilestones() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWithRetry<MilestonesResponse>(
        "/api/coach-dashboard/milestones"
      )
      setMilestones(data.milestones)
    } catch (err) {
      console.error("Error fetching milestones:", err)
      setError(
        err instanceof Error ? err.message : "Failed to load milestones."
      )
    } finally {
      setLoading(false)
    }
  }

  async function fetchClients() {
    try {
      const data = await fetchWithRetry<{ clients: ClientOption[] }>(
        "/api/coach-dashboard/overview"
      )
      setClients(data.clients ?? [])
    } catch {
      // Non-critical — client dropdown will just be empty
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setCreateSuccess(null)

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        type,
      }
      if (description.trim()) body.description = description.trim()
      if (targetValue) body.targetValue = parseInt(targetValue, 10)
      if (clientId) body.clientId = clientId

      const res = await fetch("/api/coach-dashboard/milestones", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Request failed" }))
        throw new Error(errData.error || `Request failed (${res.status})`)
      }

      setCreateSuccess("Milestone created successfully.")
      setTitle("")
      setDescription("")
      setType("custom")
      setTargetValue("")
      setClientId("")
      await fetchMilestones()
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create milestone."
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveMessage(milestoneId: string) {
    setSavingMessage(true)
    setMessageError(null)
    setMessageSuccess(null)

    try {
      const res = await fetch("/api/coach-dashboard/milestones", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId, message: messageText.trim() }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Request failed" }))
        throw new Error(errData.error || `Request failed (${res.status})`)
      }

      setMessageSuccess("Message saved.")
      setEditingMessageId(null)
      setMessageText("")
      await fetchMilestones()
    } catch (err) {
      setMessageError(
        err instanceof Error ? err.message : "Failed to save message."
      )
    } finally {
      setSavingMessage(false)
    }
  }

  if (status === "loading" || !session) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-gray-500">Loading...</div>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Milestones</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create and manage milestones for your clients.
          </p>
        </div>

        {/* Section 1: Create Milestone */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Create Milestone
          </h2>

          {createError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {createError}
            </div>
          )}
          {createSuccess && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {createSuccess}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            {/* Title */}
            <div>
              <label
                htmlFor="milestone-title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="milestone-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 30-Day Check-In Streak"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="milestone-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <input
                id="milestone-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Type */}
              <div>
                <label
                  htmlFor="milestone-type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Type
                </label>
                <select
                  id="milestone-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "streak" | "custom")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="custom">Custom</option>
                  <option value="streak">Streak</option>
                </select>
              </div>

              {/* Target Value */}
              <div>
                <label
                  htmlFor="milestone-target"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Target Value
                </label>
                <input
                  id="milestone-target"
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Client selector */}
              <div>
                <label
                  htmlFor="milestone-client"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Client
                </label>
                <select
                  id="milestone-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">All clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? "Creating..." : "Create Milestone"}
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Active Milestones */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Active Milestones
          </h2>

          {messageError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {messageError}
            </div>
          )}
          {messageSuccess && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {messageSuccess}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Loading milestones...
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
              <button
                onClick={fetchMilestones}
                className="ml-2 underline hover:text-red-900"
              >
                Retry
              </button>
            </div>
          ) : milestones.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No milestones yet. Create one above to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {milestones.map((m) => {
                const isAchieved = !!m.achievedAt
                const isEditing = editingMessageId === m.id

                return (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-4 ${
                      isAchieved
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {m.title}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              m.type === "streak"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {m.type}
                          </span>
                          {m.targetValue != null && (
                            <span className="text-xs text-gray-500">
                              Target: {m.targetValue}
                            </span>
                          )}
                        </div>

                        {m.description && (
                          <p className="mt-1 text-sm text-gray-600">
                            {m.description}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                          <span>
                            Client:{" "}
                            {m.client
                              ? m.client.name || m.client.email
                              : "All clients"}
                          </span>
                          {m.cohort && <span>Cohort: {m.cohort.name}</span>}
                        </div>

                        {m.message && (
                          <div className="mt-2 rounded-md bg-white border border-gray-200 p-2 text-sm text-gray-700">
                            <span className="font-medium text-gray-500 text-xs">
                              Coach message:
                            </span>{" "}
                            {m.message}
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 text-right">
                        {isAchieved ? (
                          <div>
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                              Achieved
                            </span>
                            <p className="mt-1 text-xs text-gray-500">
                              {new Date(m.achievedAt!).toLocaleDateString()}
                            </p>
                            {!m.message && !isEditing && (
                              <button
                                onClick={() => {
                                  setEditingMessageId(m.id)
                                  setMessageText("")
                                  setMessageError(null)
                                  setMessageSuccess(null)
                                }}
                                className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                Add Message
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Inline message editor */}
                    {isEditing && (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="text"
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          placeholder="Congratulations message..."
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <button
                          onClick={() => handleSaveMessage(m.id)}
                          disabled={savingMessage || !messageText.trim()}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {savingMessage ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingMessageId(null)
                            setMessageText("")
                          }}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </CoachLayout>
  )
}
