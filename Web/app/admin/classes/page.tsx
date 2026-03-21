"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface ClassSession {
  id: string
  startsAt: string
  endsAt: string
  status: string
  capacityOverride: number | null
  classTemplate: {
    name: string
    classType: string
    capacity: number
  }
  instructor: {
    id: string
    name: string | null
  } | null
  spotsRemaining: number
  _count?: { bookings: number }
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export default function AdminClassSchedulePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    else if (session?.user && !isAdmin(session.user)) router.push("/dashboard")
  }, [status, session, router])

  useEffect(() => {
    if (!session) return
    const fetchSchedule = async () => {
      setLoading(true)
      try {
        // Fetch each day of the week
        const allSessions: ClassSession[] = []
        for (let i = 0; i < 7; i++) {
          const day = new Date(weekStart)
          day.setDate(day.getDate() + i)
          const res = await fetch(`/api/classes/schedule?date=${formatDate(day)}`)
          if (res.ok) {
            const data = await res.json()
            allSessions.push(...(data.sessions || []))
          }
        }
        setSessions(allSessions)
      } catch (err) {
        console.error("Failed to load schedule:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSchedule()
  }, [session, weekStart])

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  const goToday = () => setWeekStart(getMonday(new Date()))

  // Group sessions by day
  const sessionsByDay = useMemo(() => {
    const grouped: Record<number, ClassSession[]> = {}
    for (let i = 0; i < 7; i++) grouped[i] = []

    for (const s of sessions) {
      const d = new Date(s.startsAt)
      const dayOfWeek = d.getDay()
      const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Mon=0, Sun=6
      if (grouped[idx]) grouped[idx].push(s)
    }

    // Sort each day by time
    for (const day of Object.keys(grouped)) {
      grouped[Number(day)].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    }

    return grouped
  }, [sessions])

  const today = new Date()
  const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const isCurrentWeek = getMonday(new Date()).getTime() === weekStart.getTime()

  if (status === "loading") {
    return <CoachLayout><div className="animate-pulse p-8"><div className="h-8 w-48 bg-neutral-200 rounded mb-6" /></div></CoachLayout>
  }

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Class Schedule</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={prevWeek} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50">← Prev</button>
            {!isCurrentWeek && (
              <button onClick={goToday} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50">Today</button>
            )}
            <button onClick={nextWeek} className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50">Next →</button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-lg p-3 animate-pulse">
                <div className="h-5 w-12 bg-neutral-200 rounded mb-3" />
                <div className="space-y-2">
                  <div className="h-16 bg-neutral-100 rounded" />
                  <div className="h-16 bg-neutral-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {DAY_LABELS.map((day, idx) => {
              const dayDate = new Date(weekStart)
              dayDate.setDate(dayDate.getDate() + idx)
              const isToday = isCurrentWeek && idx === todayIdx
              const daySessions = sessionsByDay[idx] || []

              return (
                <div
                  key={idx}
                  className={`bg-white border rounded-lg p-3 min-h-[200px] ${
                    isToday ? "border-blue-300 bg-blue-50/30" : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold uppercase ${isToday ? "text-blue-600" : "text-neutral-500"}`}>
                      {day}
                    </span>
                    <span className={`text-xs ${isToday ? "text-blue-600 font-medium" : "text-neutral-400"}`}>
                      {dayDate.getDate()}
                    </span>
                  </div>

                  {daySessions.length === 0 ? (
                    <p className="text-xs text-neutral-300 text-center mt-8">No classes</p>
                  ) : (
                    <div className="space-y-2">
                      {daySessions.map((s) => {
                        const time = new Date(s.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                        const capacity = s.capacityOverride || s.classTemplate.capacity
                        const booked = capacity - s.spotsRemaining
                        const isFull = s.spotsRemaining <= 0
                        const isPast = new Date(s.endsAt) < new Date()
                        const isCancelled = s.status === "CANCELLED"

                        return (
                          <div
                            key={s.id}
                            className={`rounded-md p-2 text-xs ${
                              isCancelled
                                ? "bg-neutral-100 text-neutral-400 line-through"
                                : isPast
                                ? "bg-neutral-50 text-neutral-500"
                                : isFull
                                ? "bg-amber-50 border border-amber-200"
                                : "bg-neutral-50"
                            }`}
                          >
                            <div className="font-medium">{time}</div>
                            <div className="mt-0.5">{s.classTemplate.name}</div>
                            {s.instructor?.name && (
                              <div className="text-neutral-400 mt-0.5">{s.instructor.name}</div>
                            )}
                            <div className={`mt-1 ${isFull ? "text-amber-700 font-medium" : ""}`}>
                              {booked}/{capacity}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
