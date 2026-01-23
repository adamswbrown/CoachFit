"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface AdminAction {
  id: string
  actionType: string
  targetType: string
  targetId?: string | null
  details?: Record<string, any> | null
  reason?: string | null
  createdAt: string
  admin: {
    id: string
    name: string | null
    email: string
  }
}

export default function AuditLogPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [actions, setActions] = useState<AdminAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionTypeFilter, setActionTypeFilter] = useState("")
  const [search, setSearch] = useState("")

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
      fetchActions()
    }
  }, [session, actionTypeFilter])

  const fetchActions = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("limit", "200")
      if (actionTypeFilter) {
        params.set("actionType", actionTypeFilter)
      }
      const res = await fetch(`/api/admin/actions?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to load audit log")
      }
      const data = await res.json()
      setActions(data.actions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log")
    } finally {
      setLoading(false)
    }
  }

  const filteredActions = useMemo(() => {
    if (!search.trim()) return actions
    const query = search.trim().toLowerCase()
    return actions.filter((action) => {
      return (
        action.actionType.toLowerCase().includes(query) ||
        action.targetType.toLowerCase().includes(query) ||
        (action.targetId || "").toLowerCase().includes(query) ||
        (action.admin.email || "").toLowerCase().includes(query) ||
        (action.admin.name || "").toLowerCase().includes(query)
      )
    })
  }, [actions, search])

  const actionTypes = useMemo(() => {
    const unique = new Set(actions.map((action) => action.actionType))
    return Array.from(unique).sort()
  }, [actions])

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="p-8 text-neutral-500">Loading audit log...</div>
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
          <h1 className="text-2xl font-semibold text-neutral-900">Audit Log</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Track administrative actions across cohorts, settings, and migrations.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Search by action, target, or admin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs px-3 py-2 border border-neutral-300 rounded-md text-sm"
          />
          <select
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="w-full sm:max-w-xs px-3 py-2 border border-neutral-300 rounded-md text-sm"
          >
            <option value="">All action types</option>
            {actionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200">
          {filteredActions.length === 0 ? (
            <div className="p-6 text-neutral-500 text-sm">No audit actions found.</div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b bg-neutral-50">
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Time</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Action</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Target</th>
                    <th className="hidden md:table-cell text-left p-2 sm:p-3 font-semibold text-sm">Admin</th>
                    <th className="hidden lg:table-cell text-left p-2 sm:p-3 font-semibold text-sm">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActions.map((action) => (
                    <tr key={action.id} className="border-b">
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">
                        {new Date(action.createdAt).toLocaleString()}
                      </td>
                      <td className="p-2 sm:p-3 text-sm font-medium text-neutral-900">
                        {action.actionType}
                      </td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">
                        {action.targetType}
                        {action.targetId ? ` • ${action.targetId}` : ""}
                      </td>
                      <td className="hidden md:table-cell p-2 sm:p-3 text-sm text-neutral-600">
                        {action.admin.name || action.admin.email}
                      </td>
                      <td className="hidden lg:table-cell p-2 sm:p-3 text-xs text-neutral-500">
                        {action.details ? JSON.stringify(action.details) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </CoachLayout>
  )
}
