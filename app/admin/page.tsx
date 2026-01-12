"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"
import { AdminLayout } from "@/components/layouts/AdminLayout"

interface Cohort {
  id: string
  name: string
  coach: {
    id: string
    name: string | null
    email: string
  }
  activeClients: number
  pendingInvites: number
  createdAt: string
}

interface Coach {
  id: string
  name: string | null
  email: string
}

interface CohortInfo {
  id: string
  name: string
}

interface User {
  id: string
  email: string
  name: string | null
  roles: string[]
  isTestUser: boolean
  createdAt: string
  hasPassword: boolean
  authProviders: string[]
  cohortsMemberOf: CohortInfo[]
  cohortsCoaching: CohortInfo[]
}

type Tab = "users" | "cohorts"

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>("users")
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<Record<string, boolean>>({})
  const [selectedCoaches, setSelectedCoaches] = useState<Record<string, string>>({})
  const [updatingRoles, setUpdatingRoles] = useState<Record<string, boolean>>({})
  const [showCreateCoach, setShowCreateCoach] = useState(false)
  const [creatingCoach, setCreatingCoach] = useState(false)
  const [newCoachData, setNewCoachData] = useState({ email: "", name: "", password: "" })
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState("")
  const [resettingPassword, setResettingPassword] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

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
      loadAllData()
    }
  }, [session])

  const loadAllData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/dashboard")
      if (res.ok) {
        const data = await res.json()
        setCohorts(data.cohorts || [])
        setCoaches(data.coaches || [])
        setUsers(data.users || [])
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to load dashboard data")
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
      setError("Failed to load dashboard data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleAssignCoach = async (cohortId: string) => {
    const coachId = selectedCoaches[cohortId]
    if (!coachId) {
      setError("Please select a coach")
      return
    }

    setAssigning({ ...assigning, [cohortId]: true })
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/admin/cohorts/${cohortId}/assign-coach`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachId }),
      })

      if (res.ok) {
        const updatedCohort = await res.json()
        setCohorts((prev) =>
          prev.map((c) => (c.id === cohortId ? updatedCohort : c))
        )
        setSelectedCoaches({ ...selectedCoaches, [cohortId]: "" })
        setSuccess("Coach assigned successfully")
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to assign coach")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setAssigning({ ...assigning, [cohortId]: false })
    }
  }

  const handleRoleChange = async (userId: string, role: "COACH" | "ADMIN", action: "add" | "remove") => {
    setUpdatingRoles({ ...updatingRoles, [userId]: true })
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role }),
      })

      if (res.ok) {
        const data = await res.json()
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? data.user : u))
        )
        setSuccess(data.message)
        if (role === "COACH") {
          await loadAllData()
        }
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to update role")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setUpdatingRoles({ ...updatingRoles, [userId]: false })
    }
  }

  const handleCreateCoach = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingCoach(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/admin/coaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCoachData),
      })

      if (res.ok) {
        const data = await res.json()
        setSuccess(data.message || "Coach created successfully")
        setShowCreateCoach(false)
        setNewCoachData({ email: "", name: "", password: "" })
        await loadAllData()
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to create coach")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setCreatingCoach(false)
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (!resetPassword || resetPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setResettingPassword(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword, sendEmail: true }),
      })

      if (res.ok) {
        const data = await res.json()
        setSuccess(data.message)
        setResetPasswordUserId(null)
        setResetPassword("")
        await loadAllData()
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to reset password")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setResettingPassword(false)
    }
  }

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      user.email.toLowerCase().includes(query) ||
      user.name?.toLowerCase().includes(query) ||
      user.roles.some((role) => role.toLowerCase().includes(query))
    )
  })

  if (status === "loading" || loading) {
    return <div className="p-8">Loading...</div>
  }

  if (!session || !isAdmin(session.user)) {
    return null
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* Test user banner */}
        {session?.user?.isTestUser && (
          <div className="mb-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-sm">
            <p className="text-amber-700">Test account — emails are not delivered.</p>
          </div>
        )}

        {/* Header with Stats */}
        <div className="mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">Admin Dashboard</h1>
              <p className="text-neutral-600 text-sm mt-1">
                Manage users, roles, and cohorts
              </p>
            </div>
            <button
              onClick={() => setShowCreateCoach(true)}
              className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 text-sm whitespace-nowrap"
            >
              + Create Coach
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white border border-neutral-200 rounded-lg p-3">
              <div className="text-sm text-neutral-500">Total Users</div>
              <div className="text-2xl font-semibold text-neutral-900">{users.length}</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-3">
              <div className="text-sm text-neutral-500">Coaches</div>
              <div className="text-2xl font-semibold text-neutral-900">{coaches.length}</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-lg p-3">
              <div className="text-sm text-neutral-500">Cohorts</div>
              <div className="text-2xl font-semibold text-neutral-900">{cohorts.length}</div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-3 p-2.5 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm">
            <p>{success}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-neutral-200 mb-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "users"
                  ? "text-neutral-900 border-b-2 border-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("cohorts")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "cohorts"
                  ? "text-neutral-900 border-b-2 border-neutral-900"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Cohorts ({cohorts.length})
            </button>
          </div>
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="bg-white border border-neutral-200 rounded-lg">
            {/* Search Bar */}
            <div className="p-4 border-b border-neutral-200">
              <input
                type="text"
                placeholder="Search users by email, name, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-500"
              />
            </div>

            {/* Users Table */}
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                {searchQuery ? "No users found matching your search." : "No users found."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-neutral-50">
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">User</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">Roles</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">Cohorts</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const hasCoach = user.roles.includes("COACH")
                      const hasAdmin = user.roles.includes("ADMIN")
                      const isCurrentUser = user.id === session.user.id

                      return (
                        <tr key={user.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="p-2.5">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm">
                                  {user.name || "—"}
                                </p>
                                {user.isTestUser && (
                                  <span className="text-xs text-amber-600">(test)</span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-500 mt-0.5">{user.email}</p>
                              <div className="flex gap-1 mt-1">
                                {user.authProviders?.includes("google") && (
                                  <span className="px-1 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded" title="Google OAuth">
                                    Google
                                  </span>
                                )}
                                {user.hasPassword ? (
                                  <span className="px-1 py-0.5 text-xs bg-neutral-50 text-neutral-700 rounded" title="Has password">
                                    🔑
                                  </span>
                                ) : (
                                  <span className="px-1 py-0.5 text-xs bg-amber-50 text-amber-600 rounded" title="No password">
                                    ⚠️
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex gap-1 flex-wrap">
                              {user.roles.map((role) => (
                                <span
                                  key={role}
                                  className="px-1.5 py-0.5 text-xs rounded bg-neutral-100 text-neutral-800"
                                >
                                  {role}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex flex-col gap-0.5">
                              {user.cohortsCoaching.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  <span className="text-xs text-neutral-400">Coaching:</span>
                                  {user.cohortsCoaching.slice(0, 2).map((cohort) => (
                                    <Link
                                      key={cohort.id}
                                      href={`/cohorts/${cohort.id}`}
                                      className="px-1.5 py-0.5 text-xs rounded bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                                    >
                                      {cohort.name}
                                    </Link>
                                  ))}
                                  {user.cohortsCoaching.length > 2 && (
                                    <span className="text-xs text-neutral-400">+{user.cohortsCoaching.length - 2}</span>
                                  )}
                                </div>
                              )}
                              {user.cohortsMemberOf.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  <span className="text-xs text-neutral-400">Member:</span>
                                  {user.cohortsMemberOf.slice(0, 2).map((cohort) => (
                                    <Link
                                      key={cohort.id}
                                      href={`/cohorts/${cohort.id}`}
                                      className="px-1.5 py-0.5 text-xs rounded bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                                    >
                                      {cohort.name}
                                    </Link>
                                  ))}
                                  {user.cohortsMemberOf.length > 2 && (
                                    <span className="text-xs text-neutral-400">+{user.cohortsMemberOf.length - 2}</span>
                                  )}
                                </div>
                              )}
                              {user.cohortsMemberOf.length === 0 && user.cohortsCoaching.length === 0 && (
                                <span className="text-xs text-neutral-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex gap-1 flex-wrap">
                              {hasCoach && (
                                <button
                                  onClick={() => handleRoleChange(user.id, "COACH", "remove")}
                                  disabled={updatingRoles[user.id]}
                                  className="px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50"
                                  title="Remove Coach role"
                                >
                                  {updatingRoles[user.id] ? "..." : "−Coach"}
                                </button>
                              )}
                              {!hasCoach && hasAdmin && (
                                <button
                                  onClick={() => handleRoleChange(user.id, "COACH", "add")}
                                  disabled={updatingRoles[user.id]}
                                  className="px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50"
                                  title="Add Coach role"
                                >
                                  {updatingRoles[user.id] ? "..." : "+Coach"}
                                </button>
                              )}
                              {hasAdmin && (
                                <button
                                  onClick={() => handleRoleChange(user.id, "ADMIN", "remove")}
                                  disabled={updatingRoles[user.id] || isCurrentUser}
                                  className="px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50"
                                  title={isCurrentUser ? "Cannot remove your own admin role" : "Remove Admin role"}
                                >
                                  {updatingRoles[user.id] ? "..." : "−Admin"}
                                </button>
                              )}
                              {!hasAdmin && hasCoach && (
                                <button
                                  onClick={() => handleRoleChange(user.id, "ADMIN", "add")}
                                  disabled={updatingRoles[user.id]}
                                  className="px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200 disabled:opacity-50"
                                  title="Add Admin role"
                                >
                                  {updatingRoles[user.id] ? "..." : "+Admin"}
                                </button>
                              )}
                              {resetPasswordUserId === user.id ? (
                                <div className="flex gap-1 items-center">
                                  <input
                                    type="password"
                                    placeholder="Password"
                                    value={resetPassword}
                                    onChange={(e) => setResetPassword(e.target.value)}
                                    className="px-2 py-1 text-xs border rounded w-20"
                                    minLength={8}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleResetPassword(user.id)}
                                    disabled={resettingPassword || resetPassword.length < 8}
                                    className="px-2 py-1 text-xs bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50"
                                  >
                                    {resettingPassword ? "..." : "Set"}
                                  </button>
                                  <button
                                    onClick={() => { setResetPasswordUserId(null); setResetPassword("") }}
                                    className="px-1.5 py-1 text-xs bg-neutral-100 text-neutral-700 rounded hover:bg-neutral-200"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setResetPasswordUserId(user.id)}
                                  className="px-2 py-1 text-xs rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                  title={user.hasPassword ? "Reset password" : "Set password"}
                                >
                                  🔑
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Cohorts Tab */}
        {activeTab === "cohorts" && (
          <div className="bg-white border border-neutral-200 rounded-lg">
            {cohorts.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">No cohorts found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-neutral-50">
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">Cohort</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">Coach</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">Clients</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">Pending</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-neutral-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((cohort) => (
                      <tr key={cohort.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className="p-2.5">
                          <Link
                            href={`/cohorts/${cohort.id}`}
                            className="font-medium text-sm text-neutral-900 hover:underline"
                          >
                            {cohort.name}
                          </Link>
                        </td>
                        <td className="p-2.5 text-sm text-neutral-700">
                          {cohort.coach.name || cohort.coach.email}
                        </td>
                        <td className="p-2.5 text-sm text-neutral-700">{cohort.activeClients}</td>
                        <td className="p-2.5 text-sm text-neutral-700">{cohort.pendingInvites}</td>
                        <td className="p-2.5">
                          <div className="flex gap-2 items-center">
                            <select
                              value={selectedCoaches[cohort.id] || ""}
                              onChange={(e) =>
                                setSelectedCoaches({
                                  ...selectedCoaches,
                                  [cohort.id]: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded text-xs"
                              disabled={assigning[cohort.id]}
                            >
                              <option value="">Select...</option>
                              {coaches.map((coach) => (
                                <option key={coach.id} value={coach.id}>
                                  {coach.name || coach.email}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssignCoach(cohort.id)}
                              disabled={assigning[cohort.id] || !selectedCoaches[cohort.id]}
                              className="bg-neutral-900 text-white px-2 py-1 rounded text-xs hover:bg-neutral-800 disabled:opacity-50"
                            >
                              {assigning[cohort.id] ? "..." : "Assign"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Coach Modal */}
        {showCreateCoach && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateCoach(false)}>
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Create New Coach</h2>
                <button
                  onClick={() => setShowCreateCoach(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  ✕
                </button>
              </div>
              <p className="text-neutral-600 text-sm mb-4">
                Create a new coach account. They will receive an email with login instructions.
              </p>
              <form onSubmit={handleCreateCoach} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={newCoachData.name}
                    onChange={(e) => setNewCoachData({ ...newCoachData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    placeholder="Coach Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newCoachData.email}
                    onChange={(e) => setNewCoachData({ ...newCoachData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    placeholder="coach@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newCoachData.password}
                    onChange={(e) => setNewCoachData({ ...newCoachData, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCoach(false)}
                    className="flex-1 px-4 py-2 border border-neutral-300 rounded-md hover:bg-neutral-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingCoach}
                    className="flex-1 bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 disabled:opacity-50 text-sm"
                  >
                    {creatingCoach ? "Creating..." : "Create Coach"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
