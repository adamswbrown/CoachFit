"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface CohortAnalytics {
  cohortSummary: {
    activeClients: number
    avgWeightChange: number | null
    avgSteps7d: number | null
    avgSteps30d: number | null
  }
  clients: Array<{
    id: string
    name: string | null
    email: string
    latestWeight: number | null
    weightChange: number | null
    avgSteps7d: number | null
    avgSteps30d: number | null
    avgCalories7d: number | null
    avgCalories30d: number | null
    sparklineData: Array<{ date: string; weight: number }>
  }>
}

interface Cohort {
  id: string
  name: string
}

export default function CohortAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id: cohortId } = use(params)

  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [analytics, setAnalytics] = useState<CohortAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user.roles.includes(Role.CLIENT)) {
      router.push("/client-dashboard")
    }
    // ADMIN and COACH can access - no redirect needed
  }, [status, session, router])

  useEffect(() => {
    if (session && cohortId) {
      const loadData = async () => {
        setLoading(true)
        setError(null)
        try {
          await Promise.all([fetchCohort(), fetchAnalytics()])
        } catch (err) {
          console.error("Error loading analytics:", err)
          setError("Failed to load analytics. Please try again.")
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }
  }, [session, cohortId])

  const fetchCohort = async () => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}`)
      if (res.ok) {
        const data = await res.json()
        setCohort(data)
      } else if (res.status === 403) {
        setError("You don't have access to this cohort.")
      } else {
        setError("Cohort not found.")
      }
    } catch (err) {
      console.error("Error fetching cohort:", err)
    }
  }

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/analytics`)
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data)
      } else if (res.status === 403) {
        setError("You don't have access to this cohort's analytics.")
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to load analytics.")
      }
    } catch (err) {
      console.error("Error fetching analytics:", err)
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="max-w-6xl mx-auto">
          <p className="text-neutral-500">Loading analytics...</p>
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
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
            <p>{error}</p>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!cohort || !analytics) {
    return (
      <CoachLayout>
        <div className="max-w-6xl mx-auto">
          <p className="text-neutral-500">No data available.</p>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/cohorts/${cohortId}`}
            className="text-neutral-900 hover:underline"
          >
            ← Back to Cohort
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">
          {cohort?.name || "Cohort"} - Analytics
        </h1>

        {analytics && (
          <>
            {/* Cohort Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
                <div className="text-sm text-neutral-600 mb-1">Active Clients</div>
                <div className="text-3xl font-bold text-neutral-900">
                  {analytics.cohortSummary.activeClients}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Avg Weight Change</div>
                <div
                  className={`text-3xl font-bold ${
                    analytics.cohortSummary.avgWeightChange !== null
                      ? analytics.cohortSummary.avgWeightChange > 0
                        ? "text-red-600"
                        : analytics.cohortSummary.avgWeightChange < 0
                        ? "text-neutral-900"
                        : "text-neutral-900"
                      : "text-neutral-900"
                  }`}
                >
                  {analytics.cohortSummary.avgWeightChange !== null
                    ? `${analytics.cohortSummary.avgWeightChange > 0 ? "+" : ""}${analytics.cohortSummary.avgWeightChange.toFixed(1)} lbs`
                    : "—"}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Avg Steps (7d)</div>
                <div className="text-3xl font-bold text-neutral-900">
                  {analytics.cohortSummary.avgSteps7d !== null
                    ? analytics.cohortSummary.avgSteps7d.toLocaleString()
                    : "—"}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Avg Steps (30d)</div>
                <div className="text-3xl font-bold text-neutral-900">
                  {analytics.cohortSummary.avgSteps30d !== null
                    ? analytics.cohortSummary.avgSteps30d.toLocaleString()
                    : "—"}
                </div>
              </div>
            </div>

            {/* Client Comparison Table */}
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="text-xl font-semibold mb-4">Client Progress</h2>
              {analytics.clients.length === 0 ? (
                <p className="text-neutral-500 py-4">
                  No client data available. Clients will appear here once they start submitting entries.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Client</th>
                        <th className="text-left p-3 font-semibold">Latest Weight</th>
                        <th className="text-left p-3 font-semibold">Weight Change</th>
                        <th className="text-left p-3 font-semibold">Avg Steps (7d)</th>
                        <th className="text-left p-3 font-semibold">Avg Steps (30d)</th>
                        <th className="text-left p-3 font-semibold">Avg Calories (30d)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.clients.map((client) => (
                        <tr key={client.id} className="border-b hover:bg-neutral-50">
                          <td className="p-3">
                            <Link
                              href={`/clients/${client.id}/entries`}
                              className="text-neutral-900 hover:underline"
                            >
                              {client.name || client.email}
                            </Link>
                          </td>
                          <td className="p-3">
                            {client.latestWeight !== null
                              ? `${client.latestWeight.toFixed(1)} lbs`
                              : "—"}
                          </td>
                          <td className="p-3">
                            {client.weightChange !== null ? (
                              <span
                                className={
                                  client.weightChange > 0
                                    ? "text-red-600"
                                    : client.weightChange < 0
                                    ? "text-neutral-900"
                                    : "text-neutral-900"
                                }
                              >
                                {client.weightChange > 0 ? "+" : ""}
                                {client.weightChange.toFixed(1)} lbs
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3">
                            {client.avgSteps7d !== null
                              ? client.avgSteps7d.toLocaleString()
                              : "—"}
                          </td>
                          <td className="p-3">
                            {client.avgSteps30d !== null
                              ? client.avgSteps30d.toLocaleString()
                              : "—"}
                          </td>
                          <td className="p-3">
                            {client.avgCalories30d !== null
                              ? client.avgCalories30d.toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </CoachLayout>
  )
}
