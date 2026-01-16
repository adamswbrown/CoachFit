"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { MetricCard } from "@/components/admin/MetricCard"
import { Trend } from "@/lib/admin/insights"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import Link from "next/link"

interface OverviewData {
  insights: {
    highPriority: any[]
    trends: Trend[]
    anomalies: any[]
    opportunities: any[]
  }
  metrics: {
    userGrowth: {
      current: number
      change: number
      trend: string
      prediction: number
      growthRate: number
    }
    coachUtilization: {
      total: number
      active: number
      average: number
      overloaded: number
      underutilized: number
    }
    clientEngagement: {
      total: number
      active: number
      activeRate: number
      completionRate: number
      inactiveUsers: number
    }
    entryMetrics: {
      total: number
      last7Days: number
      last30Days: number
      avgPerDay: number
      expectedPerDay: number
    }
    cohortHealth: {
      total: number
      withClients: number
      empty: number
    }
  }
}

export default function AdminOverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdmin(session.user)) {
      if (session.user.roles.includes(Role.COACH)) {
        router.push("/coach-dashboard")
      } else {
        router.push("/client-dashboard")
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user && isAdmin(session.user)) {
      loadOverview()
    }
  }, [session])

  const loadOverview = async (isRetry: boolean = false) => {
    if (!isRetry) {
      setLoading(true)
      setError(null)
    }
    try {
      const overviewData = await fetchWithRetry<OverviewData>("/api/admin/overview", {}, 3, 1000)
      setData(overviewData)
      setError(null)
      setRetryCount(0)
    } catch (err) {
      console.error("Error loading overview:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load overview. Please try again."
      setError(errorMessage)
      setRetryCount((prev) => prev + 1)
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
            <p className="text-neutral-600">Loading overview...</p>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session || !isAdmin(session.user)) {
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
                <h3 className="font-semibold text-red-900 mb-1">Failed to load overview</h3>
                <p className="text-red-800 text-sm mb-4">{error}</p>
                {retryCount > 0 && (
                  <p className="text-red-700 text-xs mb-4">
                    Retry attempt {retryCount} of 3
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => loadOverview(false)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Retry Now
                  </button>
                  <button
                    onClick={() => {
                      setError(null)
                      setRetryCount(0)
                      loadOverview(false)
                    }}
                    className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    Clear & Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!data) {
    return (
      <CoachLayout>
        <div>No data available</div>
      </CoachLayout>
    )
  }

  const userGrowthTrend = data.insights.trends.find((t) => t.metric === "user_growth")
  const entryCompletionTrend = data.insights.trends.find(
    (t) => t.metric === "entry_completion"
  )

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Overview</h1>
            <p className="text-neutral-600 text-sm mt-1">
              System insights and metrics at a glance
            </p>
          </div>
        </div>

        {/* High Priority Alerts */}
        {data.insights.highPriority && data.insights.highPriority.length > 0 && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              High Priority Issues ({data.insights.highPriority.length})
            </h2>
            <ul className="space-y-1">
              {data.insights.highPriority.slice(0, 5).map((insight, idx) => (
                <li key={idx} className="text-sm text-red-800">
                  • {insight.title}: {insight.description}
                </li>
              ))}
            </ul>
            {data.insights.highPriority.length > 5 && (
              <p className="text-sm text-red-600 mt-2">
                +{data.insights.highPriority.length - 5} more issues
              </p>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Total Users"
            value={data.metrics.userGrowth.current}
            trend={userGrowthTrend || null}
            insight={
              data.metrics.userGrowth.growthRate > 0
                ? `Growing at ${data.metrics.userGrowth.growthRate.toFixed(1)}% rate`
                : null
            }
            severity={data.metrics.userGrowth.growthRate > 0 ? "success" : "info"}
          />

          <MetricCard
            title="Active Clients (7d)"
            value={data.metrics.clientEngagement.active}
            unit={`of ${data.metrics.clientEngagement.total}`}
            insight={`${data.metrics.clientEngagement.activeRate.toFixed(1)}% active rate`}
            severity={
              data.metrics.clientEngagement.activeRate > 70
                ? "success"
                : data.metrics.clientEngagement.activeRate > 50
                ? "warning"
                : "error"
            }
          />

          <MetricCard
            title="Entry Completion Rate"
            value={`${data.metrics.clientEngagement.completionRate.toFixed(1)}%`}
            trend={entryCompletionTrend || null}
            insight={`${data.metrics.entryMetrics.avgPerDay.toFixed(1)} entries/day (expected: ${data.metrics.entryMetrics.expectedPerDay.toFixed(1)})`}
            severity={
              data.metrics.clientEngagement.completionRate > 80
                ? "success"
                : data.metrics.clientEngagement.completionRate > 60
                ? "warning"
                : "error"
            }
          />

          <MetricCard
            title="Total Coaches"
            value={data.metrics.coachUtilization.total}
            insight={`${data.metrics.coachUtilization.active} active, ${data.metrics.coachUtilization.average.toFixed(1)} avg clients/coach`}
            severity="info"
          />

          <MetricCard
            title="Overloaded Coaches"
            value={data.metrics.coachUtilization.overloaded}
            insight={
              data.metrics.coachUtilization.overloaded > 0
                ? `${data.metrics.coachUtilization.overloaded} coaches exceed capacity`
                : "All coaches within capacity"
            }
            severity={
              data.metrics.coachUtilization.overloaded > 0 ? "error" : "success"
            }
          />

          <MetricCard
            title="Total Cohorts"
            value={data.metrics.cohortHealth.total}
            insight={`${data.metrics.cohortHealth.withClients} with clients, ${data.metrics.cohortHealth.empty} empty`}
            severity={data.metrics.cohortHealth.empty > 0 ? "warning" : "info"}
          />
        </div>

        {/* Opportunities Section */}
        {data.insights.opportunities && data.insights.opportunities.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Optimization Opportunities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.insights.opportunities.map((opp, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{opp.title}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        opp.impact === "high"
                          ? "bg-red-100 text-red-700"
                          : opp.impact === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {opp.impact} impact
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{opp.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Link
              href="/admin"
              className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-center"
            >
              <div className="font-semibold">Users</div>
              <div className="text-sm text-neutral-600">{data.metrics.userGrowth.current}</div>
            </Link>
            <Link
              href="/coach-dashboard"
              className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-center"
            >
              <div className="font-semibold">Coach Dashboard</div>
              <div className="text-sm text-neutral-600">View clients</div>
            </Link>
            <div className="p-4 border border-neutral-200 rounded-lg text-center">
              <div className="font-semibold">Cohorts</div>
              <div className="text-sm text-neutral-600">{data.metrics.cohortHealth.total}</div>
            </div>
            <Link
              href="/admin/attention"
              className="p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-center"
            >
              <div className="font-semibold">Attention</div>
              <div className="text-sm text-neutral-600">
                {data.insights.highPriority.length} issues
              </div>
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/coach-dashboard?action=create-cohort"
              className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors text-sm font-medium"
            >
              Create Cohort
            </Link>
            <Link
              href="/coach-dashboard?action=invite-client"
              className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors text-sm font-medium"
            >
              Invite Client
            </Link>
            <Link
              href="/coach-dashboard"
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 transition-colors text-sm font-medium"
            >
              View All Clients
            </Link>
            <Link
              href="/admin"
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 transition-colors text-sm font-medium"
            >
              Manage Users
            </Link>
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}
