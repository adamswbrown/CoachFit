"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isClient } from "@/lib/permissions"
import { ClientLayout } from "@/components/layouts/ClientLayout"

interface PairingStatus {
  paired: boolean
  pairingCode: string | null
  pairedAt: string | null
  deviceName: string | null
  lastSyncAt: string | null
  syncsCount: number
}

export default function ClientPairingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pairingStatus, setPairingStatus] = useState<PairingStatus | null>(null)
  const [pairingCode, setPairingCode] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCodeForm, setShowCodeForm] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (session?.user && !isClient(session.user)) {
      router.push("/client-dashboard")
      return
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user && isClient(session.user)) {
      fetchPairingStatus()
    }
  }, [session])

  const fetchPairingStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/client/pairing-status")
      if (res.ok) {
        const data = await res.json()
        setPairingStatus(data)
      } else {
        setError("Failed to fetch pairing status")
      }
    } catch (err) {
      console.error("Error fetching pairing status:", err)
      setError("Error fetching pairing status")
    } finally {
      setLoading(false)
    }
  }

  const handlePairingCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedPairingCode = pairingCode.trim().toUpperCase()
    
    if (!normalizedPairingCode) {
      setError("Please enter a pairing code")
      return
    }

    if (normalizedPairingCode.length !== 8 || !/^[A-HJ-NP-Z2-9]{8}$/.test(normalizedPairingCode)) {
      setError("Pairing code must be 8 characters (letters and numbers)")
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      const res = await fetch("/api/client/pair-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingCode: normalizedPairingCode }),
      })

      if (res.ok) {
        setSuccess("Device paired successfully! Your iOS app will now sync HealthKit data.")
        setPairingCode("")
        setShowCodeForm(false)
        setTimeout(() => fetchPairingStatus(), 500)
      } else {
        const data = await res.json()
        setError(data.error || "Failed to pair device")
      }
    } catch (err) {
      console.error("Error pairing device:", err)
      setError("Error pairing device")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnpair = async () => {
    if (!confirm("Unpair your device? You'll need to use a new pairing code to sync data.")) {
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/client/unpair-device", {
        method: "POST",
      })

      if (res.ok) {
        setSuccess("Device unpaired successfully")
        setTimeout(() => fetchPairingStatus(), 500)
      } else {
        setError("Failed to unpair device")
      }
    } catch (err) {
      console.error("Error unpairing device:", err)
      setError("Error unpairing device")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <ClientLayout>
        <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg border border-neutral-200 p-8">
              <div className="space-y-4">
                <div className="h-6 bg-neutral-200 rounded animate-pulse"></div>
                <div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      </ClientLayout>
    )
  }

  return (
    <ClientLayout>
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📱</span>
              <h1 className="text-3xl font-bold text-neutral-900">Device Pairing</h1>
            </div>
            <p className="text-neutral-600">
              Connect your iOS device to automatically sync HealthKit data (workouts, steps, sleep, weight)
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Pairing Status Card */}
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Pairing Status</h2>
                <p className="text-sm text-neutral-500 mt-1">Current connection state</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                pairingStatus?.paired 
                  ? "bg-green-100 text-green-800"
                  : "bg-neutral-100 text-neutral-700"
              }`}>
                {pairingStatus?.paired ? "✓ Paired" : "Not Paired"}
              </div>
            </div>

            {pairingStatus?.paired ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-900 font-medium mb-2">Connected</p>
                  <p className="text-sm text-green-800">
                    Your iOS device is paired and syncing HealthKit data automatically.
                  </p>
                </div>

                {pairingStatus.deviceName && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">Device</p>
                      <p className="text-sm font-medium text-neutral-900 mt-1">{pairingStatus.deviceName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">Paired</p>
                      <p className="text-sm font-medium text-neutral-900 mt-1">
                        {pairingStatus.pairedAt ? new Date(pairingStatus.pairedAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">Last Sync</p>
                      <p className="text-sm font-medium text-neutral-900 mt-1">
                        {pairingStatus.lastSyncAt ? new Date(pairingStatus.lastSyncAt).toLocaleString() : "Never"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 uppercase tracking-wider">Total Syncs</p>
                      <p className="text-sm font-medium text-neutral-900 mt-1">{pairingStatus.syncsCount || 0}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUnpair}
                  disabled={submitting}
                  className="w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Unpairing..." : "Unpair Device"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-medium mb-2">Not Paired Yet</p>
                  <p className="text-sm text-blue-800 mb-3">
                    To get started, you'll need a pairing code from your coach. Ask them to generate one at their dashboard.
                  </p>
                  <button
                    onClick={() => setShowCodeForm(!showCodeForm)}
                    className="text-sm font-medium text-blue-700 hover:text-blue-800"
                  >
                    {showCodeForm ? "Cancel" : "Enter Pairing Code"}
                  </button>
                </div>

                {showCodeForm && (
                  <form onSubmit={handlePairingCode} className="space-y-4 pt-4 border-t border-neutral-200">
                    <div>
                      <label className="block text-sm font-medium text-neutral-900 mb-2">
                        8-Character Pairing Code
                      </label>
                      <input
                        type="text"
                        inputMode="text"
                        maxLength={8}
                        autoCapitalize="characters"
                        placeholder="ABCD2345"
                        value={pairingCode}
                        onChange={(e) =>
                          setPairingCode(
                            e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "")
                          )
                        }
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg tracking-widest"
                      />
                      <p className="text-xs text-neutral-500 mt-2">
                        Get this code from your coach's pairing dashboard
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || pairingCode.length !== 8}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? "Pairing..." : "Pair Device"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">How It Works</h3>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">1</span>
                <div>
                  <p className="font-medium text-neutral-900">Coach generates pairing code</p>
                  <p className="text-sm text-neutral-600 mt-1">Your coach creates an 8-character code at their pairing dashboard</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">2</span>
                <div>
                  <p className="font-medium text-neutral-900">You enter the code here</p>
                  <p className="text-sm text-neutral-600 mt-1">Paste the code into the form above to pair your device</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">3</span>
                <div>
                  <p className="font-medium text-neutral-900">iOS app syncs automatically</p>
                  <p className="text-sm text-neutral-600 mt-1">Your GymDashSync app will collect and send HealthKit data daily</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">4</span>
                <div>
                  <p className="font-medium text-neutral-900">See synced data in dashboard</p>
                  <p className="text-sm text-neutral-600 mt-1">Your workouts, steps, sleep, and weight appear automatically</p>
                </div>
              </li>
            </ol>

            <div className="mt-6 pt-6 border-t border-neutral-200">
              <h4 className="font-medium text-neutral-900 mb-3">What data syncs?</h4>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> Workouts (type, duration, calories, distance)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> Weight & body metrics
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> Daily step counts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-600">✓</span> Sleep data (duration, quality)
                </li>
              </ul>
            </div>
          </div>

          {/* Back Link */}
          <Link
            href="/client-dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </ClientLayout>
  )
}
