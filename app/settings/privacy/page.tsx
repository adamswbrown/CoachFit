"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function PrivacySettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletionType, setDeletionType] = useState<"hard" | "soft">("soft")
  const [password, setPassword] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleExportData = async (format: "json" | "csv") => {
    setExportLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/user/export-data?format=${format}`)
      
      if (!response.ok) {
        throw new Error("Failed to export data")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `coachfit-data-export.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setSuccess(`Data exported successfully as ${format.toUpperCase()}`)
    } catch (err) {
      setError("Failed to export data. Please try again.")
      console.error("Export error:", err)
    } finally {
      setExportLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!password) {
      setError("Password is required to delete account")
      return
    }

    setDeleteLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          deletionType,
          reason: reason || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account")
      }

      setSuccess(data.message)
      setShowDeleteModal(false)
      
      // Redirect after successful deletion
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (err: any) {
      setError(err.message || "Failed to delete account. Please try again.")
      console.error("Deletion error:", err)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-neutral-600">Please log in to access privacy settings.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900">Privacy & Data Management</h1>
          <p className="text-neutral-600 mt-2">
            Manage your personal data and account settings in compliance with GDPR
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md mb-6">
            {success}
          </div>
        )}

        {/* Data Export Section */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Export Your Data</h2>
          <p className="text-neutral-600 mb-4">
            Download a complete copy of all your personal data stored in CoachFit, including health entries,
            workouts, sleep records, coach notes, and more.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleExportData("json")}
              disabled={exportLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              {exportLoading ? "Exporting..." : "Download as JSON"}
            </button>
            <button
              onClick={() => handleExportData("csv")}
              disabled={exportLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              {exportLoading ? "Exporting..." : "Download as CSV"}
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-3">
            GDPR Compliance: You have the right to receive your data in a portable format within 30 days of request.
          </p>
        </div>

        {/* Account Deletion Section */}
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Delete Account</h2>
          <p className="text-neutral-600 mb-4">
            Permanently delete your CoachFit account and all associated data. This action cannot be undone.
          </p>
          
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
            <p className="text-sm text-amber-800 font-medium mb-2">⚠️ Warning: Account Deletion</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>Soft delete: 30-day grace period for recovery</li>
              <li>Hard delete: Immediate permanent deletion (cannot be recovered)</li>
              <li>All health data, workouts, and sleep records will be removed</li>
              <li>Coach notes and cohort memberships will be deleted</li>
            </ul>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Delete My Account
          </button>
        </div>

        {/* Deletion Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-xl font-semibold text-neutral-900 mb-4">Confirm Account Deletion</h3>
              
              <div className="space-y-4 mb-6">
                {/* Deletion Type */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Deletion Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="soft"
                        checked={deletionType === "soft"}
                        onChange={(e) => setDeletionType(e.target.value as "soft")}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        Soft Delete <span className="text-neutral-500">(30-day grace period)</span>
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="hard"
                        checked={deletionType === "hard"}
                        onChange={(e) => setDeletionType(e.target.value as "hard")}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        Hard Delete <span className="text-neutral-500">(permanent, immediate)</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your password"
                  />
                </div>

                {/* Reason (optional) */}
                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-neutral-700 mb-2">
                    Reason (Optional)
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Help us improve by sharing why you're leaving..."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? "Deleting..." : "Confirm Deletion"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setPassword("")
                    setReason("")
                    setError(null)
                  }}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-md hover:bg-neutral-300 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
