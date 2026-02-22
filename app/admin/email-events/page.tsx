"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface EmailEvent {
  id: string
  resendEmailId: string
  to: string
  subject: string | null
  status: string
  eventData?: Record<string, any> | null
  occurredAt: string
  createdAt: string
  coachInviteId: string | null
  cohortInviteId: string | null
  CoachInvite?: {
    id: string
    email: string
    coachId: string
  } | null
  CohortInvite?: {
    id: string
    email: string
    cohortId: string
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    delivered: { label: "✓ Delivered", className: "bg-green-100 text-green-700" },
    opened: { label: "✓ Opened", className: "bg-green-100 text-green-700" },
    clicked: { label: "✓ Clicked", className: "bg-green-100 text-green-700" },
    bounced: { label: "✗ Bounced", className: "bg-red-100 text-red-700" },
    failed: { label: "✗ Failed", className: "bg-red-100 text-red-700" },
    complained: { label: "⚠ Spam", className: "bg-red-100 text-red-700" },
    sent: { label: "● Sent", className: "bg-blue-100 text-blue-700" },
    delivery_delayed: { label: "⏱ Delayed", className: "bg-amber-100 text-amber-700" },
  }

  const { label, className } = config[status] || {
    label: status,
    className: "bg-neutral-100 text-neutral-600",
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export default function EmailEventsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<EmailEvent[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdmin(session.user)) {
      if (session.user.roles.includes(Role.COACH)) {
        router.push("/coach-dashboard")
      } else {
        router.push("/client-dashboard")
      }
    }
  }, [sessionStatus, session, router])

  useEffect(() => {
    if (session?.user && isAdmin(session.user)) {
      fetchEvents()
    }
  }, [session, statusFilter, page])

  const fetchEvents = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("page", page.toString())
      params.set("limit", "50")
      if (statusFilter) params.set("status", statusFilter)
      if (search.trim()) params.set("to", search.trim())

      const res = await fetch(`/api/admin/email-events?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to load email events")
      }
      const data = await res.json()
      setEvents(data.events || [])
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email events")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchEvents()
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const filteredEvents = useMemo(() => {
    // Client-side search is supplementary — the API also filters by `to`
    // This allows searching through subject and resendEmailId locally
    if (!search.trim()) return events
    const query = search.trim().toLowerCase()
    return events.filter((event) => {
      return (
        event.to.toLowerCase().includes(query) ||
        (event.subject || "").toLowerCase().includes(query) ||
        event.resendEmailId.toLowerCase().includes(query)
      )
    })
  }, [events, search])

  const getInviteLabel = (event: EmailEvent): string | null => {
    if (event.CoachInvite) return `Coach invite`
    if (event.CohortInvite) return `Cohort invite`
    return null
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="p-8 text-neutral-500">Loading email events...</div>
      </CoachLayout>
    )
  }

  if (!session || !isAdmin(session.user)) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900">Email Events</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Track email delivery status for invitations and system emails.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <input
              type="text"
              placeholder="Search by recipient email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full sm:max-w-xs px-3 py-2 border border-neutral-300 rounded-md text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="w-full sm:max-w-[180px] px-3 py-2 border border-neutral-300 rounded-md text-sm"
            >
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="bounced">Bounced</option>
              <option value="failed">Failed</option>
              <option value="complained">Spam / Complained</option>
              <option value="delivery_delayed">Delayed</option>
            </select>
            <button
              type="button"
              onClick={handleSearch}
              className="w-full sm:w-auto px-4 py-2 bg-neutral-900 text-white rounded-md text-sm"
            >
              Search
            </button>
          </div>
        </div>

        {/* Results summary */}
        <div className="mb-3 text-sm text-neutral-500">
          {pagination.total} event{pagination.total !== 1 ? "s" : ""} found
          {pagination.totalPages > 1 && ` — Page ${pagination.page} of ${pagination.totalPages}`}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-neutral-200">
          {filteredEvents.length === 0 ? (
            <div className="p-6 text-neutral-500 text-sm">No email events found.</div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b bg-neutral-50">
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Time</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Recipient</th>
                    <th className="hidden sm:table-cell text-left p-2 sm:p-3 font-semibold text-sm">Subject</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Status</th>
                    <th className="hidden md:table-cell text-left p-2 sm:p-3 font-semibold text-sm">Invite</th>
                    <th className="hidden lg:table-cell text-left p-2 sm:p-3 font-semibold text-sm">Resend ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="border-b hover:bg-neutral-50">
                      <td className="p-2 sm:p-3 text-sm text-neutral-600 whitespace-nowrap">
                        {new Date(event.occurredAt).toLocaleString()}
                      </td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-900">
                        {event.to}
                      </td>
                      <td className="hidden sm:table-cell p-2 sm:p-3 text-sm text-neutral-600 max-w-[200px] truncate">
                        {event.subject || "—"}
                      </td>
                      <td className="p-2 sm:p-3">
                        <StatusBadge status={event.status} />
                      </td>
                      <td className="hidden md:table-cell p-2 sm:p-3 text-sm text-neutral-500">
                        {getInviteLabel(event) || "—"}
                      </td>
                      <td className="hidden lg:table-cell p-2 sm:p-3 text-xs text-neutral-400 font-mono max-w-[180px] truncate">
                        {event.resendEmailId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm border border-neutral-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              ← Previous
            </button>
            <span className="text-sm text-neutral-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-4 py-2 text-sm border border-neutral-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
