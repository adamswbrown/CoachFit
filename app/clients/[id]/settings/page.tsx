"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"

interface Client {
  id: string
  name: string | null
  email: string
  Account: Array<{
    provider: string
    providerAccountId: string
  }>
}

export default function ClientSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [resettingPassword, setResettingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Pairing code state
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [pairingExpiry, setPairingExpiry] = useState<Date | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [pairingError, setPairingError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
      if (session.user.roles.includes(Role.CLIENT)) {
        router.push("/client-dashboard")
      } else {
        router.push("/login")
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (session && clientId) {
      loadData()
      loadPairingCode()
    }
  }, [session, clientId])

  const loadPairingCode = async () => {
    try {
      const res = await fetch(`/api/pairing-codes/generate?client_id=${clientId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.code) {
          setPairingCode(data.code)
          const expires = data.expiresAt || data.expires_at
          if (expires) setPairingExpiry(new Date(expires))
        }
      }
    } catch (err) {
      console.error("Error loading pairing code:", err)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWithRetry<Client>(`/api/clients/${clientId}/settings`)
      setClient(data)
    } catch (err) {
      console.error("Error loading client settings:", err)
      setError("Failed to load client settings. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setSuccess(null)

    // Validation
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setResettingPassword(true)

    try {
      const res = await fetch(`/api/clients/${clientId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess("Password reset successfully")
        setShowPasswordReset(false)
        setNewPassword("")
        setConfirmPassword("")
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setPasswordError(data.error || "Failed to reset password")
      }
    } catch (err) {
      setPasswordError("Unable to reset password. Please try again.")
    } finally {
      setResettingPassword(false)
    }
  }

  const handleGeneratePairingCode = async (regenerate: boolean = false) => {
    setPairingError(null)
    setGeneratingCode(true)

    try {
      const res = await fetch("/api/pairing-codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          client_id: clientId,
          regenerate 
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setPairingCode(data.code)
        const expires = data.expiresAt || data.expires_at
        if (expires) setPairingExpiry(new Date(expires))
        setSuccess(regenerate ? "New pairing code generated" : "Pairing code generated")
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setPairingError(data.error || "Failed to generate pairing code")
      }
    } catch (err) {
      setPairingError("Unable to generate pairing code. Please try again.")
    } finally {
      setGeneratingCode(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading settings...</p>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

  if (error || !client) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Failed to load settings</h3>
                <p className="text-red-800 text-sm mb-4">{error || "Client not found"}</p>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </CoachLayout>
    )
  }

  const hasGoogleAccount = client.Account.some(acc => acc.provider === "google")
  const hasAppleAccount = client.Account.some(acc => acc.provider === "apple")

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header with Client Name */}
        <div className="mb-6">
          <Link
            href="/coach-dashboard"
            className="text-sm text-neutral-600 hover:text-neutral-900 mb-2 inline-block"
          >
            ← Back to Clients
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {client.name || client.email}
            {client.name && <span className="text-neutral-500 font-normal"> - {client.email}</span>}
          </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-neutral-200 mb-6">
          <nav className="flex gap-6 overflow-x-auto">
            <Link
              href={`/clients/${clientId}`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Overview
            </Link>
            <Link
              href={`/clients/${clientId}/entries`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Entries
            </Link>
            <Link
              href={`/clients/${clientId}/weekly-review`}
              className="px-1 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 -mb-px whitespace-nowrap"
            >
              Weekly Review
            </Link>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Training
            </span>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Tasks
            </span>
            <span className="px-1 py-3 text-sm font-medium text-neutral-400 -mb-px whitespace-nowrap">
              Metrics
            </span>
            <Link
              href={`/clients/${clientId}/settings`}
              className="px-1 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600 -mb-px whitespace-nowrap"
            >
              Settings
            </Link>
          </nav>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Information */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900">
                  {client.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900">
                  {client.name || "Not set"}
                </div>
              </div>
            </div>
          </div>

          {/* Connected Accounts */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Connected Accounts</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">Google</div>
                    <div className="text-xs text-neutral-500">OAuth Sign-In</div>
                  </div>
                </div>
                <div>
                  {hasGoogleAccount ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">Apple</div>
                    <div className="text-xs text-neutral-500">Sign in with Apple</div>
                  </div>
                </div>
                <div>
                  {hasAppleAccount ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Password Reset */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Password Reset</h2>

            {!showPasswordReset ? (
              <div>
                <p className="text-sm text-neutral-600 mb-4">
                  Reset the client's password. They will be able to use the new password to sign in immediately.
                </p>
                <button
                  onClick={() => setShowPasswordReset(true)}
                  className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 text-sm font-medium"
                >
                  Reset Password
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                    {passwordError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Re-enter password"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={resettingPassword}
                    className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 disabled:opacity-50 text-sm font-medium"
                  >
                    {resettingPassword ? "Resetting..." : "Confirm Reset"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordReset(false)
                      setNewPassword("")
                      setConfirmPassword("")
                      setPasswordError(null)
                    }}
                    className="bg-neutral-100 text-neutral-700 px-4 py-2 rounded-md hover:bg-neutral-200 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Mobile App Pairing */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Mobile App Pairing</h2>

            {pairingError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                {pairingError}
              </div>
            )}

            {pairingCode ? (
              <div>
                <p className="text-sm text-neutral-600 mb-3">
                  Share this code with your client to pair their iOS device:
                </p>
                
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-blue-900 tracking-wider mb-2">
                      {pairingCode}
                    </div>
                    <div className="text-xs text-blue-700">
                      Expires: {pairingExpiry?.toLocaleDateString()} at {pairingExpiry?.toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pairingCode)
                      setSuccess("Code copied to clipboard")
                      setTimeout(() => setSuccess(null), 3000)
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    Copy Code
                  </button>
                  
                  <button
                    onClick={() => handleGeneratePairingCode(true)}
                    disabled={generatingCode}
                    className="w-full bg-neutral-100 text-neutral-700 px-4 py-2 rounded-md hover:bg-neutral-200 disabled:opacity-50 text-sm font-medium"
                  >
                    {generatingCode ? "Generating..." : "Regenerate Code (New Device)"}
                  </button>
                  
                  <p className="text-xs text-neutral-500 pt-2">
                    💡 Regenerate when your client gets a new phone or needs to re-pair
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-neutral-600 mb-4">
                  Generate a pairing code for your client to connect their iOS device to the GymDashSync app.
                </p>
                <button
                  onClick={() => handleGeneratePairingCode(false)}
                  disabled={generatingCode}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {generatingCode ? "Generating..." : "Generate Pairing Code"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}
