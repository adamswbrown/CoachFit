"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"
import { SurveyCreatorContainer } from "@/components/questionnaire/SurveyCreatorContainer"
import { DEFAULT_TEMPLATES, TemplateKey } from "@/lib/default-questionnaire-templates"

interface Cohort {
  id: string
  name: string
  createdAt: string
  coachId: string
  memberships: Array<{
    user: {
      id: string
      name: string | null
      email: string
    }
  }>
}

interface Coach {
  id: string
  name: string | null
  email: string
  addedAt?: string
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
  
  // Coach management state
  const [owner, setOwner] = useState<Coach | null>(null)
  const [coCoaches, setCoCoaches] = useState<Coach[]>([])
  const [showCoachForm, setShowCoachForm] = useState(false)
  const [coachFormData, setCoachFormData] = useState({ email: "" })
  const [coachFormSubmitting, setCoachFormSubmitting] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assigningClientId, setAssigningClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ email: "" })
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")

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

  // Questionnaire bundle state
  const [showQuestionnaireForm, setShowQuestionnaireForm] = useState(false)
  const [questionnaireSubmitting, setQuestionnaireSubmitting] = useState(false)
  const [questionnaireError, setQuestionnaireError] = useState<string | null>(null)
  const [questionnaireSuccess, setQuestionnaireSuccess] = useState<string | null>(null)
  const [questionnaireJson, setQuestionnaireJson] = useState<any>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | "">("")

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
    if (session && cohortId) {
      // Reset state when cohort changes
      setCohort(null)
      setClients([])
      setInvites([])
      setError(null)
      const loadData = async () => {
        setLoading(true)
        try {
          await Promise.all([fetchCohort(), fetchClients(), fetchCheckInConfig(), fetchAvailableClients(), fetchCoaches(), fetchQuestionnaireBundle()])
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
        const errorData = await res.json().catch(() => ({}))
        console.error("Error fetching available clients:", res.status, errorData)
        // Don't show error to user - the UI will show "No available clients" message
        setAvailableClients([])
      }
    } catch (err) {
      console.error("Error fetching available clients:", err)
      // Don't show error to user - the UI will show "No available clients" message
      setAvailableClients([])
    }
  }

  const fetchCoaches = async () => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/coaches`)
      if (res.ok) {
        const data = await res.json()
        setOwner(data.owner || null)
        setCoCoaches(data.coCoaches || [])
      }
    } catch (err) {
      console.error("Error fetching coaches:", err)
    }
  }

  const fetchQuestionnaireBundle = async () => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/questionnaire`)
      if (res.ok) {
        const data = await res.json()
        setQuestionnaireJson(data.bundleJson)
      }
    } catch (err) {
      console.error("Error fetching questionnaire bundle:", err)
      // Not critical - just means no bundle exists yet
    }
  }

  const handleLoadTemplate = () => {
    if (!selectedTemplate) return
    
    const template = DEFAULT_TEMPLATES[selectedTemplate]
    if (template) {
      setQuestionnaireJson(template)
      setQuestionnaireError(null)
    }
  }

  const handleSaveQuestionnaire = async (json: any) => {
    setQuestionnaireSubmitting(true)
    setQuestionnaireError(null)
    setQuestionnaireSuccess(null)

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleJson: json }),
      })

      if (res.ok) {
        setQuestionnaireSuccess("Questionnaire bundle saved successfully!")
        setShowQuestionnaireForm(false)
        await fetchQuestionnaireBundle()
        setTimeout(() => setQuestionnaireSuccess(null), 3000)
      } else {
        const data = await res.json()
        setQuestionnaireError(data.error || "Failed to save questionnaire bundle")
      }
    } catch (err) {
      setQuestionnaireError("Failed to save questionnaire bundle")
    } finally {
      setQuestionnaireSubmitting(false)
    }
  }

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault()
    setCoachFormSubmitting(true)
    setCoachError(null)

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/coaches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coachFormData),
      })

      if (res.ok) {
        await fetchCoaches()
        setShowCoachForm(false)
        setCoachFormData({ email: "" })
      } else {
        const data = await res.json()
        setCoachError(data.error || "Failed to add co-coach")
      }
    } catch (err) {
      setCoachError("Failed to add co-coach")
    } finally {
      setCoachFormSubmitting(false)
    }
  }

  const handleRemoveCoach = async (coachId: string, coachName: string | null) => {
    if (!confirm(`Remove ${coachName || "this coach"} as co-coach?`)) {
      return
    }

    try {
      const res = await fetch(`/api/cohorts/${cohortId}/coaches?coachId=${coachId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        await fetchCoaches()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to remove co-coach")
      }
    } catch (err) {
      alert("Failed to remove co-coach")
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
              Created {new Date(cohort.createdAt).toLocaleDateString("en-US", {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC'
              })}
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

        {/* Coach Management Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Coaches</h2>
            {cohort.coachId === session.user.id && (
              <button
                onClick={() => {
                  setShowCoachForm(!showCoachForm)
                  setCoachError(null)
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {showCoachForm ? "Cancel" : "Add Co-Coach"}
              </button>
            )}
          </div>

          {showCoachForm && (
            <div className="mb-4 p-4 bg-neutral-50 rounded">
              {coachError && (
                <div className="mb-3 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                  {coachError}
                </div>
              )}
              <form onSubmit={handleAddCoach} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Coach Email</label>
                  <input
                    type="email"
                    required
                    value={coachFormData.email}
                    onChange={(e) => {
                      setCoachFormData({ email: e.target.value })
                      if (coachError) setCoachError(null)
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="coach@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={coachFormSubmitting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {coachFormSubmitting ? "Adding..." : "Add Co-Coach"}
                </button>
              </form>
            </div>
          )}

          <div className="space-y-3">
            {owner && (
              <div className="p-4 border rounded-lg bg-blue-50">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{owner.name || "No name"}</p>
                    <p className="text-sm text-neutral-600">{owner.email}</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full">Owner</span>
                </div>
              </div>
            )}
            
            {coCoaches.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-neutral-600 mt-4">Co-Coaches</h3>
                {coCoaches.map((coach) => (
                  <div key={coach.id} className="p-4 border rounded-lg hover:bg-neutral-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{coach.name || "No name"}</p>
                        <p className="text-sm text-neutral-600">{coach.email}</p>
                        {coach.addedAt && (
                          <p className="text-xs text-neutral-500 mt-1">
                            Added {new Date(coach.addedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {cohort.coachId === session.user.id && (
                        <button
                          onClick={() => handleRemoveCoach(coach.id, coach.name)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {!owner && coCoaches.length === 0 && (
              <p className="text-neutral-500 text-sm">No coaches found</p>
            )}
          </div>
        </div>

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
                        checked={checkInConfig.enabledPrompts.includes("perceivedStress")}
                        onChange={(e) => {
                          const prompts = e.target.checked
                            ? [...checkInConfig.enabledPrompts, "perceivedStress"]
                            : checkInConfig.enabledPrompts.filter((p) => p !== "perceivedStress")
                          setCheckInConfig({ ...checkInConfig, enabledPrompts: prompts })
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Perceived Stress (1-10 scale)</span>
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
                        if (p === "perceivedStress") return "Perceived Stress"
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

        {/* Questionnaire Bundle Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Weekly Questionnaire Bundle</h2>
              <p className="text-sm text-neutral-500 mt-1">
                Create a custom questionnaire for clients to complete weekly
              </p>
            </div>
            <button
              onClick={() => {
                setShowQuestionnaireForm(!showQuestionnaireForm)
                setQuestionnaireError(null)
                setQuestionnaireSuccess(null)
                if (!showQuestionnaireForm) {
                  fetchQuestionnaireBundle()
                }
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
            >
              {showQuestionnaireForm ? "Cancel" : questionnaireJson ? "Edit Bundle" : "Create Bundle"}
            </button>
          </div>

          {questionnaireSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm">
              {questionnaireSuccess}
            </div>
          )}

          {questionnaireError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
              {questionnaireError}
            </div>
          )}

          {showQuestionnaireForm && (
            <div className="border-t pt-4 mt-4">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Load Default Template</label>
                <div className="flex gap-2">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value as TemplateKey | "")}
                    className="flex-1 px-3 py-2 border rounded-md"
                  >
                    <option value="">Select a template...</option>
                    <option value="week1">Week 1 - First Week Check-In</option>
                    <option value="week2">Week 2 - Progress Check-In</option>
                    <option value="week3">Week 3 - Mid-Program Check-In</option>
                    <option value="week4">Week 4 - Monthly Reflection</option>
                    <option value="week5">Week 5 - Final Check-In</option>
                  </select>
                  <button
                    onClick={handleLoadTemplate}
                    disabled={!selectedTemplate}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Load Template
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Select a pre-built template or create your own questionnaire from scratch
                </p>
              </div>

              <div className="border rounded-lg p-4 bg-neutral-50 min-h-[600px]">
                <SurveyCreatorContainer
                  json={questionnaireJson}
                  onSaveClick={handleSaveQuestionnaire}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuestionnaireForm(false)
                    setQuestionnaireError(null)
                    setQuestionnaireSuccess(null)
                  }}
                  className="bg-gray-200 text-neutral-700 px-6 py-2 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showQuestionnaireForm && (
            <div className="text-sm text-neutral-600">
              {questionnaireJson ? (
                <div>
                  <p className="text-green-600 font-medium mb-2">✓ Questionnaire bundle is configured</p>
                  <p className="text-neutral-500">
                    Clients can access weekly questionnaires from their dashboard.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-amber-600 font-medium mb-2">No questionnaire bundle set up</p>
                  <p className="text-neutral-500">
                    Create a questionnaire bundle to enable weekly check-ins for your clients.
                  </p>
                </div>
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
              <div className="pb-6 border-b border-neutral-200">
                <h3 className="text-sm font-semibold mb-2">Add Existing Client</h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Select a client from your roster to add to this cohort.
                </p>
                {availableClients.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-neutral-500 italic">
                    No available clients. All your clients are already in this cohort, or you need to invite new clients first.
                  </p>
                )}
              </div>

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
              <>
                {/* Search Bar */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search clients by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
                  />
                </div>

                {(() => {
                  // Filter clients based on search query
                  const filteredClients = clients.filter((client) => {
                    if (!searchQuery) return true
                    const query = searchQuery.toLowerCase()
                    return (
                      client.email.toLowerCase().includes(query) ||
                      client.name?.toLowerCase().includes(query)
                    )
                  })

                  return filteredClients.length === 0 ? (
                    <p className="text-neutral-500 py-2 text-center">
                      No clients found matching "{searchQuery}"
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredClients.map((client, index) => (
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
                  )
                })()}
              </>
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
