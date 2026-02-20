"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function CoachOnboardingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isCompleting, setIsCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasClients, setHasClients] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if coach already has cohorts with clients
    const checkClients = async () => {
      try {
        const res = await fetch("/api/cohorts")
        if (res.ok) {
          const cohorts = await res.json()
          // Check if any cohort has clients
          const hasAnyClients = Array.isArray(cohorts) && cohorts.some((c: any) => c.clientCount && c.clientCount > 0)
          setHasClients(hasAnyClients)
        } else {
          setHasClients(false)
        }
      } catch (err) {
        console.error("Error checking clients:", err)
        setHasClients(false)
      }
    }

    if (session) {
      checkClients()
    }
  }, [session])

  const handleComplete = async () => {
    setIsCompleting(true)
    setError(null)

    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
      })

      if (!res.ok) {
        throw new Error("Failed to complete onboarding")
      }

      // Redirect to coach dashboard
      router.push("/coach-dashboard")
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
      setIsCompleting(false)
    }
  }

  const coachName = session?.user?.name?.split(" ")[0] || "Coach"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-start sm:items-center justify-center px-4 py-6 sm:py-8 overflow-y-auto">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👋</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome, {coachName}!
            </h1>
            <p className="text-slate-600">
              You've been added as a coach
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6 mb-8">
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-blue-600">🎯</span>
                How CoachSync Works
              </h2>
              <p className="text-slate-700 text-sm leading-relaxed mb-4">
                You're now part of the CoachSync platform. Here's how it works:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>Clients check in</strong> regularly with their progress data
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>You review weekly</strong> to track their progress and provide guidance
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>You guide progress</strong> through notes, adjustments, and personalized feedback
                  </p>
                </div>
              </div>
            </div>

            {/* Name confirmation if missing */}
            {!session?.user?.name && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> Consider updating your name in your profile settings so clients can identify you.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Getting started...
                </span>
              ) : hasClients ? (
                "Review Your Clients"
              ) : (
                "Add Your First Client"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
