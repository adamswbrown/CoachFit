"use client"

import { useEffect, useState } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface PlatformInvite {
  id: string
  email: string
  invitedBy: { id: string; name: string | null; email: string }
  createdAt: string
  usedAt: string | null
}

export default function PlatformInvitesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [invites, setInvites] = useState<PlatformInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
      router.push("/client-dashboard")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user && isAdminOrCoach(session.user)) {
      fetchInvites()
    }
  }, [session])

  const fetchInvites = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/platform-invites")
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to load invites")
      }
      const data = await res.json()
      setInvites(data.invites || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites")
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/platform-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invite")
      }
      setSuccess(`Invite sent to ${email.trim()}`)
      setEmail("")
      await fetchInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite")
    } finally {
      setSending(false)
    }
  }

  const handleRevoke = async (invite: PlatformInvite) => {
    if (!confirm(`Revoke invite for ${invite.email}?`)) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/platform-invites/${invite.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to revoke invite")
      }
      await fetchInvites()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite")
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="p-8 text-neutral-500">Loading invites...</div>
      </CoachLayout>
    )
  }

  if (!session || !isAdminOrCoach(session.user)) {
    return null
  }

  const pendingInvites = invites.filter((i) => !i.usedAt)
  const usedInvites = invites.filter((i) => i.usedAt)

  return (
    <CoachLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900">Platform Invites</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Only invited emails can create an account. Invite users here to grant them access.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm">
            {success}
          </div>
        )}

        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Invite a User</h2>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="bg-neutral-900 text-white px-5 py-2 rounded-md hover:bg-neutral-800 disabled:opacity-50 whitespace-nowrap"
            >
              {sending ? "Sending..." : "Send Invite"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 mb-8">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold">Pending Invites ({pendingInvites.length})</h2>
          </div>
          {pendingInvites.length === 0 ? (
            <div className="p-6 text-neutral-500 text-sm">No pending invites.</div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b bg-neutral-50">
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Email</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Invited By</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Date</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((invite) => (
                    <tr key={invite.id} className="border-b">
                      <td className="p-2 sm:p-3 text-sm font-medium">{invite.email}</td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">
                        {invite.invitedBy.name || invite.invitedBy.email}
                      </td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-2 sm:p-3 text-sm">
                        <button
                          type="button"
                          onClick={() => handleRevoke(invite)}
                          className="text-red-600 hover:underline"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {usedInvites.length > 0 && (
          <div className="bg-white rounded-lg border border-neutral-200">
            <div className="p-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold">Used Invites ({usedInvites.length})</h2>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b bg-neutral-50">
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Email</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Invited By</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Invited</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {usedInvites.map((invite) => (
                    <tr key={invite.id} className="border-b">
                      <td className="p-2 sm:p-3 text-sm font-medium">{invite.email}</td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">
                        {invite.invitedBy.name || invite.invitedBy.email}
                      </td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">
                        {new Date(invite.usedAt!).toLocaleDateString()}
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
