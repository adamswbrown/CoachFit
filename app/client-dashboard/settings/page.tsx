"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ClientLayout } from "@/components/layouts/ClientLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"

interface UserSettings {
  id: string
  name: string | null
  email: string
  Account: Array<{
    provider: string
    providerAccountId: string
  }>
}

interface PairingStatus {
  paired: boolean
  pairingCode: string | null
  pairedAt: string | null
  deviceName: string | null
  lastSyncAt: string | null
  syncsCount: number
}

export default function ClientSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pairingStatus, setPairingStatus] = useState<PairingStatus | null>(null)

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // GDPR Data export/delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deletionType, setDeletionType] = useState<"soft" | "hard">("soft")
  const [deletionReason, setDeletionReason] = useState("")
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && "roles" in session.user && Array.isArray(session.user.roles) && session.user.roles.includes("COACH")) {
      router.push("/coach-dashboard")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session) {
      loadSettings()
      loadPairingStatus()
    }
  }, [session])

  const loadSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWithRetry<UserSettings>("/api/client/settings")
      setSettings(data)
    } catch (err) {
      console.error("Error loading settings:", err)
      setError("Failed to load settings. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const loadPairingStatus = async () => {
    try {
      const res = await fetch("/api/client/pairing-status")
      if (res.ok) {
        const data = await res.json()
        setPairingStatus(data)
      }
    } catch (err) {
      console.error("Error loading pairing status:", err)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setSuccess(null)

    // Validation
    if (!currentPassword) {
      setPasswordError("Current password is required")
      return
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match")
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password")
      return
    }

    setChangingPassword(true)

    try {
      const res = await fetch("/api/client/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess("Password changed successfully")
        setShowPasswordChange(false)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setPasswordError(data.error || "Failed to change password")
      }
    } catch (err) {
      setPasswordError("Unable to change password. Please try again.")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleExportData = async (format: "json" | "csv") => {
    setExportLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/user/export-data?format=${format}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `coachfit-data-export.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setSuccess(`Data exported as ${format.toUpperCase()}`)
        setTimeout(() => setSuccess(null), 5000)
      } else {
        const data = await res.json()
        setError(data.error || "Failed to export data")
      }
    } catch (err) {
      setError("Failed to export data. Please try again.")
      console.error("Export error:", err)
    } finally {
      setExportLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError("Password is required to delete account")
      return
    }

    if (
      !window.confirm(
        deletionType === "hard"
          ? "Are you sure you want to PERMANENTLY delete your account? This action cannot be undone."
          : "Are you sure you want to delete your account? You will have 30 days to restore it."
      )
    ) {
      return
    }

    setDeleteLoading(true)
    setDeleteError(null)

    try {
      const res = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deletePassword,
          deletionType,
          reason: deletionReason || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(data.message)
        setShowDeleteModal(false)
        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = "/api/auth/signout"
        }, 3000)
      } else {
        setDeleteError(data.error || "Failed to delete account")
      }
    } catch (err) {
      setDeleteError("Failed to delete account. Please try again.")
      console.error("Deletion error:", err)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <ClientLayout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-neutral-600">Loading settings...</p>
            </div>
          </div>
        </div>
      </ClientLayout>
    )
  }

  if (!session) {
    return null
  }

  if (error || !settings) {
    return (
      <ClientLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Failed to load settings</h3>
                <p className="text-red-800 text-sm mb-4">{error || "Settings not found"}</p>
                <button
                  onClick={loadSettings}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </ClientLayout>
    )
  }

  const hasGoogleAccount = settings.Account.some(acc => acc.provider === "google")
  const hasAppleAccount = settings.Account.some(acc => acc.provider === "apple")

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/client-dashboard"
            className="text-sm text-neutral-600 hover:text-neutral-900 mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>
          <p className="text-neutral-600 text-sm mt-1">
            Manage your account settings and preferences
          </p>
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
                  {settings.email}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-900">
                  {settings.name || "Not set"}
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

          {/* Password Change */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Change Password</h2>

            {!showPasswordChange ? (
              <div>
                <p className="text-sm text-neutral-600 mb-4">
                  Update your password to keep your account secure.
                </p>
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 text-sm font-medium"
                >
                  Change Password
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                    {passwordError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter current password"
                  />
                </div>
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
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Re-enter new password"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 disabled:opacity-50 text-sm font-medium"
                  >
                    {changingPassword ? "Changing..." : "Confirm Change"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordChange(false)
                      setCurrentPassword("")
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
            
            {pairingStatus?.paired ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-semibold text-sm">✓ Device Successfully Paired</span>
                  </div>
                  <p className="text-sm text-green-800 mt-2">
                    Your iOS device is connected and syncing HealthKit data automatically.
                  </p>
                </div>
                
                {pairingStatus.deviceName && (
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-1">Device Name</p>
                    <p className="text-sm font-medium text-neutral-900">{pairingStatus.deviceName}</p>
                  </div>
                )}
                
                {pairingStatus.pairedAt && (
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-1">Paired On</p>
                    <p className="text-sm font-medium text-neutral-900">
                      {new Date(pairingStatus.pairedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
                
                {pairingStatus.syncsCount > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mb-1">Data Synced</p>
                    <p className="text-sm font-medium text-neutral-900">{pairingStatus.syncsCount} records</p>
                  </div>
                )}

                <Link
                  href="/client-dashboard/pairing"
                  className="inline-block text-sm text-blue-600 hover:underline mt-2"
                >
                  Manage Pairing →
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-neutral-600 mb-4">
                  Generate a pairing code for your client to connect their iOS device to the GymDashSync app.
                </p>
                <Link
                  href="/client-dashboard/pairing"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Generate Pairing Code
                </Link>
              </div>
            )}
          </div>

          {/* GDPR Data Export */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Download Your Data</h2>
            <p className="text-sm text-neutral-600 mb-6">
              Export all your personal data in a portable format (GDPR compliance).
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleExportData("json")}
                disabled={exportLoading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {exportLoading ? "Exporting..." : "Download as JSON"}
              </button>
              <button
                onClick={() => handleExportData("csv")}
                disabled={exportLoading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {exportLoading ? "Exporting..." : "Download as CSV"}
              </button>
            </div>
          </div>

          {/* GDPR Account Deletion */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6 border-red-200 bg-red-50">
            <h2 className="text-lg font-semibold text-red-900 mb-4">Delete Your Account</h2>
            <p className="text-sm text-red-800 mb-6">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
            >
              Delete Account
            </button>

            {/* Delete Modal */}
            {showDeleteModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Delete Account</h3>

                  {deleteError && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
                      {deleteError}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Deletion Type
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={deletionType === "soft"}
                            onChange={() => setDeletionType("soft")}
                            className="rounded"
                          />
                          <span className="text-sm text-neutral-700">
                            Soft Delete (30-day grace period to restore)
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={deletionType === "hard"}
                            onChange={() => setDeletionType("hard")}
                            className="rounded"
                          />
                          <span className="text-sm text-neutral-700">
                            Hard Delete (permanent, immediate)
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Password (required)
                      </label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                        placeholder="Enter your password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Reason (optional)
                      </label>
                      <textarea
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                        placeholder="Why are you deleting your account?"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {deleteLoading ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteModal(false)
                          setDeletePassword("")
                          setDeletionReason("")
                          setDeleteError(null)
                        }}
                        className="flex-1 bg-neutral-100 text-neutral-700 px-4 py-2 rounded-md hover:bg-neutral-200 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ClientLayout>
  )
}
