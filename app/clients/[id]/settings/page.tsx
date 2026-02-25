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

          {/* Sign-In Method */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Sign-In Method</h2>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">Email + password only</p>
              <p className="mt-1 text-xs text-blue-800">
                This client signs in with email and password only.
              </p>
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
