"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"

interface Cohort {
  id: string
  name: string
  activeClients: number
  pendingInvites: number
  createdAt: string
  coachName?: string | null
  coachEmail?: string | null
  cohortStartDate?: string | null
  type?: "TIMED" | "ONGOING" | "CHALLENGE" | "CUSTOM" | null
  customTypeLabel?: string | null
  customCohortType?: {
    id: string
    label: string
    description?: string | null
  } | null
  checkInFrequencyDays?: number | null
  requiresMigration?: boolean
}

export default function CohortsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

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
      fetchCohorts()
    }
  }, [session])

  const fetchCohorts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWithRetry<Cohort[]>("/api/cohorts")
      setCohorts(data)
    } catch (err) {
      console.error("Error fetching cohorts:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load cohorts. Please try again."
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading cohorts...</p>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

  if (error) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Failed to load cohorts</h3>
                <p className="text-red-800 text-sm mb-4">{error}</p>
                <button
                  onClick={fetchCohorts}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </CoachLayout>
    )
  }

  // Filter cohorts based on search query
  const filteredCohorts = cohorts.filter((cohort) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      cohort.name.toLowerCase().includes(query) ||
      cohort.coachName?.toLowerCase().includes(query) ||
      cohort.coachEmail?.toLowerCase().includes(query)
    )
  })

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Cohorts</h1>
            <p className="text-neutral-600 text-sm mt-1">
              Manage your client cohorts
            </p>
          </div>
          <div className="flex w-full flex-col sm:flex-row gap-2 sm:w-auto">
            <Link
              href="/cohorts/templates"
              className="border border-neutral-300 text-neutral-900 px-4 py-2 rounded-md hover:bg-neutral-100 transition-colors text-sm font-medium w-full sm:w-auto text-center"
            >
              Templates
            </Link>
            <Link
              href="/cohorts/create"
              className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors text-sm font-medium w-full sm:w-auto text-center"
            >
              Create Cohort
            </Link>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg">
          {cohorts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📁</span>
              </div>
              <h3 className="font-medium text-neutral-900 mb-1">No cohorts yet</h3>
              <p className="text-sm text-neutral-500 mb-6">
                Create a cohort to organize your clients.
              </p>
              <Link
                href="/cohorts/create"
                className="inline-block bg-neutral-900 text-white px-6 py-2 rounded-md hover:bg-neutral-800 transition-colors text-sm font-medium"
              >
                Create Your First Cohort
              </Link>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="p-4 border-b border-neutral-200">
                <input
                  type="text"
                  placeholder="Search cohorts by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
                />
              </div>

              {filteredCohorts.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  No cohorts found matching "{searchQuery}"
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-full">
                    <thead>
                      <tr className="border-b bg-neutral-50">
                        <th className="text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Cohort Name</th>
                        <th className="hidden md:table-cell text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Owner</th>
                        <th className="hidden md:table-cell text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Start Date</th>
                        <th className="hidden lg:table-cell text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Type</th>
                        <th className="hidden lg:table-cell text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Check-in Frequency</th>
                        <th className="hidden sm:table-cell text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Active Clients</th>
                        <th className="hidden md:table-cell text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Pending Invites</th>
                        <th className="text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCohorts.map((cohort) => (
                        <tr key={cohort.id} className="border-b hover:bg-neutral-50">
                          <td className="p-2 sm:p-3">
                            <Link
                              href={`/cohorts/${cohort.id}`}
                              className="font-semibold text-neutral-900 hover:underline text-sm sm:text-base"
                            >
                              {cohort.name}
                            </Link>
                          </td>
                          <td className="hidden md:table-cell p-2 sm:p-3 text-sm sm:text-base">
                            {cohort.coachName || cohort.coachEmail || "—"}
                          </td>
                          <td className="hidden md:table-cell p-2 sm:p-3 text-sm sm:text-base">
                            {cohort.cohortStartDate
                              ? new Date(cohort.cohortStartDate).toLocaleDateString()
                              : (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                                  Missing
                                </span>
                              )}
                          </td>
                          <td className="hidden lg:table-cell p-2 sm:p-3 text-sm sm:text-base">
                            {cohort.requiresMigration ? (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                Migration required
                              </span>
                            ) : (
                              <span className="text-neutral-900">
                                {cohort.type === "TIMED"
                                  ? "Timed"
                                  : cohort.type === "ONGOING"
                                    ? "Ongoing"
                                    : cohort.type === "CHALLENGE"
                                      ? "Challenge"
                                      : cohort.type === "CUSTOM"
                                        ? `Custom${cohort.customTypeLabel ? ` — ${cohort.customTypeLabel}` : ""}`
                                        : "—"}
                              </span>
                            )}
                          </td>
                          <td className="hidden lg:table-cell p-2 sm:p-3 text-sm sm:text-base">
                            {cohort.checkInFrequencyDays ? `${cohort.checkInFrequencyDays} days` : "Defaults"}
                          </td>
                          <td className="hidden sm:table-cell p-2 sm:p-3 text-sm sm:text-base">{cohort.activeClients}</td>
                          <td className="hidden md:table-cell p-2 sm:p-3 text-sm sm:text-base">{cohort.pendingInvites}</td>
                          <td className="p-2 sm:p-3">
                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
                              <Link
                                href={`/cohorts/${cohort.id}`}
                                className="text-neutral-900 hover:underline text-sm"
                              >
                                View
                              </Link>
                              <Link
                                href={`/cohorts/${cohort.id}/analytics`}
                                className="text-neutral-900 hover:underline text-sm"
                              >
                                Analytics
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </CoachLayout>
  )
}
