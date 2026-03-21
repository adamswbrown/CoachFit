"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface MembershipUser {
  id: string
  name: string | null
  email: string
}

interface Membership {
  id: string
  userId: string
  user: MembershipUser
  type: string
  status: string
  startDate: string
  endDate: string | null
  price: number
  notes: string | null
  createdAt: string
}

interface ClientUser {
  id: string
  name: string | null
  email: string
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
  EXPIRED: "bg-neutral-100 text-neutral-500",
}

const TYPE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
  FOUNDER: "Founder",
}

export default function AdminMembershipsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [clients, setClients] = useState<ClientUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formUserId, setFormUserId] = useState("")
  const [formType, setFormType] = useState("MONTHLY")
  const [formStatus, setFormStatus] = useState("ACTIVE")
  const [formStartDate, setFormStartDate] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formNotes, setFormNotes] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    else if (session?.user && !isAdmin(session.user)) router.push("/dashboard")
  }, [status, session, router])

  const fetchMemberships = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/memberships")
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setMemberships(data.memberships || [])
    } catch {
      setError("Failed to load memberships")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users?role=CLIENT")
      if (!res.ok) return
      const data = await res.json()
      // Handle various response shapes
      const users = Array.isArray(data) ? data : data.users || data.data || []
      setClients(users)
    } catch {
      // Non-critical — form still works with manual userId
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetchMemberships()
      fetchClients()
    }
  }, [session, fetchMemberships, fetchClients])

  const resetForm = () => {
    setFormUserId("")
    setFormType("MONTHLY")
    setFormStatus("ACTIVE")
    setFormStartDate("")
    setFormEndDate("")
    setFormPrice("")
    setFormNotes("")
    setEditingMembership(null)
    setShowForm(false)
  }

  const startEdit = (m: Membership) => {
    setEditingMembership(m)
    setFormUserId(m.userId)
    setFormType(m.type)
    setFormStatus(m.status)
    setFormStartDate(m.startDate.slice(0, 10))
    setFormEndDate(m.endDate ? m.endDate.slice(0, 10) : "")
    setFormPrice(m.price.toString())
    setFormNotes(m.notes || "")
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (editingMembership) {
        const body: Record<string, unknown> = {
          type: formType,
          status: formStatus,
          startDate: formStartDate,
          endDate: formEndDate || null,
          price: parseFloat(formPrice),
          notes: formNotes || null,
        }

        const res = await fetch(`/api/admin/memberships/${editingMembership.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Update failed")
        }
      } else {
        const body = {
          userId: formUserId,
          type: formType,
          status: formStatus,
          startDate: formStartDate,
          endDate: formEndDate || undefined,
          price: parseFloat(formPrice),
          notes: formNotes || undefined,
        }

        const res = await fetch("/api/admin/memberships", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Create failed")
        }
      }

      resetForm()
      await fetchMemberships()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, userName: string) => {
    if (!confirm(`Delete membership for "${userName}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/memberships/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      await fetchMemberships()
    } catch {
      setError("Failed to delete membership")
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // Users who don't already have a membership
  const availableClients = clients.filter(
    (c) => !memberships.some((m) => m.userId === c.id)
  )

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="max-w-5xl mx-auto animate-pulse">
          <div className="h-8 w-48 bg-neutral-200 rounded mb-6" />
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Memberships</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Manage client membership plans and statuses.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Add Membership
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              &times;
            </button>
          </div>
        )}

        {showForm && (
          <div className="mb-6 bg-white border border-neutral-200 rounded-xl p-6">
            <h2 className="text-base font-medium text-neutral-900 mb-4">
              {editingMembership ? "Edit Membership" : "New Membership"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              {!editingMembership && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Client
                  </label>
                  <select
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  >
                    <option value="">Select a client...</option>
                    {availableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.email} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="ANNUAL">Annual</option>
                    <option value="FOUNDER">Founder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Price (GBP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm"
                  placeholder="Optional notes about this membership..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingMembership
                      ? "Update"
                      : "Create"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                  Member
                </th>
                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                  Start
                </th>
                <th className="text-left px-4 py-3 font-medium text-neutral-700">
                  End
                </th>
                <th className="text-right px-4 py-3 font-medium text-neutral-700">
                  Price
                </th>
                <th className="text-right px-4 py-3 font-medium text-neutral-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {memberships.map((m) => (
                <tr key={m.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">
                      {m.user.name || "Unnamed"}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {m.user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {TYPE_LABELS[m.type] || m.type}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] || "bg-neutral-100 text-neutral-500"}`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatDate(m.startDate)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {m.endDate ? formatDate(m.endDate) : "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900">
                    {"\u00A3"}
                    {m.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(m)}
                      className="text-blue-600 hover:text-blue-800 text-xs mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        handleDelete(m.id, m.user.name || m.user.email)
                      }
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {memberships.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-neutral-500"
                  >
                    No memberships yet. Click &ldquo;Add Membership&rdquo; to
                    create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CoachLayout>
  )
}
