"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function ClientSelfSignupOnboardingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isCompleting, setIsCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      // Redirect to client dashboard (which will show the "waiting for coach" state)
      router.push("/client-dashboard")
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
      setIsCompleting(false)
    }
  }

  const firstName = session?.user?.name?.split(" ")[0] || "there"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👋</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome, {firstName}!
            </h1>
            <p className="text-slate-600">
              CoachSync works best with a coach
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6 mb-8">
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-blue-600">💡</span>
                How CoachSync Works
              </h2>
              <p className="text-slate-700 text-sm leading-relaxed mb-4">
                CoachSync is designed for coach-guided fitness programs. Here's how it works:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>Coaches guide your plans</strong> and create personalized programs for you
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>You check in regularly</strong> to track your progress (weight, steps, calories, etc.)
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>Your coach reviews and provides feedback</strong> to help you reach your goals
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
              <h3 className="font-semibold text-amber-900 mb-2">Next Steps</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-amber-600 font-medium">✓</span>
                  <div>
                    <p className="text-amber-900 text-sm font-medium mb-1">
                      I already have a coach
                    </p>
                    <p className="text-amber-800 text-xs">
                      Your coach will add you to their cohort soon. You'll receive a notification when they do.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-amber-600 font-medium">✓</span>
                  <div>
                    <p className="text-amber-900 text-sm font-medium mb-1">
                      I don't have a coach yet
                    </p>
                    <p className="text-amber-800 text-xs">
                      When you're assigned to a coach, you'll be able to start tracking your progress. You'll see a notification when this happens.
                    </p>
                  </div>
                </div>
              </div>
            </div>
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
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-3 rounded-xl font-medium hover:from-amber-700 hover:to-orange-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Getting started...
                </span>
              ) : (
                "Continue to Dashboard"
              )}
            </button>
            <p className="text-center text-xs text-slate-500">
              Your dashboard will show when your coach adds you
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
