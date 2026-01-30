"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { isClient } from "@/lib/permissions"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { WrappedCarousel } from "@/components/wrapped/WrappedCarousel"
import type { WrappedSummary } from "@/lib/types"

/**
 * Dedicated Fitness Wrapped Page
 * Accessible via direct link: /client-dashboard/wrapped
 * Shows full wrapped experience for clients who completed 6 or 8 week challenges
 */
export default function WrappedPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [wrappedData, setWrappedData] = useState<WrappedSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status === "authenticated" && !isClient(session.user)) {
      router.push("/dashboard")
      return
    }

    if (status === "authenticated") {
      fetchWrapped()
    }
  }, [status, session, router])

  async function fetchWrapped() {
    try {
      const response = await fetchWithRetry("/api/client/wrapped")
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Fitness Wrapped not available")
        setLoading(false)
        return
      }
      const data = await response.json()
      setWrappedData(data)
      setLoading(false)
    } catch (err) {
      setError("Failed to load Fitness Wrapped data")
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-2xl mb-4 animate-pulse">Loading your Fitness Wrapped...</div>
          <div className="text-white/70">🎉</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">😕</div>
          <h1 className="text-white text-3xl font-bold mb-4">Not Quite Yet!</h1>
          <p className="text-white/90 text-lg mb-6">{error}</p>
          <p className="text-white/70 text-sm mb-8">
            Your Fitness Wrapped will be available when you complete a 6-week or 8-week challenge.
            Keep tracking your progress!
          </p>
          <button
            onClick={() => router.push("/client-dashboard")}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-full text-white font-semibold transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-16 md:py-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push("/client-dashboard")}
            className="px-4 py-2 md:px-6 md:py-3 bg-white/20 hover:bg-white/30 rounded-full text-white font-semibold transition text-sm md:text-base"
          >
            ← Back to Dashboard
          </button>

          <button
            onClick={() => {
              const shareText = `Check out my Fitness Wrapped! 🎉\n\n${window.location.href}\n\n#FitnessWrapped #CoachFit`
              navigator.clipboard.writeText(shareText)
              alert("Link copied to clipboard!")
            }}
            className="px-4 py-2 md:px-6 md:py-3 bg-white/20 hover:bg-white/30 rounded-full text-white font-semibold transition text-sm md:text-base"
          >
            Share Link 🔗
          </button>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-white text-center mb-3 md:mb-4 animate-fade-in-up">
          Your Fitness Wrapped 🎉
        </h1>
        <p className="text-xl md:text-2xl text-white/80 text-center mb-12 md:mb-16 animate-fade-in-up animation-delay-200">
          {wrappedData?.cohortName || "Your Challenge"}
        </p>

        {/* Wrapped Carousel */}
        {wrappedData && <WrappedCarousel data={wrappedData} />}
      </div>
    </div>
  )
}
