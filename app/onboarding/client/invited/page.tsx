"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function ClientInvitedOnboardingPage() {
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

      // Redirect to client dashboard
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
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👋</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome, {firstName}!
            </h1>
            <p className="text-slate-600">
              You're working with a coach
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6 mb-8">
            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span className="text-emerald-600">🤝</span>
                You're All Set
              </h2>
              <p className="text-slate-700 text-sm leading-relaxed mb-4">
                Your coach has invited you to join their program. Here's what happens next:
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-emerald-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>You'll check in regularly</strong> by logging your progress (weight, steps, calories, etc.)
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-emerald-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>Your coach reviews weekly</strong> to track your progress and provide guidance
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-emerald-600 font-medium">•</span>
                  <p className="text-slate-700 text-sm">
                    <strong>You'll receive feedback</strong> to help you stay on track with your goals
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-blue-800 text-sm">
                <strong>💡 Tip:</strong> When your coach asks, complete your first check-in to get started!
              </p>
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
              className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:from-emerald-700 hover:to-blue-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Getting started...
                </span>
              ) : (
                "Complete Your First Check-In When Your Coach Asks"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
