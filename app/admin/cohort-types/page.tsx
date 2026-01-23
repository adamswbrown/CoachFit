"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface CustomCohortType {
  id: string
  label: string
  description?: string | null
  _count?: {
    Cohort: number
  }
}

export default function CustomCohortTypesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [types, setTypes] = useState<CustomCohortType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ label: "", description: "" })

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
      fetchTypes()
    }
  }, [session])

  const fetchTypes = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/custom-cohort-types")
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to load custom cohort types")
      }
      const data = await res.json()
      setTypes(data.types || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load custom cohort types")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ label: "", description: "" })
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.label.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        editingId ? `/api/admin/custom-cohort-types/${editingId}` : "/api/admin/custom-cohort-types",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: formData.label.trim(),
            description: formData.description.trim() || undefined,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to save custom cohort type")
      }
      await fetchTypes()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save custom cohort type")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (type: CustomCohortType) => {
    setEditingId(type.id)
    setFormData({
      label: type.label,
      description: type.description || "",
    })
  }

  const handleDelete = async (type: CustomCohortType) => {
    if (type._count?.Cohort && type._count.Cohort > 0) {
      setError("This type is in use. Reassign cohorts before deleting.")
      return
    }
    if (!confirm(`Delete custom cohort type "${type.label}"?`)) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/custom-cohort-types/${type.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete custom cohort type")
      }
      await fetchTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete custom cohort type")
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="p-8 text-neutral-500">Loading custom cohort types...</div>
      </CoachLayout>
    )
  }

  if (!session || !isAdmin(session.user)) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900">Custom Cohort Types</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Define custom cohort categories coaches can apply to cohorts.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? "Edit Custom Type" : "Create Custom Type"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Label</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                maxLength={80}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                maxLength={500}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-neutral-300 text-neutral-700 px-4 py-2 rounded-md hover:bg-neutral-100"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold">Existing Types</h2>
          </div>
          {types.length === 0 ? (
            <div className="p-6 text-neutral-500 text-sm">No custom cohort types yet.</div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b bg-neutral-50">
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Label</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Description</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Usage</th>
                    <th className="text-left p-2 sm:p-3 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.id} className="border-b">
                      <td className="p-2 sm:p-3 text-sm font-medium">{type.label}</td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">{type.description || "—"}</td>
                      <td className="p-2 sm:p-3 text-sm text-neutral-600">{type._count?.Cohort || 0}</td>
                      <td className="p-2 sm:p-3 text-sm">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => handleEdit(type)}
                            className="text-neutral-700 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(type)}
                            className="text-red-600 hover:underline"
                          >
                            Delete
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
      </div>
    </CoachLayout>
  )
}
