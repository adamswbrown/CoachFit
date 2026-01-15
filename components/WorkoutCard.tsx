"use client"

import React from "react"
import Link from "next/link"

interface Workout {
  id: string
  workoutType: string
  startTime: string
  durationSecs: number
  caloriesActive: number | null
  distanceMeters: number | null
  avgHeartRate: number | null
  sourceDevice: string | null
}

interface WorkoutCardProps {
  workouts: Workout[]
  clientId: string
  loading?: boolean
  compact?: boolean
}

const WORKOUT_ICONS: Record<string, string> = {
  Running: "run",
  Walking: "walk",
  Cycling: "bike",
  Swimming: "swim",
  "Strength Training": "strength",
  "High Intensity Interval Training": "hiit",
  Yoga: "yoga",
  Hiking: "hike",
  Default: "workout",
}

function getWorkoutEmoji(type: string): string {
  const icons: Record<string, string> = {
    Running: "\ud83c\udfc3",
    Walking: "\ud83d\udeb6",
    Cycling: "\ud83d\udeb4",
    Swimming: "\ud83c\udfca",
    "Strength Training": "\ud83c\udfcb\ufe0f",
    "High Intensity Interval Training": "\u26a1",
    Yoga: "\ud83e\uddd8",
    Hiking: "\ud83e\udd7e",
    Dance: "\ud83d\udc83",
    Tennis: "\ud83c\udfbe",
    Basketball: "\ud83c\udfc0",
    Soccer: "\u26bd",
    Golf: "\u26f3",
    Rowing: "\ud83d\udea3",
    Elliptical: "\ud83e\uddcd",
    StairStepper: "\ud83e\uddf1",
    TraditionalStrengthTraining: "\ud83c\udfcb\ufe0f",
    FunctionalStrengthTraining: "\ud83e\udd3c",
    Core: "\ud83e\uddcd",
    MixedCardio: "\ud83d\udcaa",
    Pilates: "\ud83e\uddd8",
    SocialDance: "\ud83d\udc83",
    Cooldown: "\u2744\ufe0f",
    MindAndBody: "\ud83e\uddd8",
  }
  return icons[type] || "\ud83c\udfc3"
}

function formatDuration(secs: number): string {
  const hours = Math.floor(secs / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

function formatDistance(meters: number | null): string {
  if (!meters) return ""
  const miles = meters / 1609.344
  return `${miles.toFixed(1)} mi`
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function WorkoutCard({ workouts, clientId, loading = false, compact = false }: WorkoutCardProps) {
  if (loading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Recent Workouts</h3>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-900">Recent Workouts</h3>
        <Link
          href={`/coach-dashboard/healthkit-data?clientId=${clientId}`}
          className="text-xs text-neutral-600 hover:text-neutral-900"
        >
          View All
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">{"\ud83c\udfcb\ufe0f"}</span>
          </div>
          <p className="text-sm text-neutral-500">No workout data yet</p>
          <p className="text-xs text-neutral-400 mt-1">
            HealthKit sync will populate workout history
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.slice(0, compact ? 3 : 5).map((workout) => (
            <div
              key={workout.id}
              className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg"
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">{getWorkoutEmoji(workout.workoutType)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-900 text-sm truncate">
                  {workout.workoutType}
                </div>
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  <span>{formatDate(workout.startTime)}</span>
                  <span className="text-neutral-300">|</span>
                  <span>{formatDuration(workout.durationSecs)}</span>
                  {workout.distanceMeters && (
                    <>
                      <span className="text-neutral-300">|</span>
                      <span>{formatDistance(workout.distanceMeters)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {workout.caloriesActive && (
                  <div className="text-sm font-medium text-orange-600">
                    {workout.caloriesActive} cal
                  </div>
                )}
                {workout.avgHeartRate && (
                  <div className="text-xs text-red-500">
                    {workout.avgHeartRate} bpm
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WorkoutCard
