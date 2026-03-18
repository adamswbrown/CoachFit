"use client"

import { useState, useEffect } from "react"
import { WEEK_LABELS, WeekNumber } from "@/lib/surveyjs-config"

interface QuestionnaireProgressProps {
  cohortId: string
  cohortStartDate: string | null
  onWeekClick: (weekNumber: WeekNumber) => void
}

interface WeekStatus {
  weekNumber: WeekNumber
  status: "not_started" | "in_progress" | "completed" | "locked"
  submittedAt: string | null
}

export function QuestionnaireProgress({ cohortId, cohortStartDate, onWeekClick }: QuestionnaireProgressProps) {
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatuses()
  }, [cohortId, cohortStartDate])

  const getCurrentWeek = () => {
    if (!cohortStartDate) return 0
    const start = new Date(cohortStartDate)
    const today = new Date()
    start.setUTCHours(0, 0, 0, 0)
    today.setUTCHours(0, 0, 0, 0)
    const diffMs = today.getTime() - start.getTime()
    if (diffMs < 0) return 0
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    return Math.min(5, Math.floor(diffDays / 7) + 1)
  }

  const fetchStatuses = async () => {
    try {
      setLoading(true)
      const currentWeek = getCurrentWeek()
      const baseStatuses: WeekStatus[] = [1, 2, 3, 4, 5].map((week) => ({
        weekNumber: week as WeekNumber,
        status: week <= currentWeek ? "not_started" : "locked",
        submittedAt: null,
      }))

      if (currentWeek < 1) {
        setWeekStatuses(baseStatuses)
        return
      }

      const responses = await Promise.all(
        [1, 2, 3, 4, 5]
          .filter((week) => week <= currentWeek)
          .map(async (week) => {
            const res = await fetch(`/api/weekly-questionnaire/${cohortId}/${week}`)
            if (!res.ok) {
              return { weekNumber: week, status: "not_started", submittedAt: null }
            }
            const data = await res.json()
            return {
              weekNumber: week,
              status: data.status || "not_started",
              submittedAt: data.submittedAt || null,
            }
          })
      )

      const statuses = baseStatuses.map((status) => {
        const match = responses.find((response) => response.weekNumber === status.weekNumber)
        return match ? { ...status, status: match.status, submittedAt: match.submittedAt } : status
      })

      setWeekStatuses(statuses as WeekStatus[])
    } catch (error) {
      console.error("Error fetching questionnaire statuses:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-300"
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "locked":
        return "bg-gray-50 text-gray-400 border-gray-200"
      default:
        return "bg-gray-100 text-gray-600 border-gray-300"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "✓"
      case "in_progress":
        return "⋯"
      default:
        return ""
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((week) => (
          <div
            key={week}
            className="w-16 h-16 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {weekStatuses.map((weekStatus) => (
        <button
          key={weekStatus.weekNumber}
          onClick={() => onWeekClick(weekStatus.weekNumber)}
          disabled={weekStatus.status === "locked"}
          className={`
            relative flex flex-col items-center justify-center
            w-16 h-16 rounded-lg border-2 transition-all
            hover:shadow-md hover:scale-105
            ${weekStatus.status === "locked" ? "cursor-not-allowed opacity-60 hover:shadow-none hover:scale-100" : ""}
            ${getStatusBadgeClass(weekStatus.status)}
          `}
        >
          <div className="text-xs font-medium">Week</div>
          <div className="text-lg font-bold">{weekStatus.weekNumber}</div>
          {weekStatus.status !== "not_started" && weekStatus.status !== "locked" && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center text-xs">
              {getStatusIcon(weekStatus.status)}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
