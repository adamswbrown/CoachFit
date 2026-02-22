"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"

type ClassTemplateRow = {
  id: string
  name: string
  classType: string
  locationLabel: string
  capacity: number
  waitlistEnabled: boolean
  waitlistCapacity: number
  creditsRequired: number
  isActive: boolean
  ownerCoach?: { id: string; name: string | null; email: string }
  cohort?: { id: string; name: string } | null
  _count?: { sessions: number }
}

type SessionRow = {
  id: string
  startsAt: string
  endsAt: string
  status: string
  classTemplate: {
    id: string
    name: string
    classType: string
    locationLabel: string
  }
  instructor?: { id: string; name: string | null; email: string } | null
  _count?: { bookings: number }
}

const defaultTemplateForm = {
  name: "",
  classType: "HIIT",
  locationLabel: "Hitsona Bangor",
  capacity: 20,
  waitlistEnabled: true,
  waitlistCapacity: 10,
  bookingOpenHoursBefore: 336,
  bookingCloseMinutesBefore: 0,
  cancelCutoffMinutes: 60,
  creditsRequired: 1,
}

export default function CoachClassesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<ClassTemplateRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [templateForm, setTemplateForm] = useState(defaultTemplateForm)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return

    if (!isAdminOrCoach(session.user)) {
      if (session.user.roles.includes(Role.CLIENT)) {
        router.push("/client-dashboard")
      } else {
        router.push("/login")
      }
      return
    }

    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const from = new Date().toISOString()
      const to = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString()
      const [templatesRes, sessionsRes] = await Promise.all([
        fetch("/api/classes"),
        fetch(`/api/classes/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      ])

      if (!templatesRes.ok || !sessionsRes.ok) {
        throw new Error("Failed to load classes")
      }

      const templatesJson = await templatesRes.json()
      const sessionsJson = await sessionsRes.json()

      setTemplates(templatesJson.templates || [])
      setSessions(sessionsJson.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classes")
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateForm),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create template")
      }

      setTemplateForm(defaultTemplateForm)
      setShowCreate(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template")
    } finally {
      setCreating(false)
    }
  }

  const upcomingSessionCount = useMemo(
    () => sessions.filter((s) => new Date(s.startsAt).getTime() > Date.now()).length,
    [sessions],
  )

  if (loading) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto py-8">Loading classes...</div>
      </CoachLayout>
    )
  }

  if (!session?.user || !isAdminOrCoach(session.user)) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Classes</h1>
            <p className="text-sm text-neutral-600 mt-1">
              {templates.length} templates, {upcomingSessionCount} upcoming sessions
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/coach-dashboard/classes/credits"
              className="px-3 py-2 text-sm rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
            >
              Credits
            </Link>
            <button
              onClick={() => setShowCreate((prev) => !prev)}
              className="px-3 py-2 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {showCreate ? "Close" : "New Template"}
            </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="px-3 py-2 text-sm rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        )}

        {showCreate && (
          <form onSubmit={handleCreateTemplate} className="bg-white border border-neutral-200 rounded-lg p-4 grid gap-3">
            <h2 className="text-base font-semibold text-neutral-900">Create Class Template</h2>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={templateForm.name}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Class name"
                className="px-3 py-2 border border-neutral-300 rounded-md"
                required
              />
              <select
                value={templateForm.classType}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, classType: e.target.value }))}
                className="px-3 py-2 border border-neutral-300 rounded-md"
              >
                <option value="HIIT">HIIT</option>
                <option value="CORE">CORE</option>
                <option value="STRENGTH">STRENGTH</option>
              </select>
              <input
                value={templateForm.locationLabel}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, locationLabel: e.target.value }))}
                placeholder="Location"
                className="px-3 py-2 border border-neutral-300 rounded-md"
                required
              />
            </div>
            <div className="grid md:grid-cols-5 gap-3">
              <input
                type="number"
                min={1}
                value={templateForm.capacity}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, capacity: Number(e.target.value) || 1 }))}
                placeholder="Capacity"
                className="px-3 py-2 border border-neutral-300 rounded-md"
              />
              <input
                type="number"
                min={0}
                value={templateForm.waitlistCapacity}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, waitlistCapacity: Number(e.target.value) || 0 }))}
                placeholder="Waitlist cap"
                className="px-3 py-2 border border-neutral-300 rounded-md"
              />
              <input
                type="number"
                min={0}
                value={templateForm.bookingOpenHoursBefore}
                onChange={(e) =>
                  setTemplateForm((prev) => ({ ...prev, bookingOpenHoursBefore: Number(e.target.value) || 0 }))
                }
                placeholder="Open hours"
                className="px-3 py-2 border border-neutral-300 rounded-md"
              />
              <input
                type="number"
                min={0}
                value={templateForm.cancelCutoffMinutes}
                onChange={(e) =>
                  setTemplateForm((prev) => ({ ...prev, cancelCutoffMinutes: Number(e.target.value) || 0 }))
                }
                placeholder="Late cancel cutoff"
                className="px-3 py-2 border border-neutral-300 rounded-md"
              />
              <input
                type="number"
                min={0}
                value={templateForm.creditsRequired}
                onChange={(e) =>
                  setTemplateForm((prev) => ({ ...prev, creditsRequired: Number(e.target.value) || 0 }))
                }
                placeholder="Credits required"
                className="px-3 py-2 border border-neutral-300 rounded-md"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={templateForm.waitlistEnabled}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, waitlistEnabled: e.target.checked }))}
              />
              Enable waitlist
            </label>
            <div>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm hover:bg-neutral-800 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Template"}
              </button>
            </div>
          </form>
        )}

        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">Template Library</h2>
          </div>
          {templates.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600">No templates yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-2">Template</th>
                    <th className="px-4 py-2">Location</th>
                    <th className="px-4 py-2">Capacity</th>
                    <th className="px-4 py-2">Upcoming</th>
                    <th className="px-4 py-2">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-t border-neutral-100">
                      <td className="px-4 py-3">
                        <Link
                          href={`/coach-dashboard/classes/${template.id}`}
                          className="text-neutral-900 font-medium hover:underline"
                        >
                          {template.name}
                        </Link>
                        <div className="text-xs text-neutral-500">{template.classType}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{template.locationLabel}</td>
                      <td className="px-4 py-3 text-neutral-700">{template.capacity}</td>
                      <td className="px-4 py-3 text-neutral-700">{template._count?.sessions ?? 0}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {template.ownerCoach?.name || template.ownerCoach?.email || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Upcoming Sessions (28 days)</h2>
          </div>
          {sessions.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600">No upcoming sessions.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Class</th>
                    <th className="px-4 py-2">Instructor</th>
                    <th className="px-4 py-2">Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sessionRow) => (
                    <tr key={sessionRow.id} className="border-t border-neutral-100">
                      <td className="px-4 py-3 text-neutral-700">
                        {new Date(sessionRow.startsAt).toLocaleString("en-GB", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </td>
                      <td className="px-4 py-3 text-neutral-900">
                        {sessionRow.classTemplate.name}
                        <div className="text-xs text-neutral-500">{sessionRow.classTemplate.locationLabel}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {sessionRow.instructor?.name || sessionRow.instructor?.email || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{sessionRow._count?.bookings ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </CoachLayout>
  )
}
