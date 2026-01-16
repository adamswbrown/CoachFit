"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface SystemSettings {
  id: string
  maxClientsPerCoach: number
  minClientsPerCoach: number
  recentActivityDays: number
  lowEngagementEntries: number
  noActivityDays: number
  criticalNoActivityDays: number
  shortTermWindowDays: number
  longTermWindowDays: number
  adminOverrideEmail: string | null
  healthkitEnabled: boolean
  iosIntegrationEnabled: boolean
}

interface TechnicalConstant {
  name: string
  value: string | number
  description: string
  category: string
}

const TECHNICAL_CONSTANTS: TechnicalConstant[] = [
  {
    category: "Authentication & Security",
    name: "Session Max Age",
    value: "1 hour (3,600 seconds)",
    description: "How long before users must re-authenticate",
  },
  {
    category: "Authentication & Security",
    name: "Password Hash Rounds",
    value: "10",
    description: "Bcrypt hashing iterations (security vs speed tradeoff)",
  },
  {
    category: "Pairing & Devices",
    name: "Pairing Code Length",
    value: "6 characters",
    description: "Length of device pairing codes",
  },
  {
    category: "Pairing & Devices",
    name: "Pairing Code Character Set",
    value: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    description: "Excludes ambiguous characters (0/O, I/L, 1)",
  },
  {
    category: "Pairing & Devices",
    name: "Pairing Code Expiry",
    value: "24 hours",
    description: "How long a pairing code remains valid",
  },
  {
    category: "Unit Conversions",
    name: "KG to LBS",
    value: "2.20462",
    description: "Kilograms to pounds conversion factor",
  },
  {
    category: "Unit Conversions",
    name: "LBS to KG",
    value: "0.453592",
    description: "Pounds to kilograms conversion factor",
  },
  {
    category: "Unit Conversions",
    name: "Meters to Inches",
    value: "39.3701",
    description: "Meters to inches conversion factor",
  },
  {
    category: "Unit Conversions",
    name: "CM to Inches",
    value: "0.393701",
    description: "Centimeters to inches conversion factor",
  },
  {
    category: "Unit Conversions",
    name: "Inches to CM",
    value: "2.54",
    description: "Inches to centimeters conversion factor",
  },
  {
    category: "BMI Calculation",
    name: "BMI Formula Multiplier",
    value: "703",
    description: "Imperial units constant: BMI = (weight_lbs / height_inches²) × 703",
  },
  {
    category: "BMI Calculation",
    name: "BMI Rounding",
    value: "1 decimal place",
    description: "Display precision for BMI values",
  },
  {
    category: "Test Data",
    name: "Total Test Admins",
    value: "2",
    description: "Number of admin accounts in comprehensive test dataset",
  },
  {
    category: "Test Data",
    name: "Total Test Coaches",
    value: "10",
    description: "Number of coach accounts in comprehensive test dataset",
  },
  {
    category: "Test Data",
    name: "Total Test Clients",
    value: "200",
    description: "Number of client accounts in comprehensive test dataset",
  },
]

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [formData, setFormData] = useState<Partial<SystemSettings>>({})

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdmin(session.user)) {
      if (session.user.roles.includes(Role.COACH)) {
        router.push("/coach-dashboard")
      } else {
        router.push("/client-dashboard")
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user && isAdmin(session.user)) {
      fetchSettings()
    }
  }, [session])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings")
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/")
          return
        }
        throw new Error("Failed to fetch settings")
      }
      const data = await response.json()
      setSettings(data.data)
      setFormData(data.data)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load settings",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: parseInt(value, 10),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save settings")
      }

      const data = await response.json()
      setSettings(data.data)
      setFormData(data.data)
      setMessage({ type: "success", text: "Settings saved successfully!" })
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save settings",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setFormData(settings || {})
    setMessage(null)
  }

  if (loading) {
    return (
      <CoachLayout>
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">Loading settings...</div>
        </div>
      </CoachLayout>
    )
  }

  if (!session || !isAdmin(session.user)) {
    return null
  }

  // Group technical constants by category
  const constantsByCategory = TECHNICAL_CONSTANTS.reduce(
    (acc, constant) => {
      if (!acc[constant.category]) {
        acc[constant.category] = []
      }
      acc[constant.category].push(constant)
      return acc
    },
    {} as Record<string, TechnicalConstant[]>
  )

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-neutral-900 mb-8">System Settings</h1>

        {message && (
          <div
            className={`mb-8 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid gap-8">
          {/* Editable Settings Section */}
          <div className="bg-white rounded-lg border border-neutral-200 p-8">
            <div className="mb-6 pb-6 border-b border-neutral-200">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Customer-Facing Configuration</h2>
              <p className="text-neutral-600">
                Modify these values to adjust engagement thresholds and coach capacity limits
              </p>
            </div>

            <div className="space-y-8">
              {/* Coach Capacity */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Coach Capacity Management</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Max Clients per Coach
                    </label>
                    <input
                      type="number"
                      name="maxClientsPerCoach"
                      value={formData.maxClientsPerCoach || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Coaches above this are flagged as overloaded</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Min Clients per Coach
                    </label>
                    <input
                      type="number"
                      name="minClientsPerCoach"
                      value={formData.minClientsPerCoach || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Coaches below this are flagged as underutilized</p>
                  </div>
                </div>
              </div>

              {/* Engagement & Activity */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Engagement & Activity Tracking</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Recent Activity Days
                    </label>
                    <input
                      type="number"
                      name="recentActivityDays"
                      value={formData.recentActivityDays || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Window for checking recent activity</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Low Engagement Entries
                    </label>
                    <input
                      type="number"
                      name="lowEngagementEntries"
                      value={formData.lowEngagementEntries || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Entries below this (in recent window) triggers alert</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      No Activity Days
                    </label>
                    <input
                      type="number"
                      name="noActivityDays"
                      value={formData.noActivityDays || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Days without entries triggers needs-attention alert</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Critical No Activity Days
                    </label>
                    <input
                      type="number"
                      name="criticalNoActivityDays"
                      value={formData.criticalNoActivityDays || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Days without entries triggers critical alert</p>
                  </div>
                </div>
              </div>

              {/* Analytics Windows */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Analytics Time Windows</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Short-Term Window (Days)
                    </label>
                    <input
                      type="number"
                      name="shortTermWindowDays"
                      value={formData.shortTermWindowDays || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Used for calculating recent averages</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Long-Term Window (Days)
                    </label>
                    <input
                      type="number"
                      name="longTermWindowDays"
                      value={formData.longTermWindowDays || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Used for calculating long-term averages</p>
                  </div>
                </div>
              </div>

              {/* Admin Override */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Admin Override (Emergency Access)</h3>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Admin Override Email
                  </label>
                  <input
                    type="email"
                    name="adminOverrideEmail"
                    value={formData.adminOverrideEmail || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, adminOverrideEmail: e.target.value || null }))}
                    placeholder="email@example.com (leave empty to disable)"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Backdoor access: User with this email gets automatic admin rights (use for emergency access only)
                  </p>
                  <p className="text-xs text-neutral-600 mt-2">
                    💡 Alternative: Set <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs">ADMIN_OVERRIDE_EMAIL</code> environment variable in your deployment config for emergency access when database is inaccessible.
                  </p>
                </div>
              </div>

              {/* Feature Flags */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Feature Flags</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        name="healthkitEnabled"
                        checked={formData.healthkitEnabled ?? true}
                        onChange={(e) => setFormData((prev) => ({ ...prev, healthkitEnabled: e.target.checked }))}
                        className="w-4 h-4 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="ml-3">
                      <label className="block text-sm font-medium text-neutral-700">
                        Enable HealthKit Data Features
                      </label>
                      <p className="text-xs text-neutral-500 mt-1">
                        Show/hide HealthKit data explorer and related UI elements for coaches
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        name="iosIntegrationEnabled"
                        checked={formData.iosIntegrationEnabled ?? true}
                        onChange={(e) => setFormData((prev) => ({ ...prev, iosIntegrationEnabled: e.target.checked }))}
                        className="w-4 h-4 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="ml-3">
                      <label className="block text-sm font-medium text-neutral-700">
                        Enable iOS Integration Features
                      </label>
                      <p className="text-xs text-neutral-500 mt-1">
                        Show/hide pairing code generation and iOS device sync features
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-6 py-2 bg-neutral-200 text-neutral-900 rounded-md hover:bg-neutral-300 disabled:opacity-50 font-medium"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Technical Reference Section */}
          <div className="bg-white rounded-lg border border-neutral-200 p-8">
            <div className="mb-6 pb-6 border-b border-neutral-200">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Technical Reference (Read-Only)</h2>
              <p className="text-neutral-600">
                These constants are hardcoded and should not be changed without code updates
              </p>
            </div>

            <div className="space-y-8">
              {Object.entries(constantsByCategory).map(([category, constants]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">{category}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200">
                          <th className="text-left py-3 px-4 font-semibold text-neutral-900">Constant</th>
                          <th className="text-left py-3 px-4 font-semibold text-neutral-900">Value</th>
                          <th className="text-left py-3 px-4 font-semibold text-neutral-900">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {constants.map((constant, idx) => (
                          <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                            <td className="py-3 px-4 text-neutral-900 font-medium">{constant.name}</td>
                            <td className="py-3 px-4 text-neutral-700 font-mono text-sm">{constant.value}</td>
                            <td className="py-3 px-4 text-neutral-600 text-sm">{constant.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}
