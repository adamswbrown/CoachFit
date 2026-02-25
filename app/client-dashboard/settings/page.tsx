"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ClientLayout } from "@/components/layouts/ClientLayout"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { Role } from "@/lib/types"

interface UserSettings {
  id: string
  name: string | null
  email: string
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

  useEffect(() => {
    if ((session?.user as any)?.mustChangePassword) {
      setShowPasswordChange(true)
    }
  }, [session])

  // GDPR Data export/delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deletionType, setDeletionType] = useState<"soft" | "hard">("soft")
  const [deletionReason, setDeletionReason] = useState("")
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Consent state
  const [consent, setConsent] = useState<any>(null)
  const [consentLoading, setConsentLoading] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)
  const [updatingConsent, setUpdatingConsent] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      loadSettings()
      loadPairingStatus()
      loadConsent()
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

  const loadConsent = async () => {
    setConsentLoading(true)
    setConsentError(null)
    try {
      const res = await fetch("/api/consent/accept")
      if (res.ok) {
        const data = await res.json()
        setConsent(data.consent)
      } else {
        setConsentError("Failed to load consent preferences")
      }
    } catch (err) {
      console.error("Error loading consent:", err)
      setConsentError("Failed to load consent preferences")
    } finally {
      setConsentLoading(false)
    }
  }

  const handleMarketingConsentToggle = async (newValue: boolean) => {
    setUpdatingConsent(true)
    try {
      const res = await fetch("/api/consent/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsAccepted: consent?.termsAccepted ? true : false,
          privacyAccepted: consent?.privacyAccepted ? true : false,
          dataProcessing: consent?.dataProcessing ? true : false,
          marketing: newValue,
        }),
      })

      if (res.ok) {
        setSuccess("Marketing preference updated")
        loadConsent()
        setTimeout(() => setSuccess(null), 5000)
      } else {
        const data = await res.json()
        setError(data.error || "Failed to update preference")
      }
    } catch (err) {
      setError("Failed to update preference")
      console.error("Error updating consent:", err)
    } finally {
      setUpdatingConsent(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not accepted"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
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

          {/* Sign-In Method */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Sign-In Method</h2>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">Email + password only</p>
              <p className="mt-1 text-xs text-blue-800">
                Sign in with the email and temporary password provided by your coach or admin.
              </p>
            </div>
          </div>

          {/* Password Change */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Change Password</h2>

            {(session?.user as any)?.mustChangePassword && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Please change your temporary password to continue.
              </div>
            )}

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

          {/* Consent & Privacy */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Consent & Privacy</h2>
            
            {consentLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin"></div>
              </div>
            ) : consentError ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                {consentError}
              </div>
            ) : consent ? (
              <div className="space-y-4">
                {/* Terms of Service */}
                <div className="flex items-start justify-between p-3 bg-neutral-50 rounded-md">
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">Terms of Service</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Accepted on {formatDate(consent.termsAccepted)}
                    </div>
                  </div>
                  <div className="text-lg">✓</div>
                </div>

                {/* Privacy Policy */}
                <div className="flex items-start justify-between p-3 bg-neutral-50 rounded-md">
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">Privacy Policy</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Accepted on {formatDate(consent.privacyAccepted)}
                    </div>
                  </div>
                  <div className="text-lg">✓</div>
                </div>

                {/* Data Processing */}
                <div className="flex items-start justify-between p-3 bg-neutral-50 rounded-md">
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">Data Processing (HealthKit)</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      Accepted on {formatDate(consent.dataProcessing)}
                    </div>
                  </div>
                  <div className="text-lg">✓</div>
                </div>

                {/* Marketing */}
                <div className="flex items-start justify-between p-3 bg-neutral-50 rounded-md">
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900">Marketing Emails</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {consent.marketing
                        ? `Opted in on ${formatDate(consent.marketing)}`
                        : "Not opted in (optional)"}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!consent.marketing}
                      onChange={(e) => handleMarketingConsentToggle(e.target.checked)}
                      disabled={updatingConsent}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 transition-colors" />
                  </label>
                </div>

                <div className="text-xs text-neutral-500 pt-2">
                  Version: {consent.version}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                No consent record found. You'll need to accept our terms to proceed.
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
                <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-base sm:text-lg font-semibold text-neutral-900 mb-4">Delete Account</h3>

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
