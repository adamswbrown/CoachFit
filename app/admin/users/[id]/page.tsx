"use client"

import { useState, useEffect, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isAdmin } from "@/lib/permissions"
import { AdminLayout } from "@/components/layouts/AdminLayout"
import { Role } from "@/lib/types"

interface UserDetails {
  id: string
  email: string
  name: string | null
  roles: string[]
  isTestUser: boolean
  createdAt: string
  onboardingComplete: boolean
  hasPassword: boolean
  authProviders: string[]
  cohortsMemberOf: Array<{
    id: string
    name: string
    createdAt: string
  }>
  cohortsCoaching: Array<{
    id: string
    name: string
    createdAt: string
    clientCount: number
  }>
  recentEntries: Array<{
    id: string
    date: string
    weightLbs: number | null
    steps: number | null
    calories: number | null
    createdAt: string
  }>
  invitedByCoachId: string | null
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = use(params)

  const [user, setUser] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdmin(session.user)) {
      router.push("/admin")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user && isAdmin(session.user)) {
      fetchUser()
    }
  }, [session, id])

  const fetchUser = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${id}`)
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        const errorData = await res.json()
        setError(errorData.error || "Failed to load user")
      }
    } catch (err) {
      console.error("Error fetching user:", err)
      setError("Failed to load user")
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-neutral-500">Loading user details...</p>
        </div>
      </AdminLayout>
    )
  }

  if (!session || !isAdmin(session.user)) {
    return null
  }

  if (error && !user) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (!user) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto">
          <p className="text-neutral-500">User not found</p>
        </div>
      </AdminLayout>
    )
  }

  const isCoach = user.roles.includes(Role.COACH)
  const isClient = user.roles.includes(Role.CLIENT)

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/admin" className="text-blue-600 hover:underline text-sm">
            ← Back to Admin Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                {user.name || "No name"}
              </h1>
              <p className="text-neutral-600">{user.email}</p>
            </div>
            <div className="flex gap-2">
              {user.roles.map((role) => (
                <span
                  key={role}
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    role === "ADMIN"
                      ? "bg-purple-100 text-purple-800"
                      : role === "COACH"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-neutral-500 mb-1">Account Created</p>
              <p className="text-sm font-medium">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-1">Onboarding Status</p>
              <p className="text-sm font-medium">
                {user.onboardingComplete ? (
                  <span className="text-green-600">Complete</span>
                ) : (
                  <span className="text-amber-600">Incomplete</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-1">Authentication</p>
              <div className="flex gap-1 flex-wrap">
                {user.hasPassword && (
                  <span className="px-2 py-0.5 text-xs bg-neutral-100 text-neutral-700 rounded">
                    Email/Password
                  </span>
                )}
                {user.authProviders.map((provider) => (
                  <span
                    key={provider}
                    className="px-2 py-0.5 text-xs bg-neutral-100 text-neutral-700 rounded"
                  >
                    {provider}
                  </span>
                ))}
              </div>
            </div>
            {user.isTestUser && (
              <div>
                <p className="text-sm text-neutral-500 mb-1">Test User</p>
                <p className="text-sm font-medium text-amber-600">Yes</p>
              </div>
            )}
          </div>
        </div>

        {/* Cohorts Section */}
        {isClient && user.cohortsMemberOf.length > 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Member of Cohorts</h2>
            <div className="space-y-2">
              {user.cohortsMemberOf.map((cohort) => (
                <Link
                  key={cohort.id}
                  href={`/cohorts/${cohort.id}`}
                  className="block p-3 border rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{cohort.name}</span>
                    <span className="text-sm text-neutral-500">
                      {new Date(cohort.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Coaching Cohorts Section */}
        {isCoach && user.cohortsCoaching.length > 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Coaching Cohorts</h2>
            <div className="space-y-2">
              {user.cohortsCoaching.map((cohort) => (
                <Link
                  key={cohort.id}
                  href={`/cohorts/${cohort.id}`}
                  className="block p-3 border rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{cohort.name}</span>
                      <span className="text-sm text-neutral-500 ml-2">
                        ({cohort.clientCount} clients)
                      </span>
                    </div>
                    <span className="text-sm text-neutral-500">
                      {new Date(cohort.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Entries Section (for clients) */}
        {isClient && user.recentEntries.length > 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Entries</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-right p-2">Weight</th>
                    <th className="text-right p-2">Steps</th>
                    <th className="text-right p-2">Calories</th>
                  </tr>
                </thead>
                <tbody>
                  {user.recentEntries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="p-2">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="p-2 text-right">
                        {entry.weightLbs ? `${entry.weightLbs.toFixed(1)} lbs` : "—"}
                      </td>
                      <td className="p-2 text-right">
                        {entry.steps ? entry.steps.toLocaleString() : "—"}
                      </td>
                      <td className="p-2 text-right">
                        {entry.calories ? entry.calories.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {user.cohortsMemberOf.length > 0 && (
              <div className="mt-4">
                <Link
                  href={`/clients/${user.id}/entries`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View all entries →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* No Data Messages */}
        {isClient && user.cohortsMemberOf.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800">
              <strong>Not assigned to any cohort.</strong> This user needs to be assigned to a cohort to start logging entries.
            </p>
          </div>
        )}

        {isCoach && user.cohortsCoaching.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800">
              <strong>No cohorts assigned.</strong> This coach is not managing any cohorts yet.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
