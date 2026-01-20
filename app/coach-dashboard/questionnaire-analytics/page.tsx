"use client"

import { useState, useEffect } from "react"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface Cohort {
  id: string
  name: string
}

interface QuestionnaireResponse {
  userId: string
  userName: string | null
  userEmail: string
  responseJson: any
  status: string
  submittedAt: string | null
  updatedAt: string
}

interface ResponseStats {
  total: number
  completed: number
  inProgress: number
  notStarted: number
}

export default function QuestionnaireAnalyticsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [selectedCohortId, setSelectedCohortId] = useState<string>("")
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([])
  const [stats, setStats] = useState<ResponseStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [cohortName, setCohortName] = useState<string>("")
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderToast, setReminderToast] = useState<string | null>(null)

  useEffect(() => {
    fetchCohorts()
  }, [])

  useEffect(() => {
    if (selectedCohortId && selectedWeek) {
      fetchResponses()
    }
  }, [selectedCohortId, selectedWeek])

  const fetchCohorts = async () => {
    try {
      const res = await fetch("/api/cohorts")
      if (res.ok) {
        const data = await res.json()
        setCohorts(data)
        if (data.length > 0) {
          setSelectedCohortId(data[0].id)
        }
      }
    } catch (err) {
      console.error("Error fetching cohorts:", err)
    }
  }

  const fetchResponses = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/coach/weekly-questionnaire-responses/${selectedCohortId}/${selectedWeek}`
      )
      if (res.ok) {
        const data = await res.json()
        setResponses(data.responses || [])
        setStats(data.stats || null)
        setCohortName(data.cohortName || "")
      }
    } catch (err) {
      console.error("Error fetching responses:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendReminder = async () => {
    if (!selectedCohortId || !selectedWeek) return

    setSendingReminder(true)
    try {
      const res = await fetch('/api/coach-dashboard/send-questionnaire-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cohortId: selectedCohortId,
          weekNumber: selectedWeek,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setReminderToast(`✓ Sent reminder to ${data.sent} client(s)`)
        setTimeout(() => setReminderToast(null), 3000)
      } else {
        const error = await res.json()
        setReminderToast(`✗ ${error.error || 'Failed to send reminders'}`)
        setTimeout(() => setReminderToast(null), 3000)
      }
    } catch (err) {
      console.error('Error sending reminders:', err)
      setReminderToast('✗ Failed to send reminders')
      setTimeout(() => setReminderToast(null), 3000)
    } finally {
      setSendingReminder(false)
    }
  }

  // Simple analytics: count responses by question
  const getQuestionStats = () => {
    if (!responses || responses.length === 0) return []

    const questionStats: Record<string, Record<string, number>> = {}

    responses.forEach((response) => {
      if (response.responseJson && typeof response.responseJson === "object") {
        Object.entries(response.responseJson).forEach(([key, value]) => {
          if (!questionStats[key]) {
            questionStats[key] = {}
          }

          const valueStr = String(value)
          if (!questionStats[key][valueStr]) {
            questionStats[key][valueStr] = 0
          }
          questionStats[key][valueStr] += 1
        })
      }
    })

    return Object.entries(questionStats).map(([question, values]) => ({
      question,
      values,
    }))
  }

  const questionStats = getQuestionStats()

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast Notification */}
        {reminderToast && (
          <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
            {reminderToast}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">
            Questionnaire Analytics
          </h1>
          <p className="text-neutral-600 mt-2">
            View aggregated responses from your clients' weekly questionnaires
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cohort Selector */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select Cohort
              </label>
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Week Selector */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select Week
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                {[1, 2, 3, 4, 5].map((week) => (
                  <option key={week} value={week}>
                    Week {week}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Send Reminder Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSendReminder}
              disabled={sendingReminder || !selectedCohortId}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sendingReminder ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  📧 Send Reminder Email
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading responses...</p>
          </div>
        )}

        {/* Stats Summary */}
        {!loading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="text-sm text-green-700 font-medium mb-1">
                Completed
              </div>
              <div className="text-3xl font-bold text-green-900">
                {stats.completed}
              </div>
              <div className="text-xs text-green-600 mt-1">
                {stats.total > 0
                  ? Math.round((stats.completed / stats.total) * 100)
                  : 0}
                % of total
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <div className="text-sm text-amber-700 font-medium mb-1">
                In Progress
              </div>
              <div className="text-3xl font-bold text-amber-900">
                {stats.inProgress}
              </div>
              <div className="text-xs text-amber-600 mt-1">
                {stats.total > 0
                  ? Math.round((stats.inProgress / stats.total) * 100)
                  : 0}
                % of total
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6">
              <div className="text-sm text-neutral-700 font-medium mb-1">
                Total Responses
              </div>
              <div className="text-3xl font-bold text-neutral-900">
                {stats.total}
              </div>
              <div className="text-xs text-neutral-600 mt-1">
                {cohortName}
              </div>
            </div>
          </div>
        )}

        {/* Question Stats */}
        {!loading && questionStats.length > 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-6">
              Response Breakdown by Question
            </h2>

            <div className="space-y-8">
              {questionStats.map(({ question, values }) => {
                const totalResponses = Object.values(values).reduce(
                  (sum, count) => sum + count,
                  0
                )

                return (
                  <div key={question} className="border-b border-neutral-200 pb-6 last:border-b-0">
                    <h3 className="text-lg font-medium text-neutral-900 mb-4">
                      {question.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h3>

                    <div className="space-y-2">
                      {Object.entries(values)
                        .sort(([, a], [, b]) => b - a)
                        .map(([value, count]) => {
                          const percentage = Math.round((count / totalResponses) * 100)
                          
                          return (
                            <div key={value} className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-neutral-700 font-medium">
                                    {value.length > 100 ? `${value.substring(0, 100)}...` : value}
                                  </span>
                                  <span className="text-sm text-neutral-600 ml-4 whitespace-nowrap">
                                    {count} ({percentage}%)
                                  </span>
                                </div>
                                <div className="w-full bg-neutral-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && responses.length === 0 && selectedCohortId && (
          <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
            <p className="text-neutral-600">
              No responses yet for Week {selectedWeek} in this cohort.
            </p>
          </div>
        )}

        {/* No Cohorts */}
        {!loading && cohorts.length === 0 && (
          <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
            <p className="text-neutral-600">
              You don't have any cohorts yet. Create a cohort to start collecting questionnaire responses.
            </p>
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
