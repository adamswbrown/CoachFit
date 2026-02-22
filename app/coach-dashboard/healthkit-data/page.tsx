"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isAdminOrCoach } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface Client {
  id: string
  name: string | null
  email: string
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
}

interface SleepRecord {
  id: string
  date: string
  totalSleepMins: number
  inBedMins: number | null
  awakeMins: number | null
  asleepCoreMins: number | null
  asleepDeepMins: number | null
  asleepREMMins: number | null
  sleepStart: string | null
  sleepEnd: string | null
  sourceDevices: string[] | null
}

interface SleepAverages {
  avgTotalSleep: number
  avgDeepSleep: number
  avgREMSleep: number
  avgCoreSleep: number
}

type TabType = "workouts" | "sleep"

export default function HealthKitDataExplorer() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // State
  const [featureEnabled, setFeatureEnabled] = useState<boolean>(true)
  const [checkingFeature, setCheckingFeature] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [activeTab, setActiveTab] = useState<TabType>("workouts")
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientHasPaired, setClientHasPaired] = useState<boolean | null>(null)

  // Date filters
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  // Data
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [workoutPagination, setWorkoutPagination] = useState({ total: 0, hasMore: false })
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([])
  const [sleepAverages, setSleepAverages] = useState<SleepAverages | null>(null)
  const [sleepPagination, setSleepPagination] = useState({ total: 0, hasMore: false })

  // Check feature flag
  useEffect(() => {
    const checkFeature = async () => {
      try {
        const res = await fetch("/api/settings/feature-flags")
        if (res.ok) {
          const data = await res.json()
          setFeatureEnabled(data.data.healthkitEnabled ?? true)
        }
      } catch (err) {
        console.error("Error checking feature flag:", err)
        setFeatureEnabled(true) // Default to enabled on error
      } finally {
        setCheckingFeature(false)
      }
    }
    checkFeature()
  }, [])

  // Auth check
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
      router.push("/client-dashboard")
    }
  }, [status, session, router])

  // Fetch clients on load
  useEffect(() => {
    if (session) {
      fetchClients()
    }
  }, [session])

  // Fetch data when client or filters change
  useEffect(() => {
    if (selectedClientId) {
      fetchData()
    }
  }, [selectedClientId, startDate, endDate, activeTab])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/coach-dashboard/overview")
      if (res.ok) {
        const data = await res.json()
        // Filter to only active clients (those with IDs)
        const activeClients = (data.clients || [])
          .filter((c: any) => c.id && c.status === "active")
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
          }))
        setClients(activeClients)

        // Auto-select first client if available
        if (activeClients.length > 0 && !selectedClientId) {
          setSelectedClientId(activeClients[0].id)
        }
      }
    } catch (err) {
      console.error("Error fetching clients:", err)
      setError("Failed to load clients")
    } finally {
      setLoading(false)
    }
  }

  const checkClientPairingStatus = async () => {
    if (!selectedClientId) return

    try {
      const res = await fetch(`/api/coach/client-pairing-status?clientId=${selectedClientId}`)
      if (res.ok) {
        const data = await res.json()
        setClientHasPaired(data.paired === true)
      } else {
        setClientHasPaired(false)
      }
    } catch (err) {
      console.error("Error checking pairing status:", err)
      setClientHasPaired(false)
    }
  }

  const fetchData = async () => {
    if (!selectedClientId) return

    setDataLoading(true)
    setError(null)

    // First check if client has paired their device
    await checkClientPairingStatus()

    try {
      if (activeTab === "workouts") {
        await fetchWorkouts()
      } else {
        await fetchSleepData()
      }
    } catch (err) {
      console.error("Error fetching data:", err)
      setError("Failed to load data")
    } finally {
      setDataLoading(false)
    }
  }

  const fetchWorkouts = async () => {
    const params = new URLSearchParams({ clientId: selectedClientId })
    if (startDate) params.append("startDate", startDate)
    if (endDate) params.append("endDate", endDate)

    const res = await fetch(`/api/healthkit/workouts?${params}`)
    if (res.ok) {
      const data = await res.json()
      setWorkouts(data.workouts || [])
      setWorkoutPagination(data.pagination || { total: 0, hasMore: false })
    } else {
      const errorData = await res.json()
      throw new Error(errorData.error || "Failed to fetch workouts")
    }
  }

  const fetchSleepData = async () => {
    const params = new URLSearchParams({ clientId: selectedClientId })
    if (startDate) params.append("startDate", startDate)
    if (endDate) params.append("endDate", endDate)

    const res = await fetch(`/api/healthkit/sleep?${params}`)
    if (res.ok) {
      const data = await res.json()
      setSleepRecords(data.sleepRecords || [])
      setSleepAverages(data.averages || null)
      setSleepPagination(data.pagination || { total: 0, hasMore: false })
    } else {
      const errorData = await res.json()
      throw new Error(errorData.error || "Failed to fetch sleep data")
    }
  }

  // Format helpers
  const formatDuration = (secs: number): string => {
    const hours = Math.floor(secs / 3600)
    const mins = Math.floor((secs % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const formatMinutesToHours = (mins: number): string => {
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    if (hours > 0) {
      return `${hours}h ${remainingMins}m`
    }
    return `${remainingMins}m`
  }

  const formatDistance = (meters: number | null): string => {
    if (!meters) return "—"
    const miles = meters / 1609.344
    return `${miles.toFixed(2)} mi`
  }

  const formatDateTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const getWorkoutIcon = (type: string): string => {
    const icons: Record<string, string> = {
      Running: "🏃",
      Walking: "🚶",
      Cycling: "🚴",
      Swimming: "🏊",
      "Strength Training": "🏋️",
      "High Intensity Interval Training": "⚡",
      Yoga: "🧘",
      Hiking: "🥾",
      Dance: "💃",
      Tennis: "🎾",
      Basketball: "🏀",
      Soccer: "⚽",
    }
    return icons[type] || "🏃"
  }

  // Set default date range (last 30 days) on mount
  useEffect(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)

    setEndDate(today.toISOString().split("T")[0])
    setStartDate(thirtyDaysAgo.toISOString().split("T")[0])
  }, [])

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-neutral-600">Loading...</p>
            </div>
          </div>
        </div>
      </CoachLayout>
    )
  }

  // Feature flag check
  if (checkingFeature) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-neutral-600">Loading...</p>
        </div>
      </CoachLayout>
    )
  }

  if (!featureEnabled) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto text-center py-12">
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-neutral-900 mb-4">Feature Not Available</h2>
            <p className="text-neutral-600 mb-4">
              HealthKit data features are currently disabled. Contact your administrator to enable this feature.
            </p>
            <Link 
              href="/coach-dashboard"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId)

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <Link href="/coach-dashboard" className="hover:text-neutral-700">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-neutral-900">HealthKit Data</span>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">HealthKit Data Explorer</h1>
          <p className="text-neutral-600 text-sm mt-1">
            View detailed workout and sleep data synced from your clients' Apple devices.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Client Selector */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                {clients.length === 0 ? (
                  <option value="">No clients available</option>
                ) : (
                  <>
                    <option value="">Select a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name || client.email}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
              />
            </div>

            {/* Quick Date Ranges */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Quick Range
              </label>
              <select
                onChange={(e) => {
                  const days = parseInt(e.target.value)
                  if (days) {
                    const today = new Date()
                    const start = new Date()
                    start.setDate(today.getDate() - days)
                    setEndDate(today.toISOString().split("T")[0])
                    setStartDate(start.toISOString().split("T")[0])
                  }
                }}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                <option value="">Custom range</option>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 60 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* No Client Selected */}
        {!selectedClientId && (
          <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📱</span>
            </div>
            <h3 className="font-medium text-neutral-900 mb-1">Select a Client</h3>
            <p className="text-sm text-neutral-500">
              Choose a client from the dropdown above to view their HealthKit data.
            </p>
          </div>
        )}

        {/* Main Content */}
        {selectedClientId && (
          <>
            {/* Client Info Bar */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div>
                <div className="font-medium text-neutral-900">
                  {selectedClient?.name || selectedClient?.email}
                </div>
                {selectedClient?.name && (
                  <div className="text-sm text-neutral-500">{selectedClient.email}</div>
                )}
              </div>
              <Link
                href={`/clients/${selectedClientId}`}
                className="text-sm text-neutral-700 hover:text-neutral-900 hover:underline"
              >
                View Full Profile
              </Link>
            </div>

            {/* Tabs */}
            <div className="border-b border-neutral-200 mb-6">
              <nav className="flex gap-6">
                <button
                  onClick={() => setActiveTab("workouts")}
                  className={`px-1 py-3 text-sm font-medium -mb-px whitespace-nowrap ${
                    activeTab === "workouts"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Workouts ({workoutPagination.total})
                </button>
                <button
                  onClick={() => setActiveTab("sleep")}
                  className={`px-1 py-3 text-sm font-medium -mb-px whitespace-nowrap ${
                    activeTab === "sleep"
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  Sleep ({sleepPagination.total})
                </button>
              </nav>
            </div>

            {/* Pairing Required Message */}
            {!dataLoading && clientHasPaired === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📱</span>
                </div>
                <h3 className="font-semibold text-amber-900 mb-2">Device Not Paired</h3>
                <p className="text-sm text-amber-800 mb-4">
                  This client has not yet synced their iOS device with HealthKit data.
                </p>
                <p className="text-xs text-amber-700">
                  HealthKit data will appear here once the client pairs their device through the mobile app.
                </p>
              </div>
            )}

            {/* Loading State */}
            {dataLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-neutral-600">Loading data...</p>
                </div>
              </div>
            )}

            {/* Workouts Tab */}
            {!dataLoading && clientHasPaired && activeTab === "workouts" && (
              <div className="space-y-4">
                {workouts.length === 0 ? (
                  <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">🏋️</span>
                    </div>
                    <h3 className="font-medium text-neutral-900 mb-1">No Workouts Found</h3>
                    <p className="text-sm text-neutral-500">
                      No workout data for this client in the selected date range.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-neutral-50">
                          <tr className="border-b border-neutral-200">
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700">Type</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden sm:table-cell">Date & Time</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700">Duration</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700">Calories</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden md:table-cell">Distance</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden md:table-cell">Heart Rate</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden lg:table-cell">Device</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workouts.map((workout) => (
                            <tr key={workout.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                              <td className="p-3 sm:p-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{getWorkoutIcon(workout.workoutType)}</span>
                                  <div>
                                    <span className="font-medium text-neutral-900">
                                      {workout.workoutType}
                                    </span>
                                    <div className="text-xs text-neutral-500 sm:hidden">
                                      {formatDateTime(workout.startTime)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 sm:p-4 text-neutral-600 hidden sm:table-cell">
                                {formatDateTime(workout.startTime)}
                              </td>
                              <td className="p-3 sm:p-4 text-neutral-900 font-medium">
                                {formatDuration(workout.durationSecs)}
                              </td>
                              <td className="p-3 sm:p-4 text-neutral-600">
                                {workout.caloriesActive
                                  ? `${workout.caloriesActive.toLocaleString()} kcal`
                                  : "—"}
                              </td>
                              <td className="p-3 sm:p-4 text-neutral-600 hidden md:table-cell">
                                {formatDistance(workout.distanceMeters)}
                              </td>
                              <td className="p-3 sm:p-4 hidden md:table-cell">
                                {workout.avgHeartRate ? (
                                  <div className="text-sm">
                                    <span className="text-red-600 font-medium">
                                      {workout.avgHeartRate} bpm
                                    </span>
                                    {workout.maxHeartRate && (
                                      <span className="text-neutral-500">
                                        {" "}
                                        (max {workout.maxHeartRate})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-3 sm:p-4 text-neutral-500 text-sm hidden lg:table-cell">
                                {workout.sourceDevice || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sleep Tab */}
            {!dataLoading && clientHasPaired && activeTab === "sleep" && (
              <div className="space-y-6">
                {/* Sleep Averages */}
                {sleepAverages && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-neutral-200 rounded-lg p-4">
                      <div className="text-sm text-neutral-600 mb-1">Avg Total Sleep</div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {formatMinutesToHours(sleepAverages.avgTotalSleep)}
                      </div>
                    </div>
                    <div className="bg-white border border-neutral-200 rounded-lg p-4">
                      <div className="text-sm text-neutral-600 mb-1">Avg Deep Sleep</div>
                      <div className="text-2xl font-bold text-indigo-600">
                        {formatMinutesToHours(sleepAverages.avgDeepSleep)}
                      </div>
                    </div>
                    <div className="bg-white border border-neutral-200 rounded-lg p-4">
                      <div className="text-sm text-neutral-600 mb-1">Avg REM Sleep</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatMinutesToHours(sleepAverages.avgREMSleep)}
                      </div>
                    </div>
                    <div className="bg-white border border-neutral-200 rounded-lg p-4">
                      <div className="text-sm text-neutral-600 mb-1">Avg Core Sleep</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatMinutesToHours(sleepAverages.avgCoreSleep)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sleep Records Table */}
                {sleepRecords.length === 0 ? (
                  <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">😴</span>
                    </div>
                    <h3 className="font-medium text-neutral-900 mb-1">No Sleep Data Found</h3>
                    <p className="text-sm text-neutral-500">
                      No sleep data for this client in the selected date range.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-neutral-50">
                          <tr className="border-b border-neutral-200">
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700">Date</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700">Total Sleep</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden lg:table-cell">In Bed</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden sm:table-cell">
                              <span className="text-blue-600">Core</span>
                            </th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden sm:table-cell">
                              <span className="text-indigo-600">Deep</span>
                            </th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden md:table-cell">
                              <span className="text-purple-600">REM</span>
                            </th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden lg:table-cell">Awake</th>
                            <th className="text-left p-3 sm:p-4 font-medium text-neutral-700 hidden lg:table-cell">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sleepRecords.map((record) => (
                            <tr
                              key={record.id}
                              className="border-b border-neutral-100 hover:bg-neutral-50"
                            >
                              <td className="p-3 sm:p-4 font-medium text-neutral-900">
                                {formatDate(record.date)}
                              </td>
                              <td className="p-3 sm:p-4">
                                <span className="text-neutral-900 font-semibold">
                                  {formatMinutesToHours(record.totalSleepMins)}
                                </span>
                              </td>
                              <td className="p-3 sm:p-4 text-neutral-600 hidden lg:table-cell">
                                {record.inBedMins
                                  ? formatMinutesToHours(record.inBedMins)
                                  : "—"}
                              </td>
                              <td className="p-3 sm:p-4 hidden sm:table-cell">
                                {record.asleepCoreMins !== null ? (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-2 bg-blue-500 rounded"
                                      style={{
                                        width: `${Math.min(
                                          (record.asleepCoreMins / record.totalSleepMins) * 100,
                                          100
                                        )}%`,
                                        minWidth: "4px",
                                        maxWidth: "60px",
                                      }}
                                    />
                                    <span className="text-sm text-blue-700">
                                      {formatMinutesToHours(record.asleepCoreMins)}
                                    </span>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-3 sm:p-4 hidden sm:table-cell">
                                {record.asleepDeepMins !== null ? (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-2 bg-indigo-500 rounded"
                                      style={{
                                        width: `${Math.min(
                                          (record.asleepDeepMins / record.totalSleepMins) * 100,
                                          100
                                        )}%`,
                                        minWidth: "4px",
                                        maxWidth: "60px",
                                      }}
                                    />
                                    <span className="text-sm text-indigo-700">
                                      {formatMinutesToHours(record.asleepDeepMins)}
                                    </span>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-3 sm:p-4 hidden md:table-cell">
                                {record.asleepREMMins !== null ? (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-2 bg-purple-500 rounded"
                                      style={{
                                        width: `${Math.min(
                                          (record.asleepREMMins / record.totalSleepMins) * 100,
                                          100
                                        )}%`,
                                        minWidth: "4px",
                                        maxWidth: "60px",
                                      }}
                                    />
                                    <span className="text-sm text-purple-700">
                                      {formatMinutesToHours(record.asleepREMMins)}
                                    </span>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="p-3 sm:p-4 text-neutral-600 hidden lg:table-cell">
                                {record.awakeMins !== null
                                  ? formatMinutesToHours(record.awakeMins)
                                  : "—"}
                              </td>
                              <td className="p-3 sm:p-4 text-sm text-neutral-500 hidden lg:table-cell">
                                {record.sleepStart && record.sleepEnd ? (
                                  <>
                                    {new Date(record.sleepStart).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                    {" - "}
                                    {new Date(record.sleepEnd).toLocaleTimeString("en-US", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </CoachLayout>
  )
}
