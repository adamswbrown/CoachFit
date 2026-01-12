"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { CohortsIcon, AttentionIcon } from "@/components/icons"

interface Cohort {
  id: string
  name: string
  createdAt: string
  clientCount: number
}

export default function CohortsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user.roles.includes("CLIENT")) {
      router.push("/client-dashboard")
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
                <AttentionIcon size={24} className="text-red-600" />
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

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-900">Cohorts</h1>
          <p className="text-neutral-600 text-sm mt-1">
            Manage your client cohorts
          </p>
        </div>

        {cohorts.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <CohortsIcon size={32} />
            </div>
            <h3 className="font-medium text-neutral-900 mb-1">No cohorts yet</h3>
            <p className="text-sm text-neutral-500 mb-6">
              Create a cohort to organize your clients.
            </p>
            <Link
              href="/coach-dashboard"
              className="inline-block bg-neutral-900 text-white px-6 py-2 rounded-md hover:bg-neutral-800 transition-colors text-sm font-medium"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cohorts.map((cohort) => (
              <Link
                key={cohort.id}
                href={`/cohorts/${cohort.id}`}
                className="bg-white border border-neutral-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900">{cohort.name}</h3>
                  <CohortsIcon size={24} />
                </div>
                <div className="space-y-2 text-sm text-neutral-600">
                  <div className="flex justify-between">
                    <span>Clients:</span>
                    <span className="font-medium text-neutral-900">{cohort.clientCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-medium text-neutral-900">
                      {new Date(cohort.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  <span className="text-sm text-neutral-600 hover:text-neutral-900">
                    View Details →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
