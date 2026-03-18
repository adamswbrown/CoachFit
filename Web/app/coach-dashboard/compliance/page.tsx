"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { Role } from "@/lib/types"

interface ClientStreak {
  clientId: string
  clientName: string
  clientEmail: string
  cohortName: string
  currentStreak: number
  longestStreak: number
  lastCheckInDate: string | null
  daysSinceLastCheckIn: number
  status: "green" | "amber" | "red" | "never"
}

interface ClientStreaksResponse {
  clients: ClientStreak[]
}

const STATUS_CONFIG = {
  green: {
    label: "Active",
    bg: "bg-[#4CAF50]",
    text: "text-white",
    cardBg: "bg-green-50",
    cardBorder: "border-green-200",
    cardText: "text-green-800",
    cardValue: "text-green-900",
  },
  amber: {
    label: "1 day missed",
    bg: "bg-[#FF9800]",
    text: "text-white",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-200",
    cardText: "text-orange-800",
    cardValue: "text-orange-900",
  },
  red: {
    label: "At risk",
    bg: "bg-[#F44336]",
    text: "text-white",
    cardBg: "bg-red-50",
    cardBorder: "border-red-200",
    cardText: "text-red-800",
    cardValue: "text-red-900",
  },
  never: {
    label: "Never checked in",
    bg: "bg-neutral-400",
    text: "text-white",
    cardBg: "bg-neutral-50",
    cardBorder: "border-neutral-200",
    cardText: "text-neutral-600",
    cardValue: "text-neutral-800",
  },
}

const STATUS_SORT_ORDER: Record<string, number> = {
  red: 0,
  amber: 1,
  green: 2,
  never: 3,
}

export default function CompliancePage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<ClientStreak[]>([])

  useEffect(() => {
    if (!session?.user?.id) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch("/api/coach-dashboard/client-streaks")
        if (!res.ok) {
          throw new Error(`Failed to fetch client streaks: ${res.status}`)
        }
        const data: ClientStreaksResponse = await res.json()
        setClients(data.clients ?? [])
      } catch (err) {
        console.error("Error fetching client streaks:", err)
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session?.user?.id])

  const sortedClients = [...clients].sort((a, b) => {
    const aOrder = STATUS_SORT_ORDER[a.status] ?? 4
    const bOrder = STATUS_SORT_ORDER[b.status] ?? 4
    if (aOrder !== bOrder) return aOrder - bOrder
    return (a.clientName ?? "").localeCompare(b.clientName ?? "")
  })

  const totalClients = clients.length
  const greenCount = clients.filter((c) => c.status === "green").length
  const amberCount = clients.filter((c) => c.status === "amber").length
  const redCount = clients.filter((c) => c.status === "red").length

  const handleSendEncouragement = (client: ClientStreak) => {
    alert(`Encouragement would be sent to ${client.clientName} (${client.clientEmail})`)
  }

  if (!session?.user?.roles?.includes(Role.COACH) && !session?.user?.roles?.includes(Role.ADMIN)) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <p className="text-neutral-600">You do not have permission to view this page.</p>
        </div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Client Compliance</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Track client check-in streaks and identify those who need attention.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-neutral-600">Loading compliance data...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total clients */}
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <p className="text-sm font-medium text-neutral-500">Total Clients</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{totalClients}</p>
              </div>

              {/* Checked in today (green) */}
              <div className={`rounded-lg p-4 border ${STATUS_CONFIG.green.cardBorder} ${STATUS_CONFIG.green.cardBg}`}>
                <p className={`text-sm font-medium ${STATUS_CONFIG.green.cardText}`}>Checked In Today</p>
                <p className={`text-2xl font-bold mt-1 ${STATUS_CONFIG.green.cardValue}`}>{greenCount}</p>
              </div>

              {/* Missed yesterday (amber) */}
              <div className={`rounded-lg p-4 border ${STATUS_CONFIG.amber.cardBorder} ${STATUS_CONFIG.amber.cardBg}`}>
                <p className={`text-sm font-medium ${STATUS_CONFIG.amber.cardText}`}>Missed Yesterday</p>
                <p className={`text-2xl font-bold mt-1 ${STATUS_CONFIG.amber.cardValue}`}>{amberCount}</p>
              </div>

              {/* Missed 2+ days (red) */}
              <div className={`rounded-lg p-4 border ${STATUS_CONFIG.red.cardBorder} ${STATUS_CONFIG.red.cardBg}`}>
                <p className={`text-sm font-medium ${STATUS_CONFIG.red.cardText}`}>Missed 2+ Days</p>
                <p className={`text-2xl font-bold mt-1 ${STATUS_CONFIG.red.cardValue}`}>{redCount}</p>
              </div>
            </div>

            {/* Client table */}
            {sortedClients.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center">
                <p className="text-neutral-500">No clients found. Invite clients to get started.</p>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <th className="text-left px-4 py-3 font-medium text-neutral-600">Client</th>
                        <th className="text-left px-4 py-3 font-medium text-neutral-600">Cohort</th>
                        <th className="text-left px-4 py-3 font-medium text-neutral-600">Streak</th>
                        <th className="text-left px-4 py-3 font-medium text-neutral-600">Days Since Check-in</th>
                        <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-neutral-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedClients.map((client) => {
                        const config = STATUS_CONFIG[client.status]
                        return (
                          <tr
                            key={client.clientId}
                            className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-neutral-900">{client.clientName}</p>
                                <p className="text-xs text-neutral-500">{client.clientEmail}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {client.cohortName || <span className="text-neutral-400">Unassigned</span>}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {client.currentStreak > 0 ? (
                                <span className="font-medium">
                                  {client.currentStreak} day{client.currentStreak !== 1 ? "s" : ""} 🔥
                                </span>
                              ) : (
                                <span className="text-neutral-400">0 days</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {client.status === "never" ? (
                                <span className="text-neutral-400">Never</span>
                              ) : (
                                <span>{client.daysSinceLastCheckIn} day{client.daysSinceLastCheckIn !== 1 ? "s" : ""}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
                              >
                                {config.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleSendEncouragement(client)}
                                className="text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Send Encouragement
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-neutral-100">
                  {sortedClients.map((client) => {
                    const config = STATUS_CONFIG[client.status]
                    return (
                      <div key={client.clientId} className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-neutral-900">{client.clientName}</p>
                            <p className="text-xs text-neutral-500">{client.cohortName || "Unassigned"}</p>
                          </div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
                          >
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-neutral-600">
                          <span>
                            Streak:{" "}
                            {client.currentStreak > 0 ? (
                              <span className="font-medium text-neutral-900">
                                {client.currentStreak} 🔥
                              </span>
                            ) : (
                              "0"
                            )}
                          </span>
                          <span>
                            Last check-in:{" "}
                            {client.status === "never"
                              ? "Never"
                              : `${client.daysSinceLastCheckIn}d ago`}
                          </span>
                        </div>
                        <button
                          onClick={() => handleSendEncouragement(client)}
                          className="w-full text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-md transition-colors"
                        >
                          Send Encouragement
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CoachLayout>
  )
}
