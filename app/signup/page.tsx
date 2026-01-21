"use client"

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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
      return "You must accept the Terms of Service"
    }
    if (!consent.privacy) {
      return "You must accept the Privacy Policy"
    }
    if (!consent.dataProcessing) {
      return "You must accept data processing terms"
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
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 md:p-8 max-w-md w-full">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-center">CoachSync</h1>
        <p className="text-gray-600 mb-4 sm:mb-6 text-center text-sm sm:text-base">Create your account</p>
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">
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
          
          {/* GDPR Consent Section */}
          <div className="border-t pt-4 mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Terms & Agreements</h3>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.terms}
                  onChange={(e) => setConsent({ ...consent, terms: e.target.checked })}
                  className="mt-1 rounded"
                  required
                />
                <span className="text-sm text-gray-700">
                  I accept the{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Terms of Service
                  </button>
                  <span className="text-red-500">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.privacy}
                  onChange={(e) => setConsent({ ...consent, privacy: e.target.checked })}
                  className="mt-1 rounded"
                  required
                />
                <span className="text-sm text-gray-700">
                  I accept the{" "}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Privacy Policy
                  </button>
                  <span className="text-red-500">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent.dataProcessing}
                  onChange={(e) => setConsent({ ...consent, dataProcessing: e.target.checked })}
                  className="mt-1 rounded"
                  required
                />
                <span className="text-sm text-gray-700">
                  I consent to the{" "}
                  <button
                    type="button"
                    onClick={() => setShowDataProcessingModal(true)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    processing of my health and fitness data
                  </button>{" "}
                  (including HealthKit integration)
                  <span className="text-red-500">*</span>
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
                  I want to receive updates and marketing emails (optional)
                </span>
              </label>

              <p className="text-xs text-gray-500 mt-2">
                <span className="text-red-500">*</span> Required fields
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
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
