"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isAdmin } from "@/lib/permissions"
import { ClientLayout } from "@/components/layouts/ClientLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"

interface Entry {
  id: string
  date: string
  weightLbs: number | null
  steps: number | null
  calories: number | null
  heightInches: number | null
  sleepQuality: number | null
  perceivedEffort: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface Workout {
  id: string
  workoutType: string
  startTime: string
  endTime: string
  durationSecs: number
  caloriesActive: number | null
  distanceMeters: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
  sourceDevice: string | null
  createdAt: string
}

export default function ClientDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasCoach, setHasCoach] = useState<boolean | null>(null)

  const [formData, setFormData] = useState({
    weightLbs: "",
    steps: "",
    calories: "",
    sleepQuality: "",
    perceivedEffort: "",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  })
  const [existingEntry, setExistingEntry] = useState<Entry | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [checkInConfig, setCheckInConfig] = useState<{
    enabledPrompts: string[]
    customPrompt1: string | null
    customPrompt1Type: string | null
  } | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && "roles" in session.user && Array.isArray(session.user.roles) && session.user.roles.includes("COACH")) {
      router.push("/coach-dashboard")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session) {
      checkCohortMembership()
      fetchEntries()
      fetchCheckInConfig()
      fetchWorkouts()
    }
  }, [session])

  const fetchCheckInConfig = async () => {
    try {
      const res = await fetch("/api/entries/check-in-config")
      if (res.ok) {
        const data = await res.json()
        setCheckInConfig({
          enabledPrompts: data.enabledPrompts || [],
          customPrompt1: data.customPrompt1 || null,
          customPrompt1Type: data.customPrompt1Type || null,
        })
      }
    } catch (err) {
      console.error("Error fetching check-in config:", err)
      // Default to showing all prompts if config fetch fails
      setCheckInConfig({
        enabledPrompts: ["sleepQuality", "perceivedEffort", "notes"],
        customPrompt1: null,
        customPrompt1Type: null,
      })
    }
  }

  // Load existing entry when date changes
  useEffect(() => {
    if (formData.date && entries.length > 0) {
      const entryForDate = entries.find(
        (e) => e.date.split("T")[0] === formData.date
      )
      if (entryForDate) {
        setExistingEntry(entryForDate)
        setIsEditing(true)
        // Pre-fill form with existing data
        setFormData({
          weightLbs: entryForDate.weightLbs?.toString() || "",
          steps: entryForDate.steps?.toString() || "",
          calories: entryForDate.calories?.toString() || "",
          sleepQuality: entryForDate.sleepQuality?.toString() || "",
          perceivedEffort: entryForDate.perceivedEffort?.toString() || "",
          notes: entryForDate.notes || "",
          date: formData.date,
        })
      } else {
        setExistingEntry(null)
        setIsEditing(false)
        // Clear optional fields when switching to a new date
        setFormData((prev) => ({
          ...prev,
          sleepQuality: "",
          perceivedEffort: "",
          notes: "",
          date: prev.date,
        }))
      }
    } else if (formData.date && entries.length === 0) {
      setExistingEntry(null)
      setIsEditing(false)
    }
  }, [formData.date, entries])

  const checkCohortMembership = async () => {
    try {
      const res = await fetch("/api/entries/check-membership")
      if (res.ok) {
        const data = await res.json()
        setHasCoach(data.hasMembership)
      }
    } catch (err) {
      console.error("Error checking membership:", err)
      setHasCoach(false)
    }
  }

  const fetchEntries = async (isRetry: boolean = false) => {
    if (!isRetry) {
      setLoading(true)
      setError(null)
    }
    try {
      const entriesData = await fetchWithRetry<Entry[]>("/api/entries", {}, 3, 1000)
      setEntries(entriesData)
      setError(null)
    } catch (err) {
      console.error("Error fetching entries:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load entries. Please try again."
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkouts = async () => {
    if (!session?.user?.id) return
    try {
      const res = await fetch(`/api/healthkit/workouts?clientId=${session.user.id}`)
      if (res.ok) {
        const data = await res.json()
        setWorkouts(data.workouts || [])
      }
    } catch (err) {
      console.error("Error fetching workouts:", err)
      // Don't set error state - workouts are optional
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // Build request body with only provided fields (partial entry support)
      const body: any = {
        date: formData.date,
      }

      if (formData.weightLbs && formData.weightLbs.toString().trim() !== "") {
        const parsed = parseFloat(formData.weightLbs.toString())
        if (!isNaN(parsed)) body.weightLbs = parsed
      }
      if (formData.steps && formData.steps.toString().trim() !== "") {
        const parsed = parseInt(formData.steps.toString(), 10)
        if (!isNaN(parsed)) body.steps = parsed
      }
      if (formData.calories && formData.calories.toString().trim() !== "") {
        const parsed = parseInt(formData.calories.toString(), 10)
        if (!isNaN(parsed)) body.calories = parsed
      }
      if (formData.sleepQuality && formData.sleepQuality.toString().trim() !== "") {
        const parsed = parseInt(formData.sleepQuality.toString(), 10)
        if (!isNaN(parsed)) body.sleepQuality = parsed
      }
      if (formData.perceivedEffort && formData.perceivedEffort.toString().trim() !== "") {
        const parsed = parseInt(formData.perceivedEffort.toString(), 10)
        if (!isNaN(parsed)) body.perceivedEffort = parsed
      }
      if (formData.notes && formData.notes.trim() !== "") {
        body.notes = formData.notes.trim()
      }

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(
          isEditing
            ? "Entry updated successfully!"
            : "Entry submitted successfully!"
        )
        // Refresh entries to get updated data
        await fetchEntries()
        // The response contains the updated entry, use it directly
        if (data && data.id) {
          // Convert API response to Entry format
          const updatedEntry: Entry = {
            id: data.id,
            date: data.date,
            weightLbs: data.weightLbs,
            steps: data.steps,
            calories: data.calories,
            heightInches: data.heightInches || null, // Height is part of user profile, but kept in Entry interface for backward compatibility
            sleepQuality: data.sleepQuality || null,
            perceivedEffort: data.perceivedEffort || null,
            notes: data.notes || null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          }
          setExistingEntry(updatedEntry)
          setIsEditing(true)
        }
      } else {
        const errorMsg = data.error || data.message || "Failed to submit entry"
        const details = data.details ? ` Details: ${JSON.stringify(data.details)}` : ""
        setError(`${errorMsg}${details}`)
        console.error("Entry submission error:", data)
      }
    } catch (err: any) {
      setError(`An error occurred. Please try again. ${err?.message || ""}`)
      console.error("Entry submission exception:", err)
    } finally {
      setSubmitting(false)
    }
  }

  // Get user's first name for greeting
  const firstName = session?.user?.name?.split(" ")[0] || "there"
  
  // Calculate quick stats from entries (handle null values)
  const latestEntry = entries[0]
  const weekEntries = entries.filter((e) => {
    const entryDate = new Date(e.date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return entryDate >= weekAgo
  })
  const stepsWithValues = weekEntries
    .filter((e) => e.steps !== null)
    .map((e) => e.steps!)
  const avgStepsThisWeek =
    stepsWithValues.length > 0
      ? Math.round(
          stepsWithValues.reduce((sum, s) => sum + s, 0) / stepsWithValues.length
        )
      : 0
  const totalEntriesThisWeek = weekEntries.length

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  if (status === "loading" || loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading your dashboard...</p>
          </div>
        </div>
      </ClientLayout>
    )
  }

  if (!session) {
    return null
  }

  // Show error message if fetch failed
  if (error && entries.length === 0 && !loading) {
    return (
      <ClientLayout>
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Failed to load entries</h3>
                <p className="text-red-800 text-sm mb-4">{error}</p>
                <button
                  onClick={() => fetchEntries(false)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </ClientLayout>
    )
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto">
        {/* Test user banner */}
        {session?.user && "isTestUser" in session.user && session.user.isTestUser && (
          <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
            <span className="text-amber-500">⚠️</span>
            <p className="text-amber-800 text-sm">
              Test account — emails are not delivered.
            </p>
          </div>
        )}

        {/* Greeting Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-neutral-600">
            {hasCoach === false 
              ? "Your coach will add you to their program soon."
              : "Track your progress and stay on top of your goals."}
          </p>
        </div>

        {/* No Coach Warning */}
        {hasCoach === false && (
          <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">Waiting for your coach</h3>
                <p className="text-amber-800 text-sm">
                  You're all signed up! Your coach will add you to their cohort soon. 
                  Once connected, you'll be able to log your daily entries here.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {hasCoach !== false && entries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-5 border border-neutral-200">
              <div className="text-sm text-neutral-500 mb-1">Latest Weight</div>
              <p className="text-2xl font-semibold text-neutral-900">
                {latestEntry?.weightLbs !== null && latestEntry?.weightLbs !== undefined
                  ? `${latestEntry.weightLbs.toFixed(1)} lbs`
                  : "—"}
              </p>
            </div>
            <div className="bg-white rounded-lg p-5 border border-neutral-200">
              <div className="text-sm text-neutral-500 mb-1">Avg Steps (7d)</div>
              <p className="text-2xl font-semibold text-neutral-900">
                {avgStepsThisWeek.toLocaleString() || "—"}
              </p>
            </div>
            <div className="bg-white rounded-lg p-5 border border-neutral-200">
              <div className="text-sm text-neutral-500 mb-1">Entries (7d)</div>
              <p className="text-2xl font-semibold text-neutral-900">
                {totalEntriesThisWeek} <span className="text-base font-normal text-neutral-400">/ 7</span>
              </p>
            </div>
          </div>
        )}

        {/* Recent Workouts */}
        {workouts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Recent Workouts</h2>
              <span className="text-sm text-neutral-500">{workouts.length} total</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workouts.slice(0, 6).map((workout) => {
                const duration = Math.floor(workout.durationSecs / 60)
                const distance = workout.distanceMeters ? (workout.distanceMeters / 1609.34).toFixed(2) : null
                const workoutDate = new Date(workout.startTime)
                const isToday = workoutDate.toDateString() === new Date().toDateString()
                const dateLabel = isToday
                  ? "Today"
                  : workoutDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })

                return (
                  <div key={workout.id} className="bg-white rounded-lg p-4 border border-neutral-200 hover:border-neutral-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-neutral-900 text-sm mb-1">
                          {workout.workoutType}
                        </h3>
                        <p className="text-xs text-neutral-500">{dateLabel}</p>
                      </div>
                      {isToday && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-500">Duration</span>
                        <span className="font-medium text-neutral-900">{duration} min</span>
                      </div>
                      {workout.caloriesActive !== null && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500">Calories</span>
                          <span className="font-medium text-neutral-900">{workout.caloriesActive} kcal</span>
                        </div>
                      )}
                      {distance && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500">Distance</span>
                          <span className="font-medium text-neutral-900">{distance} mi</span>
                        </div>
                      )}
                      {workout.avgHeartRate && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-500">Avg HR</span>
                          <span className="font-medium text-neutral-900">{workout.avgHeartRate} bpm</span>
                        </div>
                      )}
                    </div>
                    {workout.sourceDevice && (
                      <div className="mt-3 pt-3 border-t border-neutral-100">
                        <p className="text-xs text-neutral-400 truncate" title={workout.sourceDevice}>
                          {workout.sourceDevice}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Entry Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Log Entry Card */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-1">
                  {isEditing ? "Update Entry" : "Log Your Check-In"}
                </h2>
                <p className="text-sm text-neutral-500">
                  {isEditing
                    ? `Editing entry for ${new Date(formData.date).toLocaleDateString()}`
                    : "Track your daily progress"}
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    max={new Date().toISOString().split("T")[0]}
                    disabled={hasCoach === false}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Core Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Weight <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="1000"
                        placeholder="0.0"
                        value={formData.weightLbs}
                        onChange={(e) =>
                          setFormData({ ...formData, weightLbs: e.target.value })
                        }
                        disabled={hasCoach === false}
                        className="w-full px-4 py-2.5 pr-12 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">lbs</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Steps <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100000"
                        placeholder="0"
                        value={formData.steps}
                        onChange={(e) =>
                          setFormData({ ...formData, steps: e.target.value })
                        }
                        disabled={hasCoach === false}
                        className="w-full px-4 py-2.5 pr-16 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">steps</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Calories <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="20000"
                        placeholder="0"
                        value={formData.calories}
                        onChange={(e) =>
                          setFormData({ ...formData, calories: e.target.value })
                        }
                        disabled={hasCoach === false}
                        className="w-full px-4 py-2.5 pr-14 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">kcal</span>
                    </div>
                  </div>
                </div>

                {/* Sleep Quality - Always Visible */}
                {checkInConfig && checkInConfig.enabledPrompts.includes("sleepQuality") && (
                  <div className="pt-4 border-t border-neutral-100">
                    <label className="block text-sm font-medium text-neutral-700 mb-3">
                      Sleep Quality <span className="text-neutral-400 font-normal">(optional, 1-10)</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={formData.sleepQuality || "5"}
                        onChange={(e) =>
                          setFormData({ ...formData, sleepQuality: e.target.value })
                        }
                        disabled={hasCoach === false}
                        className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                      />
                      <span className="text-lg font-semibold text-neutral-900 min-w-[3rem] text-center">
                        {formData.sleepQuality || "5"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 mt-2">
                      <span>Terrible</span>
                      <span>Okay</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                )}

                {/* Perceived Effort - Always Visible if enabled */}
                {checkInConfig && checkInConfig.enabledPrompts.includes("perceivedEffort") && (
                  <div className="pt-4 border-t border-neutral-100">
                    <label className="block text-sm font-medium text-neutral-700 mb-3">
                      Perceived Effort <span className="text-neutral-400 font-normal">(optional, 1-10)</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={formData.perceivedEffort || "5"}
                        onChange={(e) =>
                          setFormData({ ...formData, perceivedEffort: e.target.value })
                        }
                        disabled={hasCoach === false}
                        className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                      />
                      <span className="text-lg font-semibold text-neutral-900 min-w-[3rem] text-center">
                        {formData.perceivedEffort || "5"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 mt-2">
                      <span>Very Easy</span>
                      <span>Moderate</span>
                      <span>Maximum</span>
                    </div>
                  </div>
                )}

                {/* Notes - Always Visible if enabled */}
                {checkInConfig && checkInConfig.enabledPrompts.includes("notes") && (
                  <div className="pt-4 border-t border-neutral-100">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Notes <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      placeholder="Any additional notes for your coach..."
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      disabled={hasCoach === false}
                      className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed resize-none"
                    />
                    <p className="text-xs text-neutral-500 mt-1 text-right">
                      {formData.notes.length}/2000
                    </p>
                  </div>
                )}

                {/* Custom Prompt 1 */}
                {checkInConfig && checkInConfig.customPrompt1 && (
                  <div className="pt-4 border-t border-neutral-100">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      {checkInConfig.customPrompt1} <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    {checkInConfig.customPrompt1Type === "scale" && (
                      <>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={formData.perceivedEffort || "5"}
                            onChange={(e) => {
                              setFormData({ ...formData, perceivedEffort: e.target.value })
                            }}
                            disabled={hasCoach === false}
                            className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                          />
                          <span className="text-lg font-semibold text-neutral-900 min-w-[3rem] text-center">
                            {formData.perceivedEffort || "5"}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-neutral-500 mt-2">
                          <span>1</span>
                          <span>5</span>
                          <span>10</span>
                        </div>
                      </>
                    )}
                    {checkInConfig.customPrompt1Type === "text" && (
                      <textarea
                        rows={3}
                        maxLength={2000}
                        placeholder={`${checkInConfig.customPrompt1}...`}
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        disabled={hasCoach === false}
                        className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed resize-none"
                      />
                    )}
                    {checkInConfig.customPrompt1Type === "number" && (
                      <input
                        type="number"
                        placeholder="Enter a number..."
                        value={formData.steps}
                        onChange={(e) =>
                          setFormData({ ...formData, steps: e.target.value })
                        }
                        disabled={hasCoach === false}
                        className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                      />
                    )}
                  </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                    <span>✓</span> {success}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || hasCoach === false || (!formData.weightLbs && !formData.steps && !formData.calories && !formData.sleepQuality && !formData.perceivedEffort && !formData.notes)}
                  className="w-full bg-neutral-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      {isEditing ? "Updating..." : "Saving..."}
                    </span>
                  ) : (
                    isEditing ? "Update Entry" : "Save Entry"
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column - Recent Entries */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-neutral-200 p-6 sticky top-24">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-900">Recent Entries</h2>
                <p className="text-sm text-neutral-500">{entries.length} total entries</p>
              </div>
              
              {entries.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">📝</span>
                  </div>
                  <h3 className="font-medium text-neutral-900 mb-1 text-sm">No entries yet</h3>
                  <p className="text-xs text-neutral-500">
                    {hasCoach === false 
                      ? "You'll be able to log entries once your coach adds you."
                      : "Start tracking your progress!"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entries.slice(0, 10).map((entry) => {
                    const entryDate = new Date(entry.date)
                    const isToday = entry.date === new Date().toISOString().split("T")[0]
                    const isYesterday = entry.date === new Date(Date.now() - 86400000).toISOString().split("T")[0]
                    
                    const dateLabel = isToday 
                      ? "Today" 
                      : isYesterday 
                        ? "Yesterday" 
                        : entryDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })

                    return (
                      <div 
                        key={entry.id} 
                        className={`p-3 rounded-lg border transition-all ${
                          isToday 
                            ? "bg-neutral-50 border-neutral-200" 
                            : "bg-white border-neutral-100 hover:bg-neutral-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-medium ${isToday ? "text-neutral-900" : "text-neutral-600"}`}>
                            {dateLabel}
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-neutral-200 text-neutral-700 rounded">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {entry.weightLbs !== null && (
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-500">Weight:</span>
                              <span className="font-medium text-neutral-900">{entry.weightLbs.toFixed(1)} lbs</span>
                            </div>
                          )}
                          {entry.steps !== null && (
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-500">Steps:</span>
                              <span className="font-medium text-neutral-900">{entry.steps.toLocaleString()}</span>
                            </div>
                          )}
                          {entry.calories !== null && (
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-500">Calories:</span>
                              <span className="font-medium text-neutral-900">{entry.calories.toLocaleString()}</span>
                            </div>
                          )}
                          {entry.sleepQuality !== null && (
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-500">Sleep:</span>
                              <span className="font-medium text-neutral-900">{entry.sleepQuality}/10</span>
                            </div>
                          )}
                          {entry.weightLbs === null && entry.steps === null && entry.calories === null && entry.sleepQuality === null && (
                            <div>
                              <p className="text-xs text-neutral-400 italic">No data logged</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  )
}
