"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface Cohort {
  id: string
  name: string
  createdAt: string
  memberships: Array<{
    user: {
      id: string
      name: string | null
      email: string
    }
  }>
}

interface Client {
  id?: string
  name?: string | null
  email: string
  isPending?: boolean
}

interface Invite {
  email: string
  createdAt: string
}

export default function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id: cohortId } = use(params)

  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [availableClients, setAvailableClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assigningClientId, setAssigningClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ email: "" })
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  
  // Check-in config state
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [configSubmitting, setConfigSubmitting] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configSuccess, setConfigSuccess] = useState<string | null>(null)
  const [checkInConfig, setCheckInConfig] = useState<{
    enabledPrompts: string[]
    customPrompt1: string | null
    customPrompt1Type: "scale" | "text" | "number" | ""
  }>({
    enabledPrompts: ["weightLbs", "steps", "calories"], // Default mandatory prompts
    customPrompt1: "",
    customPrompt1Type: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user.roles.includes("CLIENT")) {
      router.push("/client-dashboard")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session && cohortId) {
      // Reset state when cohort changes
      setCohort(null)
      setClients([])
      setInvites([])
      setError(null)
      const loadData = async () => {
        setLoading(true)
        try {
          await Promise.all([fetchCohort(), fetchClients(), fetchCheckInConfig(), fetchAvailableClients()])
        } finally {
          setLoading(false)
        }
      }
      loadData()
    } else {
      // Clear data when logged out
      setCohort(null)
      setClients([])
      setInvites([])
      setError(null)
      setLoading(false)
    }
  }, [session, cohortId])

  const fetchCohort = async () => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}`)
      if (res.ok) {
        const data = await res.json()
        setCohort(data)
      } else {
        const errorData = await res.json()
        console.error("Error fetching cohort:", errorData)
        setError(errorData.error || "Failed to load cohort")
      }
    } catch (err) {
      console.error("Error fetching cohort:", err)
      setError("Failed to load cohort")
    }
  }

  const fetchClients = async () => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/clients`)
      if (res.ok) {
        const data = await res.json()
        setClients(data.members || [])
        setInvites(data.invites || [])
      } else {
        const errorData = await res.json()
        console.error("Error fetching clients:", errorData)
        // Don't set error here - it's not critical, just log it
      }
    } catch (err) {
      console.error("Error fetching clients:", err)
      // Don't set error here - it's not critical, just log it
    }
  }

  const fetchCheckInConfig = async () => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/check-in-config`)
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setCheckInConfig({
            enabledPrompts: data.enabledPrompts || ["weightLbs", "steps", "calories"],
            customPrompt1: data.customPrompt1 || "",
            customPrompt1Type: (data.customPrompt1Type as "scale" | "text" | "number") || "",
          })
        }
      }
    } catch (err) {
      console.error("Error fetching check-in config:", err)
      // Use defaults if fetch fails
    }
  }

  const fetchAvailableClients = async () => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/available-clients`)
      if (res.ok) {
        const data = await res.json()
        setAvailableClients(data.availableClients || [])
      } else {
        console.error("Error fetching available clients")
        setAvailableClients([])
      }
    } catch (err) {
      console.error("Error fetching available clients:", err)
      setAvailableClients([])
    }
  }

  const handleAssignExistingClient = async () => {
    if (!selectedClientId) {
      setError("Please select a client")
      return
    }

    setAssigningClientId(selectedClientId)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${selectedClientId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId }),
      })

      const data = await res.json()

      if (res.ok) {
        setSelectedClientId("")
        setError(null)
        // Refresh clients and available clients
        await Promise.all([fetchClients(), fetchAvailableClients()])
      } else {
        setError(data.error || "Failed to assign client to cohort")
      }
    } catch (err) {
      setError("Unable to assign client. Please try again.")
    } finally {
      setAssigningClientId(null)
    }
  }

  const handleRemoveClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Remove ${clientName} from this cohort?`)) {
      return
    }

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/clients/${clientId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setError(null)
        // Refresh clients and available clients
        await Promise.all([fetchClients(), fetchAvailableClients()])
      } else {
        const data = await res.json()
        setError(data.error || "Failed to remove client from cohort")
      }
    } catch (err) {
      setError("Unable to remove client. Please try again.")
    }
  }

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfigSubmitting(true)
    setConfigError(null)
    setConfigSuccess(null)

    try {
      // Prepare request body - only include additional prompts (mandatory ones are handled by API)
      const mandatoryPrompts = ["weightLbs", "steps", "calories"]
      const additionalPrompts = checkInConfig.enabledPrompts.filter(
        (p) => !mandatoryPrompts.includes(p)
      )

      const requestBody: any = {
        enabledPrompts: additionalPrompts,
      }

      // Only include custom prompt if it has a value
      if (checkInConfig.customPrompt1 && checkInConfig.customPrompt1.trim() !== "") {
        requestBody.customPrompt1 = checkInConfig.customPrompt1.trim()
        if (checkInConfig.customPrompt1Type) {
          requestBody.customPrompt1Type = checkInConfig.customPrompt1Type
        }
      } else {
        requestBody.customPrompt1 = null
        requestBody.customPrompt1Type = null
      }

      const res = await fetch(`/api/cohorts/${cohortId}/check-in-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()

      if (res.ok) {
        setConfigSuccess("Check-in configuration updated successfully!")
        setShowConfigForm(false)
        // Update local state with response
        setCheckInConfig({
          enabledPrompts: data.enabledPrompts || ["weightLbs", "steps", "calories"],
          customPrompt1: data.customPrompt1 || "",
          customPrompt1Type: (data.customPrompt1Type as "scale" | "text" | "number") || "",
        })
        // Clear success message after 3 seconds
        setTimeout(() => setConfigSuccess(null), 3000)
      } else {
        setConfigError(data.error || "Failed to update check-in configuration. Please try again.")
      }
    } catch (err) {
      setConfigError("Unable to update check-in configuration. Please check your connection and try again.")
    } finally {
      setConfigSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (res.ok) {
        setShowForm(false)
        setFormData({ email: "" })
        setError(null)
        // Update clients and invites from response
        setClients(data.members || [])
        setInvites(data.invites || [])
      } else {
        // Human-readable error messages
        if (data.error === "Client already in cohort" || data.error?.includes("already")) {
          setError("This client is already in the cohort.")
        } else if (data.error === "Invite already sent to this email" || data.error?.includes("Invite already")) {
          setError("An invitation has already been sent to this email address.")
        } else if (data.error === "Client not found") {
          setError("No account found with this email. An invitation will be sent, and they'll be added automatically when they sign in.")
        } else {
          setError(data.error || "Failed to add client. Please try again.")
        }
      }
    } catch (err) {
      setError("Unable to add client. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this cohort?")) {
      return
    }

    try {
      const res = await fetch(`/api/cohorts/${cohortId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        router.push("/coach-dashboard")
      } else {
        const data = await res.json()
        setError(data.error || "Failed to delete cohort. Please try again.")
      }
    } catch (err) {
      setError("Unable to delete cohort. Please try again.")
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-neutral-500">Loading cohort...</p>
        </div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

  if (error && !cohort) {
    return (
      <CoachLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!cohort) {
    return (
      <CoachLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-neutral-500">Cohort not found or you don't have permission to view it.</p>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="max-w-4xl mx-auto">

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{cohort.name}</h1>
            <p className="text-neutral-500">
              Created {new Date(cohort.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/cohorts/${cohortId}/analytics`}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-neutral-800"
            >
              View Analytics
            </Link>
            <button
              onClick={handleDelete}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Delete Cohort
            </button>
          </div>
        </div>

        {error && !showForm && !showConfigForm && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}

        {configSuccess && (
          <div className="mb-4 p-3 bg-neutral-50 border border-neutral-200 text-neutral-900 rounded-md text-sm">
            {configSuccess}
          </div>
        )}

        {/* Check-in Configuration Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Check-in Configuration</h2>
            <button
              onClick={() => {
                setShowConfigForm(!showConfigForm)
                setConfigError(null)
                setConfigSuccess(null)
                if (!showConfigForm) {
                  fetchCheckInConfig()
                }
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              {showConfigForm ? "Cancel" : "Edit Configuration"}
            </button>
          </div>

          {showConfigForm && (
            <div className="border-t pt-4 mt-4">
              <form onSubmit={handleConfigSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Mandatory Prompts (Always Enabled)</label>
                  <div className="space-y-2 bg-neutral-50 p-3 rounded-md mb-4">
                    <label className="flex items-center text-neutral-900">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="mr-2 cursor-not-allowed opacity-60"
                      />
                      <span className="text-sm font-medium">Weight (lbs) - Required</span>
                    </label>
                    <label className="flex items-center text-neutral-900">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="mr-2 cursor-not-allowed opacity-60"
                      />
                      <span className="text-sm font-medium">Steps - Required</span>
                    </label>
                    <label className="flex items-center text-neutral-900">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="mr-2 cursor-not-allowed opacity-60"
                      />
                      <span className="text-sm font-medium">Calories - Required</span>
                    </label>
                  </div>
                  <label className="block text-sm font-medium mb-2 mt-4">Additional Prompts (Optional)</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={checkInConfig.enabledPrompts.includes("sleepQuality")}
                        onChange={(e) => {
                          const prompts = e.target.checked
                            ? [...checkInConfig.enabledPrompts, "sleepQuality"]
                            : checkInConfig.enabledPrompts.filter((p) => p !== "sleepQuality")
                          setCheckInConfig({ ...checkInConfig, enabledPrompts: prompts })
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Sleep Quality (1-10 scale)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={checkInConfig.enabledPrompts.includes("perceivedEffort")}
                        onChange={(e) => {
                          const prompts = e.target.checked
                            ? [...checkInConfig.enabledPrompts, "perceivedEffort"]
                            : checkInConfig.enabledPrompts.filter((p) => p !== "perceivedEffort")
                          setCheckInConfig({ ...checkInConfig, enabledPrompts: prompts })
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Perceived Effort (1-10 scale)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={checkInConfig.enabledPrompts.includes("notes")}
                        onChange={(e) => {
                          const prompts = e.target.checked
                            ? [...checkInConfig.enabledPrompts, "notes"]
                            : checkInConfig.enabledPrompts.filter((p) => p !== "notes")
                          setCheckInConfig({ ...checkInConfig, enabledPrompts: prompts })
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Notes (free text)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Custom Prompt (Optional)</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={checkInConfig.customPrompt1 || ""}
                      onChange={(e) =>
                        setCheckInConfig({
                          ...checkInConfig,
                          customPrompt1: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="e.g., How was your energy today?"
                      maxLength={255}
                    />
                    <select
                      value={checkInConfig.customPrompt1Type || ""}
                      onChange={(e) =>
                        setCheckInConfig({
                          ...checkInConfig,
                          customPrompt1Type: e.target.value as "scale" | "text" | "number" | "",
                        })
                      }
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={!checkInConfig.customPrompt1 || checkInConfig.customPrompt1.trim() === ""}
                    >
                      <option value="">Select prompt type</option>
                      <option value="scale">Scale (1-10)</option>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                    </select>
                    <p className="text-xs text-neutral-500">
                      {!checkInConfig.customPrompt1 || checkInConfig.customPrompt1.trim() === ""
                        ? "Enter a custom prompt label first"
                        : "Choose how clients will respond to this prompt"}
                    </p>
                  </div>
                </div>

                {configError && (
                  <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                    {configError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={configSubmitting}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {configSubmitting ? "Saving..." : "Save Configuration"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfigForm(false)
                      setConfigError(null)
                      setConfigSuccess(null)
                      fetchCheckInConfig() // Reset to original values
                    }}
                    className="bg-gray-200 text-neutral-700 px-6 py-2 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {!showConfigForm && (
            <div className="text-sm text-neutral-600">
              <p className="mb-2">
                <strong>Mandatory prompts:</strong> Weight (lbs), Steps, Calories (always enabled)
              </p>
              <p className="mb-2">
                <strong>Additional prompts:</strong>{" "}
                {checkInConfig.enabledPrompts
                  .filter((p) => !["weightLbs", "steps", "calories"].includes(p))
                  .length > 0
                  ? checkInConfig.enabledPrompts
                      .filter((p) => !["weightLbs", "steps", "calories"].includes(p))
                      .map((p) => {
                        if (p === "sleepQuality") return "Sleep Quality"
                        if (p === "perceivedEffort") return "Perceived Effort"
                        if (p === "notes") return "Notes"
                        return p
                      })
                      .join(", ")
                  : "None enabled"}
              </p>
              {checkInConfig.customPrompt1 && checkInConfig.customPrompt1.trim() !== "" && (
                <p>
                  <strong>Custom prompt:</strong> {checkInConfig.customPrompt1} ({checkInConfig.customPrompt1Type || "text"})
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Clients</h2>
            <button
              onClick={() => {
                setShowForm(!showForm)
                // Clear error when toggling form
                if (!showForm) setError(null)
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-neutral-800"
            >
              {showForm ? "Cancel" : "Add Client"}
            </button>
          </div>

          {showForm && (
            <div className="mb-4 p-4 bg-neutral-50 rounded space-y-6">
              {error && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                  {error}
                </div>
              )}

              {/* Add Existing Client Section */}
              {availableClients.length > 0 && (
                <div className="pb-6 border-b border-neutral-200">
                  <h3 className="text-sm font-semibold mb-2">Add Existing Client</h3>
                  <p className="text-sm text-neutral-600 mb-4">
                    Select a client from your roster to add to this cohort.
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={selectedClientId}
                      onChange={(e) => {
                        setSelectedClientId(e.target.value)
                        if (error) setError(null)
                      }}
                      className="flex-1 px-3 py-2 border rounded-md"
                    >
                      <option value="">Select a client...</option>
                      {availableClients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name || client.email}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignExistingClient}
                      disabled={!selectedClientId || assigningClientId !== null}
                      className="bg-neutral-900 text-white px-6 py-2 rounded-md hover:bg-neutral-800 disabled:opacity-50 text-sm font-medium"
                    >
                      {assigningClientId ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              )}

              {/* Invite by Email Section */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Invite New Client</h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Invite clients by email. They'll be added automatically when they sign in.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Client Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value })
                        // Clear error when user starts typing
                        if (error) setError(null)
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="client@example.com"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {submitting ? "Sending Invite..." : "Send Invite"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Active Clients Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">
              Active Clients {clients.length > 0 && `(${clients.length})`}
            </h3>
            {clients.length === 0 ? (
              <p className="text-neutral-500 py-2">
                No active clients yet. Invite clients by email to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {clients.map((client, index) => (
                  <div
                    key={client.id || client.email || `client-${index}`}
                    className="p-4 border rounded-lg hover:bg-neutral-50"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <h3 className="font-semibold">
                          {client.name || "No name"}
                        </h3>
                        <p className="text-sm text-neutral-500">{client.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {client.id ? (
                          <Link
                            href={`/clients/${client.id}/entries`}
                            className="text-neutral-900 hover:underline text-sm"
                          >
                            View Entries →
                          </Link>
                        ) : (
                          <span className="text-sm text-neutral-400">No ID available</span>
                        )}
                        {client.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveClient(client.id!, client.name || client.email)
                            }}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invitations Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">
              Pending Invitations {invites.length > 0 && `(${invites.length})`}
            </h3>
            {invites.length === 0 ? (
              <p className="text-neutral-500 py-2">
                No pending invitations. All invited clients have joined.
              </p>
            ) : (
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div
                    key={invite.email}
                    className="block p-4 border rounded-lg bg-neutral-50 italic"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-neutral-600">
                          {invite.email}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-neutral-600">
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}
