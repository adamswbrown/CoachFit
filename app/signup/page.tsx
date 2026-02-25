"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "@/lib/legal-content"

type SignupResult = {
  email: string
  temporaryPassword: string
}

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: "",
    name: "",
  })
  const [consent, setConsent] = useState({
    terms: false,
    privacy: false,
    dataProcessing: false,
    marketing: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signupResult, setSignupResult] = useState<SignupResult | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showDataProcessingModal, setShowDataProcessingModal] = useState(false)
  const [legalContent, setLegalContent] = useState({
    termsContentHtml: DEFAULT_TERMS_HTML,
    privacyContentHtml: DEFAULT_PRIVACY_HTML,
    dataProcessingContentHtml: DEFAULT_DATA_PROCESSING_HTML,
  })

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

  const validateForm = (): string | null => {
    if (!formData.email) {
      return "Email is required"
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return "Invalid email format"
    }
    if (!consent.terms) {
      return "You must accept the Terms of Service, Privacy Policy, and Data Processing agreement"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name || undefined,
          termsAccepted: consent.terms,
          privacyAccepted: consent.privacy,
          dataProcessing: consent.dataProcessing,
          marketing: consent.marketing,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create account")
        return
      }

      if (!data?.temporaryPassword) {
        setError("Account created, but no temporary password was returned. Please contact support.")
        return
      }

      setSignupResult({
        email: formData.email,
        temporaryPassword: data.temporaryPassword,
      })
    } catch (err) {
      console.error("Signup error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyPassword = async () => {
    if (!signupResult?.temporaryPassword) return

    try {
      await navigator.clipboard.writeText(signupResult.temporaryPassword)
      setCopiedPassword(true)
      setTimeout(() => setCopiedPassword(false), 3000)
    } catch {
      setError("Unable to copy password. Please copy it manually.")
    }
  }

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-gray-50 px-4 py-6 sm:py-8 overflow-y-auto">
      <div className="bg-white rounded-lg p-4 sm:p-6 md:p-8 max-w-md w-full border border-gray-200">
        <div className="mb-6 sm:mb-8 flex justify-center">
          <img
            src="/coachfit-logo-login.png"
            alt="CoachFit Logo"
            style={{ maxWidth: "min(100%, 320px)", height: "auto" }}
            width={400}
            height={130}
            loading="eager"
          />
        </div>

        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
            Your coach invited you
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Create your account and receive a temporary password to sign in.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        {signupResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800 font-medium mb-2">Account created successfully.</p>
              <p className="text-sm text-green-900">
                Sign in with your email and temporary password, then change it immediately.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-900">
                {signupResult.email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono text-gray-900 break-all">
                {signupResult.temporaryPassword}
              </div>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
              >
                {copiedPassword ? "Copied" : "Copy password"}
              </button>
            </div>

            <Link
              href={`/login?email=${encodeURIComponent(signupResult.email)}`}
              className="block w-full bg-gray-700 text-white px-4 py-2.5 rounded-md hover:bg-gray-800 text-sm font-medium transition-colors text-center"
            >
              Continue to sign in
            </Link>

            <p className="text-xs text-gray-500 text-center">
              Keep this temporary password safe until you complete first sign-in.
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name (optional)
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t pt-4 mt-6">
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent.terms}
                      onChange={(e) =>
                        setConsent({
                          ...consent,
                          terms: e.target.checked,
                          privacy: e.target.checked,
                          dataProcessing: e.target.checked,
                        })
                      }
                      className="mt-1 rounded"
                      required
                    />
                    <span className="text-sm text-gray-700">
                      I agree to the{" "}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Terms of Service
                      </button>
                      ,{" "}
                      <button
                        type="button"
                        onClick={() => setShowPrivacyModal(true)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Privacy Policy
                      </button>
                      , and{" "}
                      <button
                        type="button"
                        onClick={() => setShowDataProcessingModal(true)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Data Processing
                      </button>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent.marketing}
                      onChange={(e) => setConsent({ ...consent, marketing: e.target.checked })}
                      className="mt-1 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      Send me updates and marketing emails (optional)
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {submitting ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </>
        )}

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
