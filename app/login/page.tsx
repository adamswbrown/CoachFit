"use client"

import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useCallback, Suspense } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showInviteAcknowledgment, setShowInviteAcknowledgment] = useState(false)
  const [hasInviteParam, setHasInviteParam] = useState(false)
  const [checkingInvite, setCheckingInvite] = useState(false)

  useEffect(() => {
    if (session) {
      router.push("/dashboard")
    }
  }, [session, router])

  // Check for invite query parameter (persists once set)
  useEffect(() => {
    const invitedParam = searchParams.get("invited")
    if (invitedParam === "1") {
      setHasInviteParam(true)
      setShowInviteAcknowledgment(true)
    }
  }, [searchParams])

  // Check for invite by email (debounced) - only if not already acknowledged via query param
  useEffect(() => {
    // If already acknowledged via query param, skip dynamic checking
    if (hasInviteParam) {
      return
    }

    if (!email || email.length < 3) {
      setShowInviteAcknowledgment(false)
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setShowInviteAcknowledgment(false)
      return
    }

    const checkInviteTimeout = setTimeout(async () => {
      setCheckingInvite(true)
      try {
        const response = await fetch(`/api/auth/check-invite?email=${encodeURIComponent(email)}`)
        if (response.ok) {
          const data = await response.json()
          setShowInviteAcknowledgment(data.hasInvite)
        }
      } catch (err) {
        // Silently fail - don't disrupt user experience
        console.error("Error checking invite:", err)
        setShowInviteAcknowledgment(false)
      } finally {
        setCheckingInvite(false)
      }
    }, 500) // 500ms debounce

    return () => clearTimeout(checkInviteTimeout)
  }, [email, hasInviteParam])

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam === "OAuthAccountNotLinked") {
      setError("An account with this email already exists. Please contact support or try a different account.")
    } else if (errorParam === "AccessDenied") {
      setError("Access denied. Please try again or contact support.")
    } else if (errorParam === "CredentialsSignin") {
      setError("Invalid email or password.")
    } else if (errorParam) {
      // Generic error message for other OAuth errors
      setError("Unable to sign in. Please try again or use email and password.")
    }
  }, [searchParams])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/dashboard",
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password.")
      } else if (result?.ok) {
        router.push("/dashboard")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleSignIn = useCallback(() => {
    signIn("google", { callbackUrl: "/dashboard" })
  }, [])

  const handleDemoLogin = async (email: string, password: string, role: string) => {
    setSubmitting(true)
    setError(null)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/dashboard",
        redirect: false,
      })

      if (result?.error) {
        setError(`Failed to login as ${role}. Please check credentials.`)
      } else if (result?.ok) {
        router.push("/dashboard")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (session) {
    return null
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
            Fitness, guided by coaches.
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Check-ins, weekly review, and progress built around real support.
          </p>
        </div>

        {/* Invite Acknowledgment */}
        {showInviteAcknowledgment && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-900">
              You've been invited to work with a coach.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Email/Password Form (Primary) */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4 text-center">
            Use the account your coach or admin provided
          </p>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-gray-500">Or</span>
          </div>
        </div>

        {/* Google Sign-In (Secondary) */}
        <div className="mb-6">
          <button
            onClick={handleGoogleSignIn}
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
            Sign in with Google
          </button>
        </div>

        {/* Sign Up Link */}
        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
            Sign up
          </Link>
        </p>

        {/* Demo Environment Quick Login */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center mb-3 font-medium uppercase tracking-wide">
            Demo Environment
          </p>
          <p className="text-xs text-gray-500 text-center mb-4">
            Coaches have admin access in this environment.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleDemoLogin("alex.thompson@test.local", "TestPassword123!", "Coach")}
              disabled={submitting}
              className="w-full bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Login as Coach (Alex Thompson)
            </button>
            <button
              onClick={() => handleDemoLogin("client001@test.local", "TestPassword123!", "Client")}
              disabled={submitting}
              className="w-full bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Login as Client
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
