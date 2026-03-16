"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { isAdminOrCoach } from "@/lib/permissions"

interface GymMember {
  id: string
  email: string
  name: string | null
  joinedAt: string
  onboardingComplete: boolean
  cohort: { id: string; name: string } | null
  lastEntryDate: string | null
  lastWeight: number | null
  entriesLast7Days: number
}

export default function GymMembersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [members, setMembers] = useState<GymMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "lastActivity" | "joined">("lastActivity")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (!session?.user || !isAdminOrCoach(session.user)) return

    const loadMembers = async () => {
      try {
        const res = await fetch("/api/coach-dashboard/members")
        if (!res.ok) throw new Error("Failed to load members")
        const data = await res.json()
        setMembers(data.members)
      } catch (err) {
        setError("Failed to load gym members")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadMembers()
  }, [session])

  const filteredMembers = members
    .filter((m) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (m.name?.toLowerCase().includes(q)) ||
        m.email.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || a.email).localeCompare(b.name || b.email)
      }
      if (sortBy === "lastActivity") {
        const aDate = a.lastEntryDate ? new Date(a.lastEntryDate).getTime() : 0
        const bDate = b.lastEntryDate ? new Date(b.lastEntryDate).getTime() : 0
        return bDate - aDate
      }
      // joined
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="p-6 text-neutral-500">Loading members...</div>
      </CoachLayout>
    )
  }

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Gym Members</h1>
            <p className="text-sm text-neutral-600 mt-1">
              All members — {filteredMembers.length} total
            </p>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-neutral-200 rounded-lg text-sm bg-white"
          >
            <option value="lastActivity">Last active</option>
            <option value="name">Name</option>
            <option value="joined">Joined</option>
          </select>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Members List */}
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          {filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-sm">
              {search ? "No members match your search." : "No gym members found."}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {filteredMembers.map((member) => (
                <Link
                  key={member.id}
                  href={`/clients/${member.id}`}
                  className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-neutral-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold text-neutral-600 flex-shrink-0">
                    {(member.name || member.email).substring(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-neutral-900 text-sm truncate">
                        {member.name || member.email}
                      </p>
                      {member.cohort && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">
                          {member.cohort.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 truncate">{member.email}</p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 text-sm flex-shrink-0">
                    <div className="text-right">
                      <p className="text-neutral-400 text-xs">Last check-in</p>
                      <p className={`font-medium ${member.lastEntryDate ? "text-neutral-900" : "text-neutral-400"}`}>
                        {formatDate(member.lastEntryDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-neutral-400 text-xs">7-day entries</p>
                      <p className={`font-medium ${member.entriesLast7Days > 0 ? "text-neutral-900" : "text-neutral-400"}`}>
                        {member.entriesLast7Days}
                      </p>
                    </div>
                    {member.lastWeight && (
                      <div className="text-right">
                        <p className="text-neutral-400 text-xs">Weight</p>
                        <p className="font-medium text-neutral-900">{member.lastWeight} lbs</p>
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <svg className="w-5 h-5 text-neutral-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </CoachLayout>
  )
}
