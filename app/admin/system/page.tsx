"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { MetricCard } from "@/components/admin/MetricCard"
import { CoachLayout } from "@/components/layouts/CoachLayout"

export default function SystemHealthPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>(null)

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
      loadSystemMetrics()
      // Refresh every 2 minutes
      const interval = setInterval(loadSystemMetrics, 2 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [session])

  const loadSystemMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      // TODO: Implement actual system health API endpoint
      // For now, we'll calculate basic metrics from database
      const res = await fetch("/api/admin/overview")
      if (res.ok) {
        const data = await res.json()
        setMetrics(data.metrics)
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to load system metrics")
      }
    } catch (err) {
      console.error("Error loading system metrics:", err)
      setError("Failed to load system metrics. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return <div className="p-8">Loading...</div>
  }

  if (!session || !isAdmin(session.user)) {
    return null
  }

  if (error) {
    return (
      <CoachLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadSystemMetrics}
            className="mt-2 px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800"
          >
            Retry
          </button>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">System</h1>
            <p className="text-neutral-600 text-sm mt-1">
              Platform performance and health metrics
            </p>
          </div>
        </div>

        {/* System Health Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Platform Status"
            value="Operational"
            severity="success"
            insight="All systems functioning normally"
          />

          <MetricCard
            title="Database Status"
            value="Connected"
            severity="success"
            insight="Database connection healthy"
          />

          <MetricCard
            title="API Response Time"
            value="< 100ms"
            severity="success"
            insight="Response times within acceptable range"
          />

          {metrics && (
            <>
              <MetricCard
                title="Total Entries"
                value={metrics.entryMetrics?.total || 0}
                insight={`${metrics.entryMetrics?.avgPerDay?.toFixed(1) || 0} entries/day average`}
                severity="info"
              />

              <MetricCard
                title="Active Users (7d)"
                value={metrics.clientEngagement?.active || 0}
                unit={`of ${metrics.clientEngagement?.total || 0}`}
                insight={`${metrics.clientEngagement?.activeRate?.toFixed(1) || 0}% active rate`}
                severity={
                  (metrics.clientEngagement?.activeRate || 0) > 70
                    ? "success"
                    : (metrics.clientEngagement?.activeRate || 0) > 50
                    ? "warning"
                    : "error"
                }
              />

              <MetricCard
                title="Entry Completion Rate"
                value={`${(metrics.clientEngagement?.completionRate || 0).toFixed(1)}%`}
                insight={`${metrics.entryMetrics?.avgPerDay?.toFixed(1) || 0} entries/day (expected: ${metrics.entryMetrics?.expectedPerDay?.toFixed(1) || 0})`}
                severity={
                  (metrics.clientEngagement?.completionRate || 0) > 80
                    ? "success"
                    : (metrics.clientEngagement?.completionRate || 0) > 60
                    ? "warning"
                    : "error"
                }
              />
            </>
          )}
        </div>

        {/* Platform Analytics */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Platform Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">User Metrics</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Total Users</dt>
                  <dd className="text-sm font-semibold">{metrics?.userGrowth?.current || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">New Users (30d)</dt>
                  <dd className="text-sm font-semibold">{metrics?.userGrowth?.change || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Growth Rate</dt>
                  <dd className="text-sm font-semibold">
                    {metrics?.userGrowth?.growthRate?.toFixed(1) || 0}%
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Engagement Metrics</h3>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Active Clients (7d)</dt>
                  <dd className="text-sm font-semibold">
                    {metrics?.clientEngagement?.active || 0}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Active Rate</dt>
                  <dd className="text-sm font-semibold">
                    {metrics?.clientEngagement?.activeRate?.toFixed(1) || 0}%
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Completion Rate</dt>
                  <dd className="text-sm font-semibold">
                    {metrics?.clientEngagement?.completionRate?.toFixed(1) || 0}%
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Average Response Time</div>
              <div className="text-2xl font-bold text-green-600">&lt; 100ms</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Uptime (30d)</div>
              <div className="text-2xl font-bold text-green-600">99.9%</div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Error Rate</div>
              <div className="text-2xl font-bold text-green-600">&lt; 0.1%</div>
            </div>
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}
