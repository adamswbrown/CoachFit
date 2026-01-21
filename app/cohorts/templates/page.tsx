"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"

interface TemplateCohort {
  id: string
  name: string
  createdAt: string
  coachName?: string | null
  coachEmail?: string | null
}

export default function CohortTemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateCohort[]>([])
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
      fetchTemplates()
    }
  }, [session])

  const fetchTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWithRetry<TemplateCohort[]>("/api/cohorts/templates")
      setTemplates(data)
    } catch (err) {
      console.error("Error fetching cohort templates:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load templates. Please try again."
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
            <p className="text-neutral-600">Loading templates...</p>
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
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Failed to load templates</h3>
                <p className="text-red-800 text-sm mb-4">{error}</p>
                <button
                  onClick={fetchTemplates}
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

  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      template.name.toLowerCase().includes(query) ||
      template.coachName?.toLowerCase().includes(query) ||
      template.coachEmail?.toLowerCase().includes(query)
    )
  })

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Templates</h1>
            <p className="text-neutral-600 text-sm mt-1">
              Questionnaire templates saved as cohorts
            </p>
          </div>
          <Link
            href="/cohorts"
            className="border border-neutral-300 text-neutral-900 px-4 py-2 rounded-md hover:bg-neutral-100 transition-colors text-sm font-medium w-full sm:w-auto text-center"
          >
            Back to Cohorts
          </Link>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg">
          {templates.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <h3 className="font-medium text-neutral-900 mb-1">No templates yet</h3>
              <p className="text-sm text-neutral-500">
                Templates will appear here when they are created.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-neutral-200">
                <input
                  type="text"
                  placeholder="Search templates by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
                />
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  No templates found matching "{searchQuery}"
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full min-w-full">
                    <thead>
                      <tr className="border-b bg-neutral-50">
                        <th className="text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Template Name</th>
                        <th className="hidden md:table-cell text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Owner</th>
                        <th className="hidden md:table-cell text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Created</th>
                        <th className="text-left p-2 sm:p-3 font-semibold text-neutral-900 text-sm sm:text-base">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTemplates.map((template) => (
                        <tr key={template.id} className="border-b hover:bg-neutral-50">
                          <td className="p-2 sm:p-3">
                            <Link
                              href={`/cohorts/${template.id}`}
                              className="font-semibold text-neutral-900 hover:underline text-sm sm:text-base"
                            >
                              {template.name.replace(/^Template:\\s*/i, "")}
                            </Link>
                          </td>
                          <td className="hidden md:table-cell p-2 sm:p-3 text-sm sm:text-base">
                            {template.coachName || template.coachEmail || "—"}
                          </td>
                          <td className="hidden md:table-cell p-2 sm:p-3 text-sm sm:text-base">
                            {new Date(template.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-2 sm:p-3">
                            <Link
                              href={`/cohorts/${template.id}`}
                              className="text-neutral-900 hover:underline text-sm"
                            >
                              View
                            </Link>
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
