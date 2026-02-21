"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "@/lib/legal-content"

export default function ClientSelfSignupOnboardingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isCompleting, setIsCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasConsent, setHasConsent] = useState(false)
  const [consentLoading, setConsentLoading] = useState(true)
  const [consent, setConsent] = useState({
    terms: false,
    privacy: false,
    dataProcessing: false,
    marketing: false,
  })
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showDataProcessingModal, setShowDataProcessingModal] = useState(false)
  const [legalContent, setLegalContent] = useState({
    termsContentHtml: DEFAULT_TERMS_HTML,
    privacyContentHtml: DEFAULT_PRIVACY_HTML,
    dataProcessingContentHtml: DEFAULT_DATA_PROCESSING_HTML,
  })

  useEffect(() => {
    const loadConsent = async () => {
      try {
        const res = await fetch("/api/consent/accept")
        if (!res.ok) return
        const data = await res.json()
        if (data?.hasConsent) {
          setHasConsent(true)
        }
      } catch (err) {
        console.error("Failed to load consent", err)
      } finally {
        setConsentLoading(false)
      }
    }

    loadConsent()
  }, [])

  useEffect(() => {
    const loadLegalContent = async () => {
      try {
        const res = await fetch("/api/public/legal")
        if (!res.ok) return
        const body = await res.json()
        if (body?.data) {
          setLegalContent((prev) => ({ ...prev, ...body.data }))
        }
      } catch (err) {
        console.error("Failed to load legal content", err)
      }
    }

    loadLegalContent()
  }, [])

  const handleComplete = async () => {
    setIsCompleting(true)
    setError(null)

    try {
      if (!hasConsent) {
        if (!consent.terms || !consent.privacy || !consent.dataProcessing) {
          setError("Please accept the required terms to continue.")
          setIsCompleting(false)
          return
        }

        const consentRes = await fetch("/api/consent/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            termsAccepted: consent.terms,
            privacyAccepted: consent.privacy,
            dataProcessing: consent.dataProcessing,
            marketing: consent.marketing,
          }),
        })

        if (!consentRes.ok) {
          throw new Error("Failed to record consent")
        }
      }

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-start sm:items-center justify-center px-4 py-6 sm:py-8 overflow-y-auto">
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
                      Your coach will add you to their program soon. You'll receive a notification when they do.
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

          {!consentLoading && !hasConsent && (
            <div className="mb-6 space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">Terms & Agreements</h3>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={consent.terms}
                  onChange={(event) =>
                    setConsent((prev) => ({ ...prev, terms: event.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-blue-700 underline hover:text-blue-800"
                  >
                    Terms of Service
                  </button>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={consent.privacy}
                  onChange={(event) =>
                    setConsent((prev) => ({ ...prev, privacy: event.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-blue-700 underline hover:text-blue-800"
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={consent.dataProcessing}
                  onChange={(event) =>
                    setConsent((prev) => ({ ...prev, dataProcessing: event.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  I consent to the{" "}
                  <button
                    type="button"
                    onClick={() => setShowDataProcessingModal(true)}
                    className="text-blue-700 underline hover:text-blue-800"
                  >
                    processing of my health and fitness data
                  </button>
                  .
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={consent.marketing}
                  onChange={(event) =>
                    setConsent((prev) => ({ ...prev, marketing: event.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>Send me product updates and tips (optional).</span>
              </label>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleComplete}
              disabled={isCompleting || consentLoading}
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

        {/* Terms Modal */}
        {showTermsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto p-6">
              <h2 className="text-xl font-bold mb-4">Terms of Service</h2>
              <div
                className="text-sm text-gray-700 space-y-4"
                dangerouslySetInnerHTML={{ __html: legalContent.termsContentHtml }}
              />
              <button
                onClick={() => setShowTermsModal(false)}
                className="mt-6 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Privacy Policy Modal */}
        {showPrivacyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto p-6">
              <h2 className="text-xl font-bold mb-4">Privacy Policy</h2>
              <div
                className="text-sm text-gray-700 space-y-4"
                dangerouslySetInnerHTML={{ __html: legalContent.privacyContentHtml }}
              />
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="mt-6 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Data Processing Modal */}
        {showDataProcessingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto p-6">
              <h2 className="text-xl font-bold mb-4">Data Processing</h2>
              <div
                className="text-sm text-gray-700 space-y-4"
                dangerouslySetInnerHTML={{ __html: legalContent.dataProcessingContentHtml }}
              />
              <button
                onClick={() => setShowDataProcessingModal(false)}
                className="mt-6 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
