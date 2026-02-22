"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isAdminOrCoach } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface PairingCode {
  code: string
  expires_at: string
  created_at: string
  client_id?: string
}

interface CoachClient {
  id: string
  name?: string
  email: string
  status: string
}

export default function PairingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeCodes, setActiveCodes] = useState<PairingCode[]>([])
  const [clients, setClients] = useState<CoachClient[]>([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [featureEnabled, setFeatureEnabled] = useState<boolean>(true)
  const [checkingFeature, setCheckingFeature] = useState(true)

  useEffect(() => {
    const checkFeature = async () => {
      try {
        const res = await fetch("/api/settings/feature-flags")
        if (res.ok) {
          const data = await res.json()
          setFeatureEnabled(data.data.iosIntegrationEnabled ?? true)
        }
      } catch (err) {
        console.error("Error checking iOS integration feature flag:", err)
      } finally {
        setCheckingFeature(false)
      }
    }
    checkFeature()
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
      router.push("/client-dashboard")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session) {
      void Promise.all([fetchActiveCodes(), fetchClients()])
        .finally(() => setLoading(false))
    }
  }, [session])

  const fetchActiveCodes = async () => {
    try {
      const res = await fetch("/api/pairing-codes/generate")
      if (res.ok) {
        const data = await res.json()
        setActiveCodes(data.codes || [])
      }
    } catch (err) {
      console.error("Error fetching pairing codes:", err)
    }
  }

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/coach-dashboard/overview")
      if (!res.ok) return

      const data = await res.json()
      const normalizedClients: CoachClient[] = (data.clients || [])
        .filter((client: any) => typeof client?.id === "string")
        .map((client: any) => ({
          id: client.id,
          name: client.name || undefined,
          email: client.email,
          status: client.status,
        }))

      setClients(normalizedClients)
      if (!selectedClientId && normalizedClients.length > 0) {
        setSelectedClientId(normalizedClients[0].id)
      }
    } catch (err) {
      console.error("Error fetching clients for pairing:", err)
    }
  }

  const handleGenerateCode = async () => {
    if (!selectedClientId) {
      setError("Select a client before generating a pairing code.")
      return
    }

    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/pairing-codes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClientId }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(`Generated pairing code: ${data.code}`)
        fetchActiveCodes()
      } else {
        setError(data.error || "Failed to generate pairing code")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error("Failed to copy code:", err)
    }
  }

  const formatExpirationTime = (expiresAt: string) => {
    const expiration = new Date(expiresAt)
    const now = new Date()
    const diff = expiration.getTime() - now.getTime()

    if (diff <= 0) return "Expired"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    }
    return `${minutes}m remaining`
  }

  const getClientLabel = (clientId?: string) => {
    if (!clientId) return "Unknown client"
    const client = clients.find((item) => item.id === clientId)
    if (!client) return "Unknown client"
    return client.name ? `${client.name} (${client.email})` : client.email
  }

  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-neutral-600">Loading...</p>
            </div>
          </div>
        </div>
      </CoachLayout>
    )
  }

  // Feature flag check
  if (checkingFeature) {
    return (
      <CoachLayout>
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-neutral-600">Loading...</p>
        </div>
      </CoachLayout>
    )
  }

  if (!featureEnabled) {
    return (
      <CoachLayout>
        <div className="max-w-4xl mx-auto text-center py-12">
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-neutral-900 mb-4">Feature Not Available</h2>
            <p className="text-neutral-600 mb-4">
              iOS integration features are currently disabled. Contact your administrator to enable this feature.
            </p>
            <Link 
              href="/coach-dashboard"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <Link href="/coach-dashboard" className="hover:text-neutral-700">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-neutral-900">iOS App Pairing</span>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">iOS App Pairing</h1>
          <p className="text-neutral-600 text-sm mt-1">
            Generate pairing codes for clients to connect their iOS app with HealthKit data sync.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-sm">
            {success}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">How Pairing Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
            <li>Select a client and generate an 8-character pairing code below</li>
            <li>Share the code with your client</li>
            <li>Client enters the code in the iOS app (GymDashSync)</li>
            <li>Once paired, HealthKit data will automatically sync to their CoachFit account</li>
          </ol>
          <div className="mt-4 p-3 bg-blue-100 rounded-md">
            <p className="text-blue-900 text-sm">
              <strong>Note:</strong> Pairing codes expire after 15 minutes if unused and can only be used once.
            </p>
          </div>
        </div>

        {/* Generate Button */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Generate New Pairing Code</h2>
          <div className="mb-4">
            <label htmlFor="pairing-client" className="block text-sm font-medium text-neutral-700 mb-2">
              Client
            </label>
            <select
              id="pairing-client"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full max-w-xl px-3 py-2 border border-neutral-300 rounded-md bg-white text-sm"
            >
              {clients.length === 0 ? (
                <option value="">No clients available</option>
              ) : (
                clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name ? `${client.name} (${client.email})` : client.email}
                  </option>
                ))
              )}
            </select>
          </div>
          <button
            onClick={handleGenerateCode}
            disabled={generating || !selectedClientId}
            className="bg-neutral-900 text-white px-6 py-3 rounded-md hover:bg-neutral-800 disabled:opacity-50 font-medium"
          >
            {generating ? "Generating..." : "Generate Pairing Code"}
          </button>
        </div>

        {/* Active Codes */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Active Pairing Codes</h2>

          {activeCodes.length === 0 ? (
            <p className="text-neutral-500 py-4">
              No active pairing codes. Generate one above to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {activeCodes.map((code) => (
                <div
                  key={code.code}
                  className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="font-mono text-2xl font-bold text-neutral-900 tracking-wider">
                      {code.code}
                    </div>
                    <div className="text-sm text-neutral-600 space-y-1">
                      <div>{formatExpirationTime(code.expires_at)}</div>
                      <div>{getClientLabel(code.client_id)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopyCode(code.code)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      copiedCode === code.code
                        ? "bg-green-100 text-green-700"
                        : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                    }`}
                  >
                    {copiedCode === code.code ? "Copied!" : "Copy Code"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What Gets Synced */}
        <div className="bg-white border border-neutral-200 rounded-lg p-6 mt-8">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">What Data Gets Synced</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-neutral-50 rounded-lg">
              <h3 className="font-medium text-neutral-900 mb-2">Workouts</h3>
              <p className="text-sm text-neutral-600">
                All workout types, duration, calories, heart rate, and distance
              </p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <h3 className="font-medium text-neutral-900 mb-2">Body Metrics</h3>
              <p className="text-sm text-neutral-600">
                Weight, height, and body composition measurements
              </p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <h3 className="font-medium text-neutral-900 mb-2">Steps</h3>
              <p className="text-sm text-neutral-600">
                Daily step counts from iPhone and Apple Watch
              </p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg">
              <h3 className="font-medium text-neutral-900 mb-2">Sleep</h3>
              <p className="text-sm text-neutral-600">
                Sleep duration, stages (REM, deep, core), and quality
              </p>
            </div>
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}
