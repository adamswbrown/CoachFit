"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import type { AttentionQueueItem } from "@/lib/admin/attention"

interface AttentionQueueData {
  red: AttentionQueueItem[]
  amber: AttentionQueueItem[]
  green: AttentionQueueItem[]
  summary: {
    red: number
    amber: number
    green: number
    total: number
  }
}

export default function AttentionQueuePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<AttentionQueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [filter, setFilter] = useState<"all" | "red" | "amber" | "green">("all")

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
      loadAttentionQueue()
      // Refresh every 5 minutes
      const interval = setInterval(loadAttentionQueue, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [session])

  const loadAttentionQueue = async (isRetry: boolean = false) => {
    if (!isRetry) {
      setLoading(true)
      setError(null)
    }
    try {
      const queueData = await fetchWithRetry<AttentionQueueData>("/api/admin/attention", {}, 3, 1000)
      setData(queueData)
      setError(null)
      setRetryCount(0)
    } catch (err) {
      console.error("Error loading attention queue:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load attention queue. Please try again."
      setError(errorMessage)
      setRetryCount((prev) => prev + 1)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredItems = () => {
    if (!data) return []
    switch (filter) {
      case "red":
        return data.red
      case "amber":
        return data.amber
      case "green":
        return data.green
      default:
        return [...data.red, ...data.amber, ...data.green]
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading attention queue...</p>
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
                <h3 className="font-semibold text-red-900 mb-1">Failed to load attention queue</h3>
                <p className="text-red-800 text-sm mb-4">{error}</p>
                {retryCount > 0 && (
                  <p className="text-red-700 text-xs mb-4">
                    Retry attempt {retryCount} of 3
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => loadAttentionQueue(false)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Retry Now
                  </button>
                  <button
                    onClick={() => {
                      setError(null)
                      setRetryCount(0)
                      loadAttentionQueue(false)
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
    return <div className="p-8">No data available</div>
  }

  const filteredItems = getFilteredItems()

  const priorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "red":
        return "bg-red-100 text-red-800"
      case "amber":
        return "bg-amber-100 text-amber-800"
      case "green":
        return "bg-green-100 text-green-800"
      default:
        return "bg-neutral-100 text-neutral-700"
    }
  }

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Attention</h1>
            <p className="text-neutral-600 text-sm mt-1">
              Priority-queued items requiring attention
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-700 font-medium mb-1">Red (Needs Attention)</div>
            <div className="text-2xl font-bold text-red-900">{data.summary.red}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-sm text-amber-700 font-medium mb-1">Amber (Watch Closely)</div>
            <div className="text-2xl font-bold text-amber-900">{data.summary.amber}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-700 font-medium mb-1">Green (Stable)</div>
            <div className="text-2xl font-bold text-green-900">{data.summary.green}</div>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <div className="text-sm text-neutral-700 font-medium mb-1">Total</div>
            <div className="text-2xl font-bold text-neutral-900">{data.summary.total}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-md transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            All ({data.summary.total})
          </button>
          <button
            onClick={() => setFilter("red")}
            className={`px-4 py-2 rounded-md transition-colors ${
              filter === "red"
                ? "bg-red-600 text-white"
                : "bg-white border border-red-300 text-red-700 hover:bg-red-50"
            }`}
          >
            Red ({data.summary.red})
          </button>
          <button
            onClick={() => setFilter("amber")}
            className={`px-4 py-2 rounded-md transition-colors ${
              filter === "amber"
                ? "bg-amber-600 text-white"
                : "bg-white border border-amber-300 text-amber-700 hover:bg-amber-50"
            }`}
          >
            Amber ({data.summary.amber})
          </button>
          <button
            onClick={() => setFilter("green")}
            className={`px-4 py-2 rounded-md transition-colors ${
              filter === "green"
                ? "bg-green-600 text-white"
                : "bg-white border border-green-300 text-green-700 hover:bg-green-50"
            }`}
          >
            Green ({data.summary.green})
          </button>
        </div>

        {/* Attention Queue Table */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">
              {filter === "all"
                ? "No items in attention queue"
                : `No ${filter} priority items`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">RAG</th>
                    <th className="text-left px-4 py-3 font-medium">Score</th>
                    <th className="text-left px-4 py-3 font-medium">Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={`${item.entityType}-${item.entityId}`} className="border-t border-neutral-100">
                      <td className="px-4 py-3 text-neutral-900">
                        <div className="font-medium">{item.entityName}</div>
                        {item.entityEmail && (
                          <div className="text-xs text-neutral-500">{item.entityEmail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-700 capitalize">{item.entityType}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${priorityBadgeClass(item.priority)}`}>
                          {item.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{item.score}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {item.reasons.length > 0 ? item.reasons.join(" • ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
