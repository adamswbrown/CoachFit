"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { SystemIcon, CheckmarkIcon } from "@/components/icons"

export default function AdminOnboardingPage() {
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

      // Redirect to admin dashboard
      router.push("/admin")
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.")
      setIsCompleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <SystemIcon size={32} className="text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome to CoachSync Admin
            </h1>
            <p className="text-slate-600">
              You manage coaches and programs
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6 mb-8">
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CheckmarkIcon size={20} className="text-blue-600" />
                Your Role
              </h2>
              <p className="text-slate-700 text-sm leading-relaxed">
                As an administrator, you're in control of the CoachSync platform. You create and manage coaches who then work with clients to achieve their fitness goals.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Create Coaches</h3>
                  <p className="text-slate-600 text-sm">
                    Add coaches to the system. They'll receive credentials and can start managing their programs.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">Coaches Manage Clients</h3>
                  <p className="text-slate-600 text-sm">
                    Coaches invite clients to their cohorts and guide them through their fitness journey.
                  </p>
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
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Completing...
                </span>
              ) : (
                "Create Your First Coach"
              )}
            </button>
            <Link
              href="/admin"
              className="text-center text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Or go to admin dashboard →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
