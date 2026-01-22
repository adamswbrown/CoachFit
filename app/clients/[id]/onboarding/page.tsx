"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { cmToInches, kgToLbs } from "@/lib/utils/unit-conversions"

interface OnboardingData {
  id: string
  name: string | null
  email: string
  onboardingComplete?: boolean | null
  gender: string | null
  dateOfBirth: string | null
  activityLevel: string | null
  primaryGoal: string | null
  UserGoals: {
    currentWeightKg: number | null
    targetWeightKg: number | null
    heightCm: number | null
  } | null
  UserPreference: {
    weightUnit: string | null
    measurementUnit: string | null
    dateFormat: string | null
  } | null
}

const formatActivityLevel = (value: string | null) => {
  switch (value) {
    case "sedentary":
      return "Sedentary"
    case "lightly_active":
      return "Lightly Active"
    case "active":
      return "Active"
    case "very_active":
      return "Very Active"
    case "extremely_active":
      return "Extremely Active"
    default:
      return "—"
  }
}

const formatPrimaryGoal = (value: string | null) => {
  switch (value) {
    case "lose_weight":
      return "Lose Weight"
    case "maintain_weight":
      return "Maintain Weight"
    case "gain_weight":
      return "Gain Weight"
    default:
      return "—"
  }
}

const formatSex = (value: string | null) => {
  switch (value) {
    case "male":
      return "Male"
    case "female":
      return "Female"
    case "prefer_not_to_say":
      return "Prefer not to say"
    default:
      return "—"
  }
}

export default function ClientOnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [data, setData] = useState<OnboardingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
      if (session.user.roles.includes(Role.CLIENT)) {
        router.push("/client-dashboard")
      } else {
        router.push("/login")
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (!session || !clientId) return
    const loadOnboarding = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/clients/${clientId}/onboarding`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Failed to load onboarding answers.")
        }
        const body = await res.json()
        setData(body)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load onboarding answers."
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadOnboarding()
  }, [session, clientId])

  const currentWeightLbs = data?.UserGoals?.currentWeightKg != null
    ? kgToLbs(data.UserGoals.currentWeightKg)
    : null
  const targetWeightLbs = data?.UserGoals?.targetWeightKg != null
    ? kgToLbs(data.UserGoals.targetWeightKg)
    : null
  const heightInches = data?.UserGoals?.heightCm != null
    ? cmToInches(data.UserGoals.heightCm)
    : null

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/coach-dashboard" className="text-sm text-neutral-600 hover:text-neutral-900 mb-2 inline-block">
            ← Back to Clients
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {data?.name || data?.email || "Client"}
            {data?.name && <span className="text-neutral-500 font-normal"> - {data?.email}</span>}
          </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-neutral-200 mb-6">
          <nav className="flex gap-6 overflow-x-auto">
            <Link
              href={`/clients/${clientId}`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Overview
            </Link>
            <Link
              href={`/clients/${clientId}/entries`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Entries
            </Link>
            <Link
              href={`/clients/${clientId}/weekly-review`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Weekly Review
            </Link>
            <Link
              href={`/clients/${clientId}/onboarding`}
              className="px-1 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px whitespace-nowrap"
            >
              Onboarding
            </Link>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Training
            </span>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Tasks
            </span>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Metrics
            </span>
            <Link
              href={`/clients/${clientId}/settings`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Settings
            </Link>
          </nav>
        </div>

        {loading && (
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <p className="text-sm text-neutral-500">Loading onboarding answers...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {data.onboardingComplete === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                Onboarding is not complete yet for this client.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Basics</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Sex</span>
                    <span className="font-medium text-neutral-900">{formatSex(data.gender)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Date of birth</span>
                    <span className="font-medium text-neutral-900">
                      {data.dateOfBirth ? new Date(data.dateOfBirth).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Primary goal</span>
                    <span className="font-medium text-neutral-900">{formatPrimaryGoal(data.primaryGoal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Activity level</span>
                    <span className="font-medium text-neutral-900">{formatActivityLevel(data.activityLevel)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Measurements</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Current weight</span>
                    <span className="font-medium text-neutral-900">
                      {currentWeightLbs != null ? `${currentWeightLbs.toFixed(1)} lbs` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Target weight</span>
                    <span className="font-medium text-neutral-900">
                      {targetWeightLbs != null ? `${targetWeightLbs.toFixed(1)} lbs` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Height</span>
                    <span className="font-medium text-neutral-900">
                      {heightInches != null ? `${heightInches.toFixed(1)} in` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Preferences</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-neutral-500 mb-1">Weight unit</div>
                  <div className="font-medium text-neutral-900">{data.UserPreference?.weightUnit || "—"}</div>
                </div>
                <div>
                  <div className="text-neutral-500 mb-1">Height unit</div>
                  <div className="font-medium text-neutral-900">{data.UserPreference?.measurementUnit || "—"}</div>
                </div>
                <div>
                  <div className="text-neutral-500 mb-1">Date format</div>
                  <div className="font-medium text-neutral-900">{data.UserPreference?.dateFormat || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CoachLayout>
  )
}
