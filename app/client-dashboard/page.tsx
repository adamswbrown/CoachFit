"use client"

import { useRef, useState, useEffect, useMemo, useCallback, startTransition } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isClient } from "@/lib/permissions"
import { ClientLayout } from "@/components/layouts/ClientLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { DataSourceBadge } from "@/components/DataSourceBadge"
import { useRole } from "@/contexts/RoleContext"
import { Role } from "@/lib/types"
import { QuestionnaireModal } from "@/components/questionnaire/QuestionnaireModal"
import { QuestionnaireProgress } from "@/components/questionnaire/QuestionnaireProgress"
import { WeekNumber } from "@/lib/surveyjs-config"
import { WrappedModal } from "@/components/wrapped/WrappedModal"
import type { WrappedSummary } from "@/lib/types"

interface Entry {
  id: string
  date: string
  weightLbs: number | null
  steps: number | null
  calories: number | null
  heightInches: number | null
  sleepQuality: number | null
  perceivedStress: number | null
  notes: string | null
  dataSources: string[] | null
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
  const { activeRole } = useRole()
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
    perceivedStress: "",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  })
  const [existingEntry, setExistingEntry] = useState<Entry | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [manualEditEntryId, setManualEditEntryId] = useState<string | null>(null)
  const [entryMode, setEntryMode] = useState<"add" | "edit">("add")
  const entryFormRef = useRef<HTMLDivElement | null>(null)
  const [checkInConfig, setCheckInConfig] = useState<{
    enabledPrompts: string[]
    customPrompt1: string | null
    customPrompt1Type: string | null
    effectiveCheckInFrequencyDays?: number
    lastCheckInDate?: string | null
    nextExpectedCheckInDate?: string | null
    checkInMissed?: boolean
  } | null>(null)

  // Questionnaire state
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<WeekNumber>(1)
  const [userCohorts, setUserCohorts] = useState<Array<{
    id: string
    name: string
    cohortStartDate: string | null
    type?: "TIMED" | "ONGOING" | "CHALLENGE" | "CUSTOM" | null
    customTypeLabel?: string | null
    customCohortType?: { id: string; label: string } | null
    checkInFrequencyDays?: number | null
  }>>([])
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null)
  const [selectedCohortStartDate, setSelectedCohortStartDate] = useState<string | null>(null)
  const [selectedCohortName, setSelectedCohortName] = useState<string | null>(null)
  const [selectedCohortType, setSelectedCohortType] = useState<string | null>(null)
  const [selectedCohortTypeLabel, setSelectedCohortTypeLabel] = useState<string | null>(null)
  const [selectedCohortFrequency, setSelectedCohortFrequency] = useState<number | null>(null)

  // Fitness Wrapped state
  const [showWrappedModal, setShowWrappedModal] = useState(false)
  const [wrappedData, setWrappedData] = useState<WrappedSummary | null>(null)
  const [wrappedEligible, setWrappedEligible] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (session?.user && activeRole !== null) {
      if (activeRole === Role.ADMIN) {
        router.push("/admin/overview")
        return
      }
      if (activeRole === Role.COACH) {
        router.push("/coach-dashboard")
      }
    }
  }, [status, session, router, activeRole])

  useEffect(() => {
    if (session?.user && activeRole === Role.CLIENT && isClient(session.user)) {
      checkCohortMembership()
      fetchEntries()
      fetchCheckInConfig()
      fetchWorkouts()
      fetchUserCohorts()
      fetchWrappedEligibility()
    }
  }, [session, activeRole])

  const fetchUserCohorts = async () => {
    try {
      const res = await fetch("/api/client/cohorts")
      if (res.ok) {
        const data = await res.json()
        const cohorts = data.cohorts || []
        setUserCohorts(cohorts)
        if (cohorts.length > 0) {
          setSelectedCohortId(cohorts[0].id)
          setSelectedCohortStartDate(cohorts[0].cohortStartDate || null)
          setSelectedCohortName(cohorts[0].name)
          setSelectedCohortType(cohorts[0].type || null)
          setSelectedCohortTypeLabel(cohorts[0].customTypeLabel || cohorts[0].customCohortType?.label || null)
          setSelectedCohortFrequency(cohorts[0].checkInFrequencyDays || null)
        } else {
          setSelectedCohortId(null)
          setSelectedCohortStartDate(null)
          setSelectedCohortName(null)
          setSelectedCohortType(null)
          setSelectedCohortTypeLabel(null)
          setSelectedCohortFrequency(null)
        }
      }
    } catch (err) {
      console.error("Error fetching user cohorts:", err)
    }
  }

  const handleCohortSelect = (cohortId: string) => {
    setSelectedCohortId(cohortId || null)
    const selected = userCohorts.find((cohort) => cohort.id === cohortId) || null
    setSelectedCohortStartDate(selected?.cohortStartDate || null)
    setSelectedCohortName(selected?.name || null)
    setSelectedCohortType(selected?.type || null)
    setSelectedCohortTypeLabel(selected?.customTypeLabel || selected?.customCohortType?.label || null)
    setSelectedCohortFrequency(selected?.checkInFrequencyDays || null)
  }

  const handleWeekClick = (weekNumber: WeekNumber) => {
    setSelectedWeek(weekNumber)
    setShowQuestionnaireModal(true)
  }

  const fetchCheckInConfig = async () => {
    try {
      const res = await fetch("/api/entries/check-in-config")
      if (res.ok) {
        const data = await res.json()
        setCheckInConfig({
          enabledPrompts: data.enabledPrompts || [],
          customPrompt1: data.customPrompt1 || null,
          customPrompt1Type: data.customPrompt1Type || null,
          effectiveCheckInFrequencyDays: data.effectiveCheckInFrequencyDays,
          lastCheckInDate: data.lastCheckInDate ?? null,
          nextExpectedCheckInDate: data.nextExpectedCheckInDate ?? null,
          checkInMissed: data.checkInMissed ?? false,
        })
      }
    } catch (err) {
      console.error("Error fetching check-in config:", err)
      // Default to showing all prompts if config fetch fails
      setCheckInConfig({
        enabledPrompts: ["sleepQuality", "perceivedStress", "notes"],
        customPrompt1: null,
        customPrompt1Type: null,
        effectiveCheckInFrequencyDays: undefined,
        lastCheckInDate: null,
        nextExpectedCheckInDate: null,
        checkInMissed: false,
      })
    }
  }

  const fetchWrappedEligibility = async () => {
    try {
      const response = await fetchWithRetry("/api/client/wrapped")
      if (response.ok) {
        const data = await response.json()
        console.log("✅ Wrapped data received:", data)
        setWrappedData(data)
        setWrappedEligible(true)
      } else {
        // Not eligible yet - this is normal for active cohorts
        const errorData = await response.json()
        console.log("⚠️ Wrapped not eligible:", errorData)
        setWrappedEligible(false)
      }
    } catch (error) {
      console.error("❌ Error fetching wrapped:", error)
      setWrappedEligible(false)
    }
  }

  const resetFormForDate = (date: string) => {
    setFormData({
      weightLbs: "",
      steps: "",
      calories: "",
      sleepQuality: "",
      perceivedStress: "",
      notes: "",
      date,
    })
  }

  const loadEntryForEditing = (entry: Entry) => {
    setManualEditEntryId(entry.id)
    setExistingEntry(entry)
    setIsEditing(true)
    setEntryMode("edit")
    setFormData({
      weightLbs: entry.weightLbs?.toString() || "",
      steps: entry.steps?.toString() || "",
      calories: entry.calories?.toString() || "",
      sleepQuality: entry.sleepQuality?.toString() || "",
      perceivedStress: entry.perceivedStress?.toString() || "",
      notes: entry.notes || "",
      date: entry.date.split("T")[0],
    })
    requestAnimationFrame(() => {
      entryFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  // Load existing entry when date changes
  useEffect(() => {
    if (formData.date && entries.length > 0) {
      const entryForDate = entries.find(
        (e) => e.date.split("T")[0] === formData.date
      )
      if (entryForDate) {
        if (manualEditEntryId === entryForDate.id) {
          return
        }
        setExistingEntry(entryForDate)
        if (entryMode === "edit") {
          loadEntryForEditing(entryForDate)
          return
        }
        setIsEditing(false)
        resetFormForDate(formData.date)
      } else {
        setExistingEntry(null)
        setIsEditing(false)
        setManualEditEntryId(null)
        resetFormForDate(formData.date)
      }
    } else if (formData.date && entries.length === 0) {
      setExistingEntry(null)
      setIsEditing(false)
      setManualEditEntryId(null)
      resetFormForDate(formData.date)
    }
  }, [entryMode, formData.date, entries])

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
      if (entryMode === "add" && existingEntry) {
        setError("Entry already exists for this date. Switch to Edit or choose another date.")
        setSubmitting(false)
        return
      }

      if (entryMode === "edit" && !existingEntry) {
        setError("Select a date with an existing entry to edit.")
        setSubmitting(false)
        return
      }

      const hasValue = (value: string | number) =>
        value !== null && value !== undefined && value.toString().trim() !== ""

      const isQuestionnaireDayEntry = isQuestionnaireDay(formData.date)

      if (
        !hasValue(formData.weightLbs) ||
        (!isQuestionnaireDayEntry && !hasValue(formData.steps)) ||
        (!isQuestionnaireDayEntry && !hasValue(formData.calories)) ||
        !hasValue(formData.perceivedStress)
      ) {
        setError(
          isQuestionnaireDayEntry
            ? "Weight and perceived stress are required."
            : "Weight, steps, calories, and perceived stress are required."
        )
        setSubmitting(false)
        return
      }

      const weightParsed = parseFloat(formData.weightLbs.toString())
      const stepsParsed = formData.steps.toString().trim() !== "" ? parseInt(formData.steps.toString(), 10) : null
      const caloriesParsed = formData.calories.toString().trim() !== "" ? parseInt(formData.calories.toString(), 10) : null
      const stressParsed = parseInt(formData.perceivedStress.toString(), 10)

      const requiredNumbers = [weightParsed, stressParsed]
      const optionalNumbers = [stepsParsed, caloriesParsed].filter((value) => value !== null)

      if (requiredNumbers.some((value) => isNaN(value)) || optionalNumbers.some((value) => isNaN(value as number))) {
        setError("Please enter valid values for all required fields.")
        setSubmitting(false)
        return
      }

      const body: any = {
        date: formData.date,
        weightLbs: weightParsed,
        perceivedStress: stressParsed,
      }

      if (stepsParsed !== null) body.steps = stepsParsed
      if (caloriesParsed !== null) body.calories = caloriesParsed

      if (formData.sleepQuality && formData.sleepQuality.toString().trim() !== "") {
        const parsed = parseInt(formData.sleepQuality.toString(), 10)
        if (!isNaN(parsed)) body.sleepQuality = parsed
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
            perceivedStress: data.perceivedStress || null,
            notes: data.notes || null,
            dataSources: data.dataSources || null,
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
  
  // Calculate quick stats from entries (memoized to avoid recalculating on every keystroke)
  const { latestEntry, weekEntries, avgStepsThisWeek, totalEntriesThisWeek } = useMemo(() => {
    const latest = entries[0]
    const week = entries.filter((e) => {
      const entryDate = new Date(e.date)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return entryDate >= weekAgo
    })
    const stepsWithValues = week
      .filter((e) => e.steps !== null)
      .map((e) => e.steps!)
    const avgSteps =
      stepsWithValues.length > 0
        ? Math.round(
            stepsWithValues.reduce((sum, s) => sum + s, 0) / stepsWithValues.length
          )
        : 0
    return { latestEntry: latest, weekEntries: week, avgStepsThisWeek: avgSteps, totalEntriesThisWeek: week.length }
  }, [entries])

  // Get greeting based on time of day (memoized)
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }, [])

  // Memoize isQuestionnaireDay to avoid recreating on every render
  const isQuestionnaireDay = useCallback((dateValue?: string) => {
    const target = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date()
    return target.getDay() === 0
  }, [])

  // Memoize submit button disabled state
  const isSubmitDisabled = useMemo(() => {
    return (
      submitting ||
      (hasCoach === false && !(entryMode === "edit" && existingEntry)) ||
      (entryMode === "add" && existingEntry !== null) ||
      (entryMode === "edit" && !existingEntry) ||
      !(
        formData.weightLbs.toString().trim() !== "" &&
        (isQuestionnaireDay(formData.date) || formData.steps.toString().trim() !== "") &&
        (isQuestionnaireDay(formData.date) || formData.calories.toString().trim() !== "") &&
        formData.perceivedStress.toString().trim() !== ""
      )
    )
  }, [submitting, hasCoach, entryMode, existingEntry, formData, isQuestionnaireDay])

  if (status === "loading" || loading || activeRole === null) {
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
        <div className="mb-6 flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900 mb-1">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-neutral-600">
              {hasCoach === false 
                ? "Your coach will add you to their program soon."
                : "Track your progress and stay on top of your goals."}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link
              href="/client-dashboard/pairing"
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors text-center"
              title="Connect your iOS device for automatic HealthKit syncing"
            >
              <span className="sm:hidden">📱</span>
              <span className="hidden sm:inline">📱 Pairing</span>
            </Link>
            <Link
              href="/client-dashboard/settings"
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors text-center"
              title="Account settings"
            >
              <span className="sm:hidden">⚙️</span>
              <span className="hidden sm:inline">⚙️ Settings</span>
            </Link>
          </div>
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
                  You're all signed up! Your coach will add you to their program soon.
                  Once connected, you'll be able to log your daily entries here.
                </p>
              </div>
            </div>
          </div>
        )}

        {hasCoach !== false && selectedCohortId && (
          <div className="mb-6 bg-white border border-neutral-200 rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-400">Program</p>
                <p className="text-lg font-semibold text-neutral-900">{selectedCohortName || "—"}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-neutral-600">
                <span>
                  Type:{" "}
                  <span className="text-neutral-900">
                    {selectedCohortType === "TIMED"
                      ? "Timed"
                      : selectedCohortType === "ONGOING"
                        ? "Ongoing"
                        : selectedCohortType === "CHALLENGE"
                          ? "Challenge"
                          : selectedCohortType === "CUSTOM"
                            ? `Custom${selectedCohortTypeLabel ? ` — ${selectedCohortTypeLabel}` : ""}`
                            : "—"}
                  </span>
                </span>
                <span>
                  Frequency:{" "}
                  <span className="text-neutral-900">
                    {checkInConfig?.effectiveCheckInFrequencyDays
                      ? `${checkInConfig.effectiveCheckInFrequencyDays} days`
                      : selectedCohortFrequency
                        ? `${selectedCohortFrequency} days`
                        : "Defaults"}
                  </span>
                </span>
                <span>
                  Last check-in:{" "}
                  <span className="text-neutral-900">
                    {checkInConfig?.lastCheckInDate
                      ? new Date(checkInConfig.lastCheckInDate).toLocaleDateString()
                      : "—"}
                  </span>
                </span>
                <span>
                  Next expected:{" "}
                  <span className={checkInConfig?.checkInMissed ? "text-red-600 font-medium" : "text-neutral-900"}>
                    {checkInConfig?.nextExpectedCheckInDate
                      ? new Date(checkInConfig.nextExpectedCheckInDate).toLocaleDateString()
                      : "—"}
                  </span>
                </span>
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

        {/* Fitness Wrapped Card (shows when 6 or 8 week challenge completes) */}
        {wrappedEligible && wrappedData && (
          <div className="mb-6 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-xl p-8 shadow-xl text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold mb-3">🎉 Your Fitness Wrapped is Ready!</h2>
                <p className="text-lg mb-1 opacity-95">
                  You completed the challenge! See your amazing progress and fun stats.
                </p>
                <p className="text-sm opacity-80">
                  {wrappedData.cohortName || "Your Challenge"} • {wrappedData.dateRange.startDate ? new Date(wrappedData.dateRange.startDate).toLocaleDateString() : ''} - {wrappedData.dateRange.endDate ? new Date(wrappedData.dateRange.endDate).toLocaleDateString() : ''}
                </p>
              </div>
              <button
                onClick={() => setShowWrappedModal(true)}
                className="px-8 py-4 bg-white text-purple-600 rounded-full font-bold text-lg hover:scale-105 transition shadow-lg whitespace-nowrap"
              >
                View Your Wrapped →
              </button>
            </div>
          </div>
        )}

        {/* Weekly Questionnaire Card (Sundays only) - Hidden when wrapped is available */}
        {hasCoach !== false && selectedCohortId && isQuestionnaireDay() && !wrappedEligible && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 mb-1">Weekly Questionnaire</h2>
                <p className="text-sm text-neutral-600">
                  Complete your weekly check-in to help your coach track your progress
                </p>
                {selectedCohortName && (
                  <p className="text-xs text-neutral-500 mt-2">{selectedCohortName}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            {userCohorts.length > 1 && (
              <div className="mb-4">
                <label className="text-xs font-medium text-neutral-600">Select Program</label>
                <select
                  value={selectedCohortId ?? ""}
                  onChange={(e) => handleCohortSelect(e.target.value)}
                  className="mt-2 w-full sm:max-w-xs px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
                >
                  {userCohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!selectedCohortStartDate && (
              <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Your program doesn’t have a start date yet, so questionnaires are locked.
              </div>
            )}
            <div className="mt-4">
              <QuestionnaireProgress
                cohortId={selectedCohortId}
                cohortStartDate={selectedCohortStartDate}
                onWeekClick={handleWeekClick}
              />
            </div>
          </div>
        )}

        {hasCoach !== false && !selectedCohortId && (
          <div className="mb-6 bg-white border border-neutral-200 rounded-lg p-6">
            <p className="text-sm text-neutral-600">
              You’re not assigned to a program yet. Ask your coach to add you so you can complete questionnaires.
            </p>
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
            <div ref={entryFormRef} className="bg-white rounded-lg border border-neutral-200 p-6 no-pull-refresh">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-1">
                  {entryMode === "edit" ? "Edit Entry" : "Add New Entry"}
                </h2>
                <p className="text-sm text-neutral-500">
                  {entryMode === "edit"
                    ? existingEntry
                      ? `Editing entry for ${new Date(formData.date).toLocaleDateString()}`
                      : "Select a date with an existing entry."
                    : existingEntry
                    ? `Add data for ${new Date(formData.date).toLocaleDateString()}`
                    : `New entry for ${new Date(formData.date).toLocaleDateString()}`}
                </p>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("add")
                    setIsEditing(false)
                    setManualEditEntryId(null)
                    resetFormForDate(formData.date)
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    entryMode === "add"
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  Add new entry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("edit")
                    if (existingEntry) {
                      loadEntryForEditing(existingEntry)
                    } else {
                      setIsEditing(false)
                      setManualEditEntryId(null)
                    }
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    entryMode === "edit"
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  Edit existing entry
                </button>
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
                    onChange={(e) => {
                      setManualEditEntryId(null)
                      setFormData({ ...formData, date: e.target.value })
                    }}
                    max={new Date().toISOString().split("T")[0]}
                    disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                  />
                </div>

                {existingEntry && entryMode === "add" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p className="font-medium">Entry already exists for this date.</p>
                    <p className="mt-1">
                      Choose another date to add a new entry, or switch to edit this one.
                    </p>
                  </div>
                )}

                {!existingEntry && entryMode === "edit" && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <p className="font-medium">No entry found for this date.</p>
                    <p className="mt-1">Pick a date that already has an entry to edit it.</p>
                  </div>
                )}

                {/* Core Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Weight
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
                          startTransition(() => setFormData({ ...formData, weightLbs: e.target.value }))
                        }
                        required
                        disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
                        className="w-full px-4 py-2.5 pr-12 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">lbs</span>
                    </div>
                  </div>
                  
                  {!isQuestionnaireDay(formData.date) && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Steps
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100000"
                          placeholder="0"
                          value={formData.steps}
                          onChange={(e) =>
                            startTransition(() => setFormData({ ...formData, steps: e.target.value }))
                          }
                          required={!isQuestionnaireDay(formData.date)}
                          disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
                          className="w-full px-4 py-2.5 pr-16 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">steps</span>
                      </div>
                    </div>
                  )}
                  
                  {!isQuestionnaireDay(formData.date) && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Calories
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="20000"
                          placeholder="0"
                          value={formData.calories}
                          onChange={(e) =>
                            startTransition(() => setFormData({ ...formData, calories: e.target.value }))
                          }
                          required={!isQuestionnaireDay(formData.date)}
                          disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
                          className="w-full px-4 py-2.5 pr-14 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">kcal</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Perceived Stress - Always Visible if enabled */}
                <div className="pt-4 border-t border-neutral-100">
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    Perceived Stress <span className="text-neutral-400 font-normal">(1-10)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={formData.perceivedStress || "5"}
                      onChange={(e) =>
                        startTransition(() => setFormData({ ...formData, perceivedStress: e.target.value }))
                      }
                      required
                      disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
                      className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                    <span className="text-lg font-semibold text-neutral-900 min-w-[3rem] text-center">
                      {formData.perceivedStress || "5"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral-500 mt-2">
                    <span>Not Stressed</span>
                    <span>Moderate</span>
                    <span>Extremely Stressed</span>
                  </div>
                </div>

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
                        startTransition(() => setFormData({ ...formData, notes: e.target.value }))
                      }
                      disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
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
                            value={formData.perceivedStress || "5"}
                            onChange={(e) => {
                              startTransition(() => setFormData({ ...formData, perceivedStress: e.target.value }))
                            }}
                            disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
                            className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                          />
                          <span className="text-lg font-semibold text-neutral-900 min-w-[3rem] text-center">
                            {formData.perceivedStress || "5"}
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
                          startTransition(() => setFormData({ ...formData, notes: e.target.value }))
                        }
                        disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
                        className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed resize-none"
                      />
                    )}
                    {checkInConfig.customPrompt1Type === "number" && (
                      <input
                        type="number"
                        placeholder="Enter a number..."
                        value={formData.steps}
                        onChange={(e) =>
                          startTransition(() => setFormData({ ...formData, steps: e.target.value }))
                        }
                        disabled={hasCoach === false && !(entryMode === "edit" && existingEntry)}
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
                  disabled={isSubmitDisabled}
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
                          <div className="flex items-center gap-2">
                            {isToday && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-neutral-200 text-neutral-700 rounded">
                                Latest
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setError(null)
                                setSuccess(null)
                                loadEntryForEditing(entry)
                              }}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                        {entry.dataSources && entry.dataSources.length > 0 && (
                          <div className="mb-2">
                            <DataSourceBadge dataSources={entry.dataSources} size="sm" showLabel={true} />
                          </div>
                        )}
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
                          {entry.weightLbs === null && entry.steps === null && entry.calories === null && (
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

      {/* Questionnaire Modal */}
      {selectedCohortId && (
        <QuestionnaireModal
          cohortId={selectedCohortId}
          weekNumber={selectedWeek}
          isOpen={showQuestionnaireModal}
          onClose={() => setShowQuestionnaireModal(false)}
        />
      )}

      {/* Fitness Wrapped Modal */}
      {wrappedData && (
        <WrappedModal
          isOpen={showWrappedModal}
          onClose={() => setShowWrappedModal(false)}
          data={wrappedData}
        />
      )}
    </ClientLayout>
  )
}
