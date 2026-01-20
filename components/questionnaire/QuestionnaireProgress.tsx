"use client"

import { useState, useEffect } from "react"
import { WEEK_LABELS, WeekNumber } from "@/lib/surveyjs-config"

interface QuestionnaireProgressProps {
  cohortId: string
  onWeekClick: (weekNumber: WeekNumber) => void
}

interface WeekStatus {
  weekNumber: WeekNumber
  status: "not_started" | "in_progress" | "completed"
  submittedAt: string | null
}

export function QuestionnaireProgress({ cohortId, onWeekClick }: QuestionnaireProgressProps) {
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatuses()
  }, [cohortId])

  const fetchStatuses = async () => {
    try {
      setLoading(true)
      const responses = await Promise.all([1, 2, 3, 4, 5].map((week) =>
        fetch(`/api/weekly-questionnaire/${cohortId}/${week}`).then((res) => res.json())
      ))

      const statuses: WeekStatus[] = responses.map((response, index) => ({
        weekNumber: (index + 1) as WeekNumber,
        status: response.status || "not_started",
        submittedAt: response.submittedAt || null,
      }))

      setWeekStatuses(statuses)
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
          className={`
            relative flex flex-col items-center justify-center
            w-16 h-16 rounded-lg border-2 transition-all
            hover:shadow-md hover:scale-105
            ${getStatusBadgeClass(weekStatus.status)}
          `}
        >
          <div className="text-xs font-medium">Week</div>
          <div className="text-lg font-bold">{weekStatus.weekNumber}</div>
          {weekStatus.status !== "not_started" && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center text-xs">
              {getStatusIcon(weekStatus.status)}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
