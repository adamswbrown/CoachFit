"use client"

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "@/lib/legal-content"

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showDataProcessingModal, setShowDataProcessingModal] = useState(false)
  const [legalContent, setLegalContent] = useState({
    termsContentHtml: DEFAULT_TERMS_HTML,
    privacyContentHtml: DEFAULT_PRIVACY_HTML,
    dataProcessingContentHtml: DEFAULT_DATA_PROCESSING_HTML,
  })

  const handleGoogleSignUp = useCallback(() => {
    signIn("google", { callbackUrl: "/dashboard" })
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

  const validateForm = (): string | null => {
    if (!formData.email) {
      return "Email is required"
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return "Invalid email format"
    }
    if (!formData.password) {
      return "Password is required"
    }
    if (formData.password.length < 8) {
      return "Password must be at least 8 characters"
    }
    if (formData.password !== formData.confirmPassword) {
      return "Passwords do not match"
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
      // Create account
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create account")
        return
      }

      // Auto-login after successful signup
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        callbackUrl: "/dashboard",
        redirect: false,
      })

      if (result?.error) {
        setError("Account created but login failed. Please try logging in.")
        return
      }

      // Record consent
      try {
        const consentRes = await fetch("/api/consent/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            termsAccepted: true,
            privacyAccepted: true,
            dataProcessing: true,
            marketing: consent.marketing,
          }),
        })

        if (!consentRes.ok) {
          console.error("Failed to record consent:", await consentRes.json())
        }
      } catch (err) {
        console.error("Error recording consent:", err)
      }

      // Redirect to dashboard
      router.push("/dashboard")
    } catch (err) {
      console.error("Signup error:", err)
      setError("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded-lg p-4 sm:p-6 md:p-8 max-w-md w-full border border-gray-200">
        {/* Logo */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <img
            src="/coachfit-logo-login.png"
            alt="CoachFit Logo"
            style={{ maxWidth: "100%", height: "auto", width: 320 }}
            width={400}
            height={130}
            loading="eager"
          />
        </div>

        {/* Headline and Subtext */}
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
            Your coach invited you
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Create your account to get started with CoachFit.
          </p>
        </div>

        {/* Google Sign-Up */}
        <div className="mb-6">
          <button
            onClick={handleGoogleSignUp}
            className="w-full bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign up with Google
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-gray-500">Or sign up with email</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}
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
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Consent Section */}
          <div className="border-t pt-4 mt-6">
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.terms}
                  onChange={(e) => setConsent({ ...consent, terms: e.target.checked, privacy: e.target.checked, dataProcessing: e.target.checked })}
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
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
            Sign in
          </Link>
        </p>

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
