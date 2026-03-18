"use client"

import { useState, useEffect } from "react"

interface Milestone {
  id: string
  title: string
  description: string
  type: string
  targetValue: number
  achievedAt: string
  coachMessage: string | null
  coachName: string | null
}

interface MilestonesResponse {
  milestones: Milestone[]
}

export function MilestonesList() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMilestones() {
      try {
        const res = await fetch("/api/client/milestones")
        if (!res.ok) {
          throw new Error("Failed to load milestones")
        }
        const data: MilestonesResponse = await res.json()
        setMilestones(data.milestones)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load milestones")
      } finally {
        setLoading(false)
      }
    }
    fetchMilestones()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-5 border border-neutral-200 animate-pulse">
        <div className="h-4 bg-neutral-200 rounded w-32 mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-neutral-200 rounded" />
          <div className="h-16 bg-neutral-200 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return null
  }

  return (
    <div className="bg-white rounded-lg p-5 border border-neutral-200">
      <p className="text-xs uppercase tracking-wide text-neutral-400 mb-3">
        Milestones
      </p>

      {milestones.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Complete your first 7-day streak to earn a milestone!
        </p>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className="border border-neutral-100 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {"\uD83C\uDFC6"} {milestone.title}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {milestone.description}
                  </p>
                </div>
                <p className="text-xs text-neutral-400 whitespace-nowrap">
                  {new Date(milestone.achievedAt).toLocaleDateString()}
                </p>
              </div>

              {milestone.coachMessage && (
                <div className="mt-2 bg-blue-50 border border-blue-100 rounded p-2">
                  <p className="text-xs text-blue-800">
                    &ldquo;{milestone.coachMessage}&rdquo;
                  </p>
                  {milestone.coachName && (
                    <p className="text-xs text-blue-600 mt-0.5 font-medium">
                      &mdash; {milestone.coachName}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
