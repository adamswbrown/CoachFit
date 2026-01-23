"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"

interface Coach {
  id: string
  name: string | null
  email: string
}

export default function CreateCohortPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const today = new Date().toISOString().split("T")[0]
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loadingCoaches, setLoadingCoaches] = useState(true)
  const [coachSearch, setCoachSearch] = useState("")
  const [customTypes, setCustomTypes] = useState<Array<{ id: string; label: string; description?: string | null }>>([])
  const [customTypesLoading, setCustomTypesLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    cohortStartDate: today,
    ownerCoachId: "",
    coCoaches: [] as string[],
    durationWeeks: 6,
    membershipDurationMonths: "" as string,
    type: "TIMED" as "TIMED" | "ONGOING" | "CHALLENGE" | "CUSTOM",
    customCohortTypeId: "",
    customTypeLabel: "",
    checkInFrequencyDays: "" as string,
    checkInConfig: {
      enabledPrompts: ["weightLbs", "steps", "calories", "perceivedStress"] as string[],
      customPrompt1: "",
      customPrompt1Type: "" as "scale" | "text" | "number" | "",
    },
  })

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
    if (session && isAdmin(session.user)) {
      fetchCoaches()
    } else {
      setLoadingCoaches(false)
    }
  }, [session])

  useEffect(() => {
    if (session) {
      fetchCustomTypes()
    }
  }, [session])

  const fetchCoaches = async () => {
    try {
      const res = await fetch("/api/admin/coaches")
      if (res.ok) {
        const data = await res.json()
        setCoaches(data.coaches || [])
      }
    } catch (err) {
      console.error("Error fetching coaches:", err)
    } finally {
      setLoadingCoaches(false)
    }
  }

  const fetchCustomTypes = async () => {
    setCustomTypesLoading(true)
    try {
      const res = await fetch("/api/custom-cohort-types")
      if (res.ok) {
        const data = await res.json()
        setCustomTypes(data.types || [])
      }
    } catch (err) {
      console.error("Error fetching custom cohort types:", err)
    } finally {
      setCustomTypesLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const requestBody: any = {
        name: formData.name,
        cohortStartDate: formData.cohortStartDate,
        durationConfig: formData.type.toLowerCase(),
        type: formData.type,
      }

      if (formData.type === "ONGOING") {
        if (formData.membershipDurationMonths.trim()) {
          requestBody.membershipDurationMonths = Number(formData.membershipDurationMonths)
        }
      } else {
        requestBody.durationWeeks = formData.durationWeeks
      }

      if (isAdmin(session?.user) && formData.ownerCoachId) {
        requestBody.ownerCoachId = formData.ownerCoachId
      }

      if (formData.coCoaches.length > 0) {
        requestBody.coCoaches = formData.coCoaches
      }

      if (formData.type === "CUSTOM") {
        if (formData.customCohortTypeId) {
          requestBody.customCohortTypeId = formData.customCohortTypeId
        }
        if (formData.customTypeLabel.trim()) {
          requestBody.customTypeLabel = formData.customTypeLabel.trim()
        }
      }

      if (formData.checkInFrequencyDays.trim()) {
        requestBody.checkInFrequencyDays = Number(formData.checkInFrequencyDays)
      }

      if (
        formData.checkInConfig.enabledPrompts.length > 0 ||
        formData.checkInConfig.customPrompt1.trim() !== ""
      ) {
        requestBody.checkInConfig = {
          enabledPrompts:
            formData.checkInConfig.enabledPrompts.length > 0
              ? formData.checkInConfig.enabledPrompts
              : undefined,
          customPrompt1:
            formData.checkInConfig.customPrompt1.trim() !== ""
              ? formData.checkInConfig.customPrompt1.trim()
              : undefined,
          customPrompt1Type:
            formData.checkInConfig.customPrompt1.trim() !== ""
              ? formData.checkInConfig.customPrompt1Type
              : undefined,
        }
      }

      const res = await fetch("/api/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (res.ok) {
        setSuccess("Cohort created successfully!")
        setTimeout(() => router.push("/cohorts"), 1500)
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to create cohort")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "loading" || loadingCoaches) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading...</p>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

  const isAdminUser = isAdmin(session.user)
  const ownerEmail = coaches.find((coach) => coach.id === formData.ownerCoachId)?.email
  const availableCoaches = coaches.filter(
    (coach) =>
      coach.email !== session.user.email &&
      coach.email !== ownerEmail &&
      !formData.coCoaches.includes(coach.email)
  )
  const filteredCoaches = coachSearch.trim()
    ? availableCoaches.filter((coach) =>
        `${coach.name ?? ""} ${coach.email}`.toLowerCase().includes(coachSearch.trim().toLowerCase())
      )
    : availableCoaches

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link href="/cohorts" className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block">
            ← Back to Cohorts
          </Link>
          <h1 className="text-3xl font-semibold text-neutral-900">Create New Cohort</h1>
          <p className="text-neutral-600 mt-2">Set up a new cohort with coaches and configure check-in settings.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
          {/* Left Column: Basic Info + Ownership */}
          <div className="col-span-1 space-y-6">
            {/* Cohort Name */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <label htmlFor="name" className="block text-sm font-semibold mb-3">
                Cohort Name *
              </label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                maxLength={255}
                placeholder="e.g., Morning Group"
              />
            </div>

            {/* Cohort Start Date */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <label htmlFor="cohortStartDate" className="block text-sm font-semibold mb-3">
                Cohort Start Date *
              </label>
              <input
                id="cohortStartDate"
                type="date"
                required
                value={formData.cohortStartDate}
                onChange={(e) => setFormData({ ...formData, cohortStartDate: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Cohort Type */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <label htmlFor="cohortType" className="block text-sm font-semibold mb-3">
                Cohort Type *
              </label>
              <select
                id="cohortType"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as typeof formData.type,
                    customCohortTypeId: "",
                    customTypeLabel: "",
                    durationWeeks:
                      e.target.value === "CHALLENGE"
                        ? 6
                        : e.target.value === "ONGOING"
                          ? formData.durationWeeks
                          : 6,
                    membershipDurationMonths:
                      e.target.value === "ONGOING" ? "6" : "",
                  })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="TIMED">Timed (fixed duration)</option>
                <option value="ONGOING">Ongoing membership</option>
                <option value="CHALLENGE">Challenge</option>
                <option value="CUSTOM">Custom</option>
              </select>
              <p className="text-xs text-neutral-500 mt-2">
                Choose the cohort structure to control status display and reporting.
              </p>

              {formData.type === "CUSTOM" && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label htmlFor="customCohortTypeId" className="block text-xs font-semibold text-neutral-600 mb-2">
                      Custom Type
                    </label>
                    <select
                      id="customCohortTypeId"
                      value={formData.customCohortTypeId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customCohortTypeId: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select a custom type</option>
                      {customTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {customTypesLoading && (
                      <p className="text-xs text-neutral-400 mt-2">Loading custom types...</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="customTypeLabel" className="block text-xs font-semibold text-neutral-600 mb-2">
                      Custom Label (optional override)
                    </label>
                    <input
                      id="customTypeLabel"
                      type="text"
                      value={formData.customTypeLabel}
                      onChange={(e) => setFormData({ ...formData, customTypeLabel: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      maxLength={80}
                      placeholder="e.g., 90-Day Reset"
                    />
                  </div>
                </div>
              )}

              <div className="mt-6 border-t border-neutral-200 pt-4">
                <p className="text-sm font-semibold mb-3">Program Duration *</p>
                {formData.type === "ONGOING" ? (
                  <div>
                    <label htmlFor="membershipDurationMonths" className="block text-sm font-medium text-neutral-900 mb-2">
                      Membership Type
                    </label>
                    <select
                      id="membershipDurationMonths"
                      value={formData.membershipDurationMonths}
                      onChange={(e) => setFormData({ ...formData, membershipDurationMonths: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="6">6-month membership</option>
                      <option value="12">12-month membership</option>
                    </select>
                  </div>
                ) : formData.type === "CHALLENGE" ? (
                  <div>
                    <label htmlFor="challengeDurationWeeks" className="block text-sm font-medium text-neutral-900 mb-2">
                      Challenge Length
                    </label>
                    <select
                      id="challengeDurationWeeks"
                      value={String(formData.durationWeeks)}
                      onChange={(e) =>
                        setFormData({ ...formData, durationWeeks: parseInt(e.target.value, 10) || 6 })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="6">6 weeks</option>
                      <option value="8">8 weeks</option>
                      <option value="12">12 weeks</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="durationWeeks" className="block text-sm font-medium text-neutral-900 mb-2">
                      Duration (weeks)
                    </label>
                    <input
                      id="durationWeeks"
                      type="number"
                      min="1"
                      max="52"
                      required={formData.type !== "ONGOING"}
                      value={formData.durationWeeks}
                      onChange={(e) =>
                        setFormData({ ...formData, durationWeeks: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Enter number of weeks"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Check-in Frequency */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <label htmlFor="checkInFrequencyDays" className="block text-sm font-semibold mb-3">
                Check-in Frequency (days)
              </label>
              <input
                id="checkInFrequencyDays"
                type="number"
                min={1}
                max={365}
                value={formData.checkInFrequencyDays}
                onChange={(e) => setFormData({ ...formData, checkInFrequencyDays: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Leave blank to use user or system defaults"
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, checkInFrequencyDays: "7" })}
                  className="px-3 py-1 text-xs rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                >
                  Weekly (7)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, checkInFrequencyDays: "14" })}
                  className="px-3 py-1 text-xs rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                >
                  Bi-weekly (14)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, checkInFrequencyDays: "30" })}
                  className="px-3 py-1 text-xs rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                >
                  Monthly (30)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, checkInFrequencyDays: "" })}
                  className="px-3 py-1 text-xs rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                >
                  Use defaults
                </button>
              </div>
            </div>

            {/* Cohort Owner (if admin) */}
            {isAdminUser && (
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                <label htmlFor="ownerCoachId" className="block text-sm font-semibold text-blue-900 mb-3">
                  Cohort Owner
                </label>
                <select
                  id="ownerCoachId"
                  value={formData.ownerCoachId}
                  onChange={(e) => setFormData({ ...formData, ownerCoachId: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">
                    {session.user.name || session.user.email} (Admin)
                  </option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name || coach.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isAdminUser && (
              <div className="bg-green-50 rounded-lg border border-green-200 p-6">
                <p className="text-sm font-semibold text-green-900 mb-2">Owner</p>
                <p className="text-sm text-green-800">
                  {session.user.name || session.user.email}
                </p>
              </div>
            )}

          </div>

          {/* Middle Column: Co-Coaches */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg border border-neutral-200 p-6 h-full flex flex-col">
              <h3 className="text-sm font-semibold mb-3">Co-Coaches</h3>
              <p className="text-xs text-neutral-600 mb-4">Add other coaches to manage this cohort</p>

              {isAdminUser && (
                <div className="mb-4 space-y-2">
                  <input
                    type="text"
                    value={coachSearch}
                    onChange={(e) => setCoachSearch(e.target.value)}
                    className="w-full px-2 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    placeholder="Search coaches by name or email"
                  />
                  <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100 bg-neutral-50">
                    {filteredCoaches.length === 0 ? (
                      <p className="text-xs text-neutral-500 px-3 py-2">No coaches match that search</p>
                    ) : (
                      filteredCoaches.map((coach) => (
                        <div key={coach.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <div className="text-xs">
                            <p className="font-medium text-neutral-900">{coach.name || coach.email}</p>
                            <p className="text-neutral-600">{coach.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, coCoaches: [...formData.coCoaches, coach.email] })
                              setCoachSearch("")
                            }}
                            className="text-xs font-medium text-blue-700 hover:text-blue-900"
                          >
                            Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Selected Co-Coaches List */}
              <div className="flex-1 mb-4 space-y-2 min-h-20">
                {formData.coCoaches.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-2">No co-coaches added yet</p>
                ) : (
                  formData.coCoaches.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-blue-50 rounded border border-blue-100 group">
                      <span className="text-xs truncate flex-1">{email}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            coCoaches: formData.coCoaches.filter((_, i) => i !== idx),
                          })
                        }}
                        className="text-red-600 hover:text-red-800 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Coach Input (fallback) */}
              <div className="flex gap-2">
                <input
                  type="email"
                  id="coCoachEmail"
                  className="flex-1 px-2 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  placeholder="Add by email (optional)"
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("coCoachEmail") as HTMLInputElement
                    const email = input?.value.trim()
                    if (email && !formData.coCoaches.includes(email)) {
                      setFormData({
                        ...formData,
                        coCoaches: [...formData.coCoaches, email],
                      })
                      if (input) input.value = ""
                    }
                  }}
                  className="px-3 py-2 bg-neutral-200 text-neutral-900 rounded-lg hover:bg-neutral-300 text-xs font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Check-in Configuration */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg border border-neutral-200 p-6 h-full overflow-y-auto max-h-[600px]">
              <h3 className="text-sm font-semibold mb-3">Check-in Prompts</h3>
              <p className="text-xs text-neutral-600 mb-4">Configure what clients see</p>

              {/* Mandatory */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-neutral-700 mb-2">Always Enabled:</p>
                <div className="space-y-1 text-xs text-neutral-600">
                  <label className="flex items-center cursor-not-allowed opacity-60">
                    <input type="checkbox" checked disabled className="mr-2" />
                    Weight (lbs)
                  </label>
                  <label className="flex items-center cursor-not-allowed opacity-60">
                    <input type="checkbox" checked disabled className="mr-2" />
                    Steps
                  </label>
                  <label className="flex items-center cursor-not-allowed opacity-60">
                    <input type="checkbox" checked disabled className="mr-2" />
                    Calories
                  </label>
                  <label className="flex items-center cursor-not-allowed opacity-60">
                    <input type="checkbox" checked disabled className="mr-2" />
                    Perceived Stress (1-10 scale)
                  </label>
                </div>
              </div>

              <hr className="my-4" />

              {/* Optional Prompts */}
              <p className="text-xs font-semibold text-neutral-700 mb-3">Optional:</p>
              <div className="space-y-2 mb-4">
                {[{ value: "notes", label: "Notes" }].map((prompt) => (
                  <label key={prompt.value} className="flex items-center text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.checkInConfig.enabledPrompts.includes(prompt.value)}
                      onChange={(e) => {
                        const prompts = e.target.checked
                          ? [...formData.checkInConfig.enabledPrompts, prompt.value]
                          : formData.checkInConfig.enabledPrompts.filter((p) => p !== prompt.value)
                        setFormData({
                          ...formData,
                          checkInConfig: { ...formData.checkInConfig, enabledPrompts: prompts },
                        })
                      }}
                      className="mr-2"
                    />
                    {prompt.label}
                  </label>
                ))}
              </div>

              <hr className="my-4" />

              {/* Custom Prompt */}
              <p className="text-xs font-semibold text-neutral-700 mb-2">Custom Prompt:</p>
              <input
                type="text"
                value={formData.checkInConfig.customPrompt1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    checkInConfig: { ...formData.checkInConfig, customPrompt1: e.target.value },
                  })
                }
                className="w-full px-2 py-1 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs mb-2"
                placeholder="e.g., How was energy?"
                maxLength={255}
              />
              {formData.checkInConfig.customPrompt1 && (
                <select
                  value={formData.checkInConfig.customPrompt1Type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      checkInConfig: {
                        ...formData.checkInConfig,
                        customPrompt1Type: e.target.value as "scale" | "text" | "number" | "",
                      },
                    })
                  }
                  className="w-full px-2 py-1 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                >
                  <option value="">Type...</option>
                  <option value="scale">Scale (1-10)</option>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
              )}
            </div>
          </div>

          {/* Full Width: Action Buttons */}
          <div className="col-span-3 flex gap-3">
            <button
              type="submit"
              disabled={submitting || !formData.name}
              className="flex-1 bg-neutral-900 text-white px-6 py-3 rounded-lg hover:bg-neutral-800 disabled:opacity-50 font-medium transition-colors"
            >
              {submitting ? "Creating..." : "Create Cohort"}
            </button>
            <Link
              href="/cohorts"
              className="flex-1 bg-neutral-100 text-neutral-900 px-6 py-3 rounded-lg hover:bg-neutral-200 text-center font-medium transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </CoachLayout>
  )
}
