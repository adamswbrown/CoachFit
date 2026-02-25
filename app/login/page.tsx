"use client"

import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useCallback, startTransition, Suspense } from "react"
import Link from "next/link"

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showInviteAcknowledgment, setShowInviteAcknowledgment] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const debugInfo = {
    error: searchParams.get("error"),
    errorDescription: searchParams.get("error_description"),
    callbackUrl: searchParams.get("callbackUrl"),
    allParams: Object.fromEntries(searchParams.entries()),
  }

  useEffect(() => {
    if (session) {
      router.push("/dashboard")
    }
  }, [session, router])

  useEffect(() => {
    const invitedParam = searchParams.get("invited")
    setShowInviteAcknowledgment(invitedParam === "1")

    const prefilledEmail = searchParams.get("email")
    if (prefilledEmail) {
      setEmail(prefilledEmail)
    }

    const errorParam = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")

    if (errorParam === "CredentialsSignin") {
      setError("Invalid email or password.")
    } else if (errorParam === "AccessDenied") {
      setError("Access denied. Please try again or contact support.")
    } else if (errorParam) {
      const details = errorDescription ? `: ${errorDescription}` : ""
      setError(`Sign-in error (${errorParam})${details}. Please try again or contact support.`)
    }
  }, [searchParams])

  const handleEmailLogin = useCallback(async (e: React.FormEvent) => {
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
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }, [email, password, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-start sm:items-center justify-center bg-gray-50 overflow-y-auto">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (session) {
    return null
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
            Fitness, guided by coaches.
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Check-ins, weekly review, and progress built around real support.
          </p>
        </div>

        {showInviteAcknowledgment && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-900">
              You&apos;ve been invited to work with a coach.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6">
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
              {error}
            </div>
            {debugInfo.error && (
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {showDebug ? "Hide" : "Show"} debug info
              </button>
            )}
            {showDebug && debugInfo.error && (
              <div className="mt-2 p-3 bg-gray-100 border border-gray-300 rounded-md text-xs font-mono overflow-auto max-h-48">
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

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
                onChange={(e) => startTransition(() => setEmail(e.target.value))}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => startTransition(() => setPassword(e.target.value))}
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

        <p className="text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-start sm:items-center justify-center bg-gray-50 overflow-y-auto">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
