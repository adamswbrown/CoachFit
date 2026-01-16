"use client"

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Role } from "@/lib/types"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"

type ClientFilter = "all" | "active" | "connected" | "pending" | "offline" | "unassigned" | "invited" | "needs-attention"

interface DashboardStats {
  totalClients: number
  pendingInvites: number
  unassignedCount: number
  totalCohorts: number
}

interface Client {
  id?: string
  name?: string | null
  email: string
  status: "active" | "invited" | "unassigned"
  cohorts: string[]
  lastCheckInDate?: string | null
  checkInCount?: number
  adherenceRate?: number
  weightTrend?: "up" | "down" | "stable" | null
  latestWeight?: number | null
}

interface Cohort {
  id: string
  name: string
  activeClients: number
  pendingInvites: number
  createdAt: string
}

interface GlobalInvite {
  id: string
  email: string
  createdAt: string
}

interface DashboardData {
  stats: DashboardStats
  clients: Client[]
  cohorts: Cohort[]
  globalInvites: GlobalInvite[]
}

function CoachDashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [assigningClient, setAssigningClient] = useState<string | null>(null)
  const [selectedCohortForAssign, setSelectedCohortForAssign] = useState<Record<string, string>>({})
  const [retryCount, setRetryCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")

  const currentFilter = (searchParams.get("filter") as ClientFilter) || "all"

  const handleFilterChange = (filter: ClientFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === "all") {
      params.delete("filter")
    } else {
      params.set("filter", filter)
    }
    router.push(`/coach-dashboard?${params.toString()}`)
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
      // Only redirect clients who aren't coaches or admins
      if (session.user.roles.includes("CLIENT")) {
        router.push("/client-dashboard")
      } else {
        router.push("/login")
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (session) {
      setData(null)
      setError(null)
      setSuccess(null)
      setLoading(true)
      fetchOverview()

      // Check query params for form actions
      const actionParam = searchParams.get("action")
      if (actionParam === "invite-client") {
        setShowInviteForm(true)
      }
    } else {
      setData(null)
      setError(null)
      setLoading(false)
    }
  }, [session, searchParams])

  const fetchOverview = async (isRetry: boolean = false) => {
    if (!isRetry) {
      setLoading(true)
      setError(null)
    }
    try {
      const dashboardData = await fetchWithRetry<DashboardData>("/api/coach-dashboard/overview", {}, 3, 1000)
      setData(dashboardData)
      setError(null)
      setRetryCount(0)
    } catch (err) {
      console.error("Error fetching dashboard overview:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load dashboard. Please try again."
      setError(errorMessage)
      setRetryCount((prev) => prev + 1)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
  }

  // Global invite (not tied to cohort)
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      })

      const responseData = await res.json()

      if (res.ok) {
        setShowInviteForm(false)
        setInviteEmail("")
        setSuccess(responseData.message || "Invite sent successfully")
        setLoading(true)
        await fetchOverview()
      } else {
        setError(responseData.error || "Failed to send invite. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setInviteSubmitting(false)
    }
  }

  // Assign unassigned client to cohort
  const handleAssignClient = async (clientId: string) => {
    const cohortId = selectedCohortForAssign[clientId]
    if (!cohortId) {
      setError("Please select a cohort")
      return
    }

    setAssigningClient(clientId)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/clients/${clientId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId }),
      })

      const responseData = await res.json()

      if (res.ok) {
        setSuccess("Client assigned to cohort successfully")
        setSelectedCohortForAssign({ ...selectedCohortForAssign, [clientId]: "" })
        setLoading(true)
        await fetchOverview()
      } else {
        setError(responseData.error || "Failed to assign client")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setAssigningClient(null)
    }
  }

  const handleDelete = async (cohortId: string, cohortName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm(`Are you sure you want to delete "${cohortName}"? This will also remove all client memberships from this cohort.`)) {
      return
    }

    try {
      const res = await fetch(`/api/cohorts/${cohortId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setSuccess("Cohort deleted")
        setLoading(true)
        await fetchOverview()
      } else {
        const responseData = await res.json()
        setError(responseData.error || "Failed to delete cohort. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm("Cancel this invite?")) return

    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setSuccess("Invite cancelled")
        setLoading(true)
        await fetchOverview()
      } else {
        const responseData = await res.json()
        setError(responseData.error || "Failed to cancel invite")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    }
  }

  if (status === "loading" || loading) {
    return <div className="p-8">Loading...</div>
  }

  if (!session) {
    return null
  }

  // Separate clients by status and sort active clients by cohort
  const activeClients = (data?.clients.filter(c => c.status === "active") || [])
    .sort((a, b) => {
      const cohortA = a.cohorts[0] || ""
      const cohortB = b.cohorts[0] || ""
      return cohortA.localeCompare(cohortB)
    })
  
  const unassignedClients = data?.clients.filter(c => c.status === "unassigned") || []
  const invitedClients = data?.clients.filter(c => c.status === "invited") || []

  // Apply filter based on sidebar selection
  const getFilteredClients = () => {
    switch (currentFilter) {
      case "all":
        return data?.clients || []
      case "active":
      case "connected":
        return activeClients
      case "pending":
        return invitedClients
      case "unassigned":
        return unassignedClients
      case "invited":
        return invitedClients
      case "needs-attention":
        return activeClients.filter((client) => {
          const adherenceRate = client.adherenceRate ?? 0
          const checkInCount = client.checkInCount ?? 0
          return adherenceRate < 0.6 || checkInCount < 5 || !client.lastCheckInDate || 
                 (client.lastCheckInDate && new Date(client.lastCheckInDate) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        })
      case "offline":
        // Offline = active clients who haven't checked in recently
        return activeClients.filter((client) => {
          if (!client.lastCheckInDate) return true
          const lastCheckIn = new Date(client.lastCheckInDate)
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          return lastCheckIn < weekAgo
        })
      default:
        return data?.clients || []
    }
  }

  // Apply status filter first, then text search
  const filteredClients = getFilteredClients().filter((client) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      client.email.toLowerCase().includes(query) ||
      client.name?.toLowerCase().includes(query)
    )
  })

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        {/* Test user banner */}
        {session?.user?.isTestUser && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-amber-700 text-sm">
              Test account — emails are not delivered.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">Clients</h1>
              <p className="text-neutral-600 text-sm mt-1">
                Manage your clients and cohorts
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 text-sm"
              >
                {showInviteForm ? "Cancel" : "Invite Client"}
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Failed to load dashboard</h3>
                <p className="text-red-800 text-sm mb-4">{error}</p>
                {retryCount > 0 && (
                  <p className="text-red-700 text-xs mb-4">
                    Retry attempt {retryCount} of 3
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => fetchOverview(false)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Retry Now
                  </button>
                  <button
                    onClick={() => {
                      setError(null)
                      setRetryCount(0)
                      fetchOverview(false)
                    }}
                    className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors text-sm font-medium"
                  >
                    Clear & Retry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded-md text-sm">
            {success}
          </div>
        )}

        {/* Invite Client Form (Global - no cohort required) */}
        {showInviteForm && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
            <h2 className="text-xl font-semibold mb-2">Invite Client</h2>
            <p className="text-neutral-600 text-sm mb-4">
              Send an invite by email. The client will be linked to you when they sign up, and you can assign them to a cohort later.
            </p>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="client@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={inviteSubmitting}
                className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 disabled:opacity-50"
              >
                {inviteSubmitting ? "Sending..." : "Send Invite"}
              </button>
            </form>
          </div>
        )}

        {data && (
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Active Clients</div>
                <div className="text-3xl font-bold text-neutral-900">{data.stats.totalClients}</div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Unassigned</div>
                <div className="text-3xl font-bold text-neutral-900">{data.stats.unassignedCount}</div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Pending Invites</div>
                <div className="text-3xl font-bold text-neutral-900">{data.stats.pendingInvites}</div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-6 border border-neutral-200">
                <div className="text-sm text-neutral-600 mb-1">Cohorts</div>
                <div className="text-3xl font-bold text-neutral-900">{data.stats.totalCohorts}</div>
              </div>
            </div>

            {/* Pending Invites - Only show if filter is all, pending, or invited */}
            {(currentFilter === "all" || currentFilter === "pending" || currentFilter === "invited") && invitedClients.length > 0 && (
              <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
                <h2 className="text-xl font-semibold mb-2">Pending Invites</h2>
                <p className="text-sm text-neutral-600 mb-4">
                  These clients have been invited but haven't signed up yet.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Email</th>
                        <th className="text-left p-3 font-semibold">Cohort (if any)</th>
                        <th className="text-left p-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitedClients.map((client) => {
                        // Find if this is a global invite (no cohorts)
                        const globalInvite = data.globalInvites.find(i => i.email === client.email)
                        return (
                          <tr key={client.email} className="border-b bg-neutral-50 italic">
                            <td className="p-3">{client.email}</td>
                            <td className="p-3 text-sm text-neutral-500">
                              {client.cohorts.length > 0 ? client.cohorts.join(", ") : "Not assigned yet"}
                            </td>
                            <td className="p-3">
                              {globalInvite && (
                                <button
                                  onClick={() => handleCancelInvite(globalInvite.id)}
                                  className="text-neutral-700 hover:underline text-sm"
                                >
                                  Cancel
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unassigned Clients Section - Only show if filter is all or unassigned */}
            {(currentFilter === "all" || currentFilter === "unassigned") && unassignedClients.length > 0 && (
              <div className="bg-orange-50 rounded-lg border border-neutral-200 p-6 mb-8 border border-orange-200">
                <h2 className="text-xl font-semibold mb-2 text-orange-800">Unassigned Clients</h2>
                <p className="text-sm text-orange-700 mb-4">
                  These clients have signed up but aren't in any cohort yet. Assign them to a cohort to get started.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-amber-200">
                        <th className="text-left p-3 font-semibold">Name</th>
                        <th className="text-left p-3 font-semibold">Email</th>
                        <th className="text-left p-3 font-semibold">Assign to Cohort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedClients.map((client) => (
                        <tr key={client.email} className="border-b border-amber-100">
                          <td className="p-3">{client.name || "No name"}</td>
                          <td className="p-3">{client.email}</td>
                          <td className="p-3">
                            {data.cohorts.length > 0 ? (
                              <div className="flex gap-2 items-center">
                                <select
                                  value={selectedCohortForAssign[client.id!] || ""}
                                  onChange={(e) =>
                                    setSelectedCohortForAssign({
                                      ...selectedCohortForAssign,
                                      [client.id!]: e.target.value,
                                    })
                                  }
                                  className="px-2 py-1 border rounded-md text-sm"
                                >
                                  <option value="">Select cohort...</option>
                                  {data.cohorts.map((cohort) => (
                                    <option key={cohort.id} value={cohort.id}>
                                      {cohort.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssignClient(client.id!)}
                                  disabled={assigningClient === client.id || !selectedCohortForAssign[client.id!]}
                                  className="bg-neutral-900 text-white px-3 py-1 rounded-md hover:bg-neutral-800 disabled:opacity-50 text-sm"
                                >
                                  {assigningClient === client.id ? "..." : "Assign"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-amber-600 text-sm">Create a cohort first</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Clients List - Show based on filter */}
            {filteredClients.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">
                      {currentFilter === "all" ? "All Clients" :
                       currentFilter === "active" || currentFilter === "connected" ? "Connected Clients" :
                       currentFilter === "pending" || currentFilter === "invited" ? "Pending Invites" :
                       currentFilter === "unassigned" ? "Unassigned Clients" :
                       currentFilter === "needs-attention" ? "Clients Needing Attention" :
                       currentFilter === "offline" ? "Offline Clients" : "Clients"}
                    </h2>
                    <p className="text-sm text-neutral-600 mt-1">
                      {filteredClients.length} {currentFilter === "all" ? "total" : currentFilter === "needs-attention" ? "needing attention" : currentFilter === "active" || currentFilter === "connected" ? "connected" : currentFilter === "pending" || currentFilter === "invited" ? "pending" : currentFilter === "unassigned" ? "unassigned" : currentFilter === "offline" ? "offline" : ""} client{filteredClients.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {(currentFilter === "all" || currentFilter === "pending" || currentFilter === "unassigned") && (
                  <div className="mb-4">
                    <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-1">
                      {[
                        { value: "all", label: "All" },
                        { value: "pending", label: "Pending" },
                        { value: "unassigned", label: "Unassigned" },
                      ].map((tab) => (
                        <button
                          key={tab.value}
                          onClick={() => handleFilterChange(tab.value as ClientFilter)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            currentFilter === tab.value
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-600 hover:text-neutral-900"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Bar */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search clients by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left p-3 font-semibold text-neutral-900">Name</th>
                        <th className="text-left p-3 font-semibold text-neutral-900">Status</th>
                        {currentFilter === "all" || currentFilter === "active" || currentFilter === "connected" || currentFilter === "needs-attention" || currentFilter === "offline" ? (
                          <>
                            <th className="text-left p-3 font-semibold text-neutral-900">Adherence</th>
                            <th className="text-left p-3 font-semibold text-neutral-900">Weight Trend</th>
                            <th className="text-left p-3 font-semibold text-neutral-900">Last Check-In</th>
                          </>
                        ) : null}
                        <th className="text-left p-3 font-semibold text-neutral-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client) => {
                        const adherenceRate = client.adherenceRate ?? 0
                        const checkInCount = client.checkInCount ?? 0
                        const adherenceColor =
                          adherenceRate >= 0.8
                            ? "green"
                            : adherenceRate >= 0.6
                            ? "yellow"
                            : "red"

                        return (
                          <tr key={client.email || client.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                            <td className="p-3">
                              {client.id ? (
                                <Link
                                  href={`/clients/${client.id}`}
                                  className="font-medium text-neutral-900 hover:underline"
                                >
                                  {client.name || client.email}
                                </Link>
                              ) : (
                                <span className="font-medium text-neutral-900">{client.name || client.email}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                client.status === "active" ? "bg-green-100 text-green-700" :
                                client.status === "invited" ? "bg-amber-100 text-amber-700" :
                                "bg-neutral-100 text-neutral-700"
                              }`}>
                                {client.status === "active" ? "Connected" :
                                 client.status === "invited" ? "Pending" :
                                 client.status === "unassigned" ? "Unassigned" : client.status}
                              </span>
                            </td>
                            {(currentFilter === "all" || currentFilter === "active" || currentFilter === "connected" || currentFilter === "needs-attention" || currentFilter === "offline") && client.status === "active" ? (
                              <>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                                        adherenceColor === "green"
                                          ? "bg-green-100 text-green-700"
                                          : adherenceColor === "yellow"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {checkInCount}/7
                                    </span>
                                    <span className="text-xs text-neutral-500">
                                      {Math.round(adherenceRate * 100)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  {client.weightTrend === "up" && (
                                    <span className="text-red-600 font-medium">↑ Up</span>
                                  )}
                                  {client.weightTrend === "down" && (
                                    <span className="text-green-600 font-medium">↓ Down</span>
                                  )}
                                  {client.weightTrend === "stable" && (
                                    <span className="text-neutral-600 font-medium">→ Stable</span>
                                  )}
                                  {!client.weightTrend && (
                                    <span className="text-neutral-400 text-sm">—</span>
                                  )}
                                  {client.latestWeight !== null && client.latestWeight !== undefined && (
                                    <span className="ml-2 text-sm text-neutral-600">
                                      ({client.latestWeight.toFixed(1)} lbs)
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-sm text-neutral-600">
                                  {client.lastCheckInDate
                                    ? new Date(client.lastCheckInDate).toLocaleDateString()
                                    : "Never"}
                                </td>
                              </>
                            ) : (currentFilter === "all" || currentFilter === "active" || currentFilter === "connected" || currentFilter === "needs-attention" || currentFilter === "offline") ? (
                              <>
                                <td className="p-3 text-sm text-neutral-400">—</td>
                                <td className="p-3 text-sm text-neutral-400">—</td>
                                <td className="p-3 text-sm text-neutral-400">—</td>
                              </>
                            ) : null}
                            <td className="p-3">
                              {client.id ? (
                                <Link
                                  href={`/clients/${client.id}`}
                                  className="text-neutral-900 hover:underline text-sm"
                                >
                                  View
                                </Link>
                              ) : (
                                <span className="text-sm text-neutral-400">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </CoachLayout>
  )
}

export default function CoachDashboard() {
  return (
    <Suspense fallback={
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
    }>
      <CoachDashboardContent />
    </Suspense>
  )
}
