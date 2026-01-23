"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { EmailEditor } from "@/components/admin/EmailEditor"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "@/lib/legal-content"

const DEFAULT_SETTINGS: Omit<SystemSettings, "id"> = {
  maxClientsPerCoach: 50,
  minClientsPerCoach: 10,
  recentActivityDays: 14,
  lowEngagementEntries: 7,
  noActivityDays: 14,
  criticalNoActivityDays: 30,
  shortTermWindowDays: 7,
  longTermWindowDays: 30,
  defaultCheckInFrequencyDays: 7,
  notificationTimeUtc: "09:00",
  adminOverrideEmail: null,
  healthkitEnabled: true,
  iosIntegrationEnabled: true,
  adherenceGreenMinimum: 6,
  adherenceAmberMinimum: 3,
  attentionMissedCheckinsPolicy: "option_a",
  bodyFatLowPercent: 12.5,
  bodyFatMediumPercent: 20.0,
  bodyFatHighPercent: 30.0,
  bodyFatVeryHighPercent: 37.5,
  minDailyCalories: 1000,
  maxDailyCalories: 5000,
  minProteinPerLb: 0.4,
  maxProteinPerLb: 2.0,
  defaultCarbsPercent: 40,
  defaultProteinPercent: 30,
  defaultFatPercent: 30,
  stepsNotMuch: 5000,
  stepsLight: 7500,
  stepsModerate: 10000,
  stepsHeavy: 12500,
  workoutNotMuch: 75,
  workoutLight: 150,
  workoutModerate: 225,
  workoutHeavy: 300,
  showPersonalizedPlan: true,
  termsContentHtml: DEFAULT_TERMS_HTML,
  privacyContentHtml: DEFAULT_PRIVACY_HTML,
  dataProcessingContentHtml: DEFAULT_DATA_PROCESSING_HTML,
}

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
  defaultCheckInFrequencyDays: number
  notificationTimeUtc: string
  adminOverrideEmail: string | null
  healthkitEnabled: boolean
  iosIntegrationEnabled: boolean
  adherenceGreenMinimum: number
  adherenceAmberMinimum: number
  attentionMissedCheckinsPolicy: "option_a" | "option_b"
  bodyFatLowPercent: number
  bodyFatMediumPercent: number
  bodyFatHighPercent: number
  bodyFatVeryHighPercent: number
  minDailyCalories: number
  maxDailyCalories: number
  minProteinPerLb: number
  maxProteinPerLb: number
  defaultCarbsPercent: number
  defaultProteinPercent: number
  defaultFatPercent: number
  stepsNotMuch: number
  stepsLight: number
  stepsModerate: number
  stepsHeavy: number
  workoutNotMuch: number
  workoutLight: number
  workoutModerate: number
  workoutHeavy: number
  showPersonalizedPlan: boolean
  termsContentHtml: string
  privacyContentHtml: string
  dataProcessingContentHtml: string
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
  const [randomizing, setRandomizing] = useState(false)
  const [randomizeProgress, setRandomizeProgress] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [formData, setFormData] = useState<Partial<SystemSettings>>(DEFAULT_SETTINGS)

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
      const merged = { ...DEFAULT_SETTINGS, ...(data?.data || {}) }
      setSettings(merged as SystemSettings)
      setFormData(merged)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load settings",
      })
      setFormData(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }

  const normalizeTimeUtc = (raw: string) => {
    if (!raw) return undefined
    const trimmed = raw.trim()
    const withSeconds = trimmed.length === 8 ? trimmed.slice(0, 5) : trimmed
    if (/^\d:\d{2}$/.test(withSeconds)) {
      return `0${withSeconds}`
    }
    if (/^\d{2}:\d{2}$/.test(withSeconds)) {
      return withSeconds
    }
    return withSeconds
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === "notificationTimeUtc") {
      const normalized = normalizeTimeUtc(value)
      setFormData((prev) => ({
        ...prev,
        [name]: normalized,
      }))
      return
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? undefined : parseFloat(value),
    }))
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const payload = {
        ...formData,
        notificationTimeUtc: normalizeTimeUtc(formData.notificationTimeUtc || ""),
      }
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    setFormData(settings || DEFAULT_SETTINGS)
    setMessage(null)
  }

  const handleRandomizeCheckins = async () => {
    if (!confirm("This will randomize check-in data for all clients. Continue?")) {
      return
    }

    setRandomizing(true)
    setRandomizeProgress("Starting randomization...")
    setMessage(null)

    try {
      setRandomizeProgress("Fetching all clients...")
      
      const response = await fetch("/api/admin/randomize-checkins", {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to randomize check-ins")
      }

      setRandomizeProgress("Processing data...")
      const data = await response.json()
      
      setRandomizeProgress("Complete!")
      setTimeout(() => setRandomizeProgress(null), 2000)
      
      setMessage({ 
        type: "success", 
        text: `✅ Randomized ${data.totalClients} clients: ${data.distribution.active} active, ${data.distribution.good} good, ${data.distribution.moderate} moderate, ${data.distribution.needsAttention} needs attention, ${data.distribution.offline} offline`
      })
    } catch (error) {
      setRandomizeProgress(null)
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to randomize check-ins",
      })
    } finally {
      setRandomizing(false)
    }
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

              {/* Check-in Defaults */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Check-in Defaults & Reminders</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Default Check-in Frequency (Days)
                    </label>
                    <input
                      type="number"
                      name="defaultCheckInFrequencyDays"
                      min={1}
                      max={365}
                      value={formData.defaultCheckInFrequencyDays || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Used when no user or cohort override is set</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Reminder Send Time (UTC)
                    </label>
                    <input
                      type="time"
                      name="notificationTimeUtc"
                      value={formData.notificationTimeUtc || "09:00"}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">All reminders send at this UTC time</p>
                  </div>
                </div>
              </div>

              {/* Adherence Thresholds */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Adherence Thresholds (Weekly Check-ins)</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Green (On Track) Minimum
                    </label>
                    <input
                      type="number"
                      name="adherenceGreenMinimum"
                      min={1}
                      max={7}
                      value={formData.adherenceGreenMinimum ?? ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Required check-ins per week to show ✅ ON TRACK</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Amber (Attention) Minimum
                    </label>
                    <input
                      type="number"
                      name="adherenceAmberMinimum"
                      min={0}
                      max={6}
                      value={formData.adherenceAmberMinimum ?? ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Minimum check-ins before dropping to 🔴 PRIORITY</p>
                    <p className="text-xs text-amber-600 mt-1">Amber minimum must be less than Green minimum</p>
                  </div>
                </div>
              </div>

              {/* Attention Policy */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Attention Policy (Weekly Missed Check-ins)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Missed Check-in Severity
                    </label>
                    <select
                      name="attentionMissedCheckinsPolicy"
                      value={formData.attentionMissedCheckinsPolicy ?? "option_a"}
                      onChange={handleSelectChange}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="option_a">Option A (Default)</option>
                      <option value="option_b">Option B (Strict)</option>
                    </select>
                    <p className="text-xs text-neutral-500 mt-1">
                      Option A: missed 2+ = red, missed 1 = amber, missed 0 = green.
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Option B: missed 1+ = red, missed 0 = green.
                    </p>
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

              {/* Onboarding Configuration */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Onboarding Configuration</h3>
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        name="showPersonalizedPlan"
                        checked={formData.showPersonalizedPlan ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            showPersonalizedPlan: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="ml-3">
                      <label className="block text-sm font-medium text-neutral-700">
                        Show personalized plan during onboarding
                      </label>
                      <p className="text-xs text-neutral-500 mt-1">
                        When off, clients skip the plan review and finish onboarding with a “Let’s get started” button.
                      </p>
                    </div>
                  </div>

                  {/* Body Fat Percentages */}
                  <div>
                    <p className="text-sm font-medium text-neutral-700 mb-3">Body Fat Range Percentages</p>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Low Body Fat %
                        </label>
                        <input
                          type="number"
                          name="bodyFatLowPercent"
                          value={formData.bodyFatLowPercent || ""}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Midpoint for "Low" body fat range</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Medium Body Fat %
                        </label>
                        <input
                          type="number"
                          name="bodyFatMediumPercent"
                          value={formData.bodyFatMediumPercent || ""}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Midpoint for "Medium" body fat range</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          High Body Fat %
                        </label>
                        <input
                          type="number"
                          name="bodyFatHighPercent"
                          value={formData.bodyFatHighPercent || ""}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Midpoint for "High" body fat range</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Very High Body Fat %
                        </label>
                        <input
                          type="number"
                          name="bodyFatVeryHighPercent"
                          value={formData.bodyFatVeryHighPercent || ""}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Midpoint for "Very High" body fat range</p>
                      </div>
                    </div>
                  </div>

                  {/* Calorie Range */}
                  <div>
                    <p className="text-sm font-medium text-neutral-700 mb-3">Daily Calorie Limits</p>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Min Daily Calories
                        </label>
                        <input
                          type="number"
                          name="minDailyCalories"
                          value={formData.minDailyCalories || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Minimum allowed daily calories (kcal)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Max Daily Calories
                        </label>
                        <input
                          type="number"
                          name="maxDailyCalories"
                          value={formData.maxDailyCalories || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Maximum allowed daily calories (kcal)</p>
                      </div>
                    </div>
                  </div>

                  {/* Protein Range */}
                  <div>
                    <p className="text-sm font-medium text-neutral-700 mb-3">Daily Protein (per lb of body weight)</p>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Min Protein per Lb
                        </label>
                        <input
                          type="number"
                          name="minProteinPerLb"
                          value={formData.minProteinPerLb || ""}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Minimum protein per lb (0.4-0.8g typical)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Max Protein per Lb
                        </label>
                        <input
                          type="number"
                          name="maxProteinPerLb"
                          value={formData.maxProteinPerLb || ""}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Maximum protein per lb (1.5-2.2g typical)</p>
                      </div>
                    </div>
                  </div>

                  {/* Macro Defaults */}
                  <div>
                    <p className="text-sm font-medium text-neutral-700 mb-3">Default Macro Distribution (%)</p>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Carbs %
                        </label>
                        <input
                          type="number"
                          name="defaultCarbsPercent"
                          value={formData.defaultCarbsPercent || ""}
                          onChange={handleInputChange}
                          min="0"
                          max="100"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Default carbohydrate percentage</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Protein %
                        </label>
                        <input
                          type="number"
                          name="defaultProteinPercent"
                          value={formData.defaultProteinPercent || ""}
                          onChange={handleInputChange}
                          min="0"
                          max="100"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Default protein percentage</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Fat %
                        </label>
                        <input
                          type="number"
                          name="defaultFatPercent"
                          value={formData.defaultFatPercent || ""}
                          onChange={handleInputChange}
                          min="0"
                          max="100"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Default fat percentage</p>
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 mt-3">
                      ⚠️ Percentages should sum to 100 for valid default distribution
                    </p>
                  </div>

                  {/* Activity Target Defaults */}
                  <div className="border-t border-neutral-200 pt-6">
                    <h3 className="text-base font-semibold text-neutral-900 mb-4">Activity Target Defaults by Level</h3>
                    <p className="text-sm text-neutral-600 mb-6">
                      Configure default daily steps and weekly workout minutes based on user's selected activity level
                    </p>

                    {/* Daily Steps Targets */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-neutral-700 mb-3">Default Daily Steps Target</p>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Not Much
                          </label>
                          <input
                            type="number"
                            name="stepsNotMuch"
                            value={formData.stepsNotMuch || ""}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-neutral-500 mt-1">Sedentary</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Light
                          </label>
                          <input
                            type="number"
                            name="stepsLight"
                            value={formData.stepsLight || ""}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-neutral-500 mt-1">Some activity</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Moderate
                          </label>
                          <input
                            type="number"
                            name="stepsModerate"
                            value={formData.stepsModerate || ""}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-neutral-500 mt-1">WHO standard</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Heavy
                          </label>
                          <input
                            type="number"
                            name="stepsHeavy"
                            value={formData.stepsHeavy || ""}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-neutral-500 mt-1">Very active</p>
                        </div>
                      </div>
                    </div>

                    {/* Weekly Workout Minutes */}
                    <div>
                      <p className="text-sm font-medium text-neutral-700 mb-3">Default Weekly Workout Minutes</p>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Not Much
                          </label>
                          <input
                            type="number"
                            name="workoutNotMuch"
                            value={formData.workoutNotMuch || ""}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-neutral-500 mt-1">~11 min/day</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Light
                          </label>
                          <input
                            type="number"
                            name="workoutLight"
                            value={formData.workoutLight || ""}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-neutral-500 mt-1">~21 min/day</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Moderate
                          </label>
                          <input
                            type="number"
                            name="workoutModerate"
                            value={formData.workoutModerate || ""}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-neutral-500 mt-1">~32 min/day</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Heavy
                          </label>
                          <input
                            type="number"
                            name="workoutHeavy"
                            value={formData.workoutHeavy || ""}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-neutral-500 mt-1">~43 min/day</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal Content */}
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Legal Content</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Terms of Service
                    </label>
                    <EmailEditor
                      content={formData.termsContentHtml || ""}
                      onChange={(html) =>
                        setFormData((prev) => ({ ...prev, termsContentHtml: html }))
                      }
                      minHeightClassName="min-h-[220px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Privacy Policy
                    </label>
                    <EmailEditor
                      content={formData.privacyContentHtml || ""}
                      onChange={(html) =>
                        setFormData((prev) => ({ ...prev, privacyContentHtml: html }))
                      }
                      minHeightClassName="min-h-[220px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Data Processing Consent
                    </label>
                    <EmailEditor
                      content={formData.dataProcessingContentHtml || ""}
                      onChange={(html) =>
                        setFormData((prev) => ({ ...prev, dataProcessingContentHtml: html }))
                      }
                      minHeightClassName="min-h-[180px]"
                    />
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

          {/* Test Data Actions */}
          <div className="bg-white rounded-lg border border-neutral-200 p-8">
            <div className="mb-6 pb-6 border-b border-neutral-200">
              <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Test Data Actions</h2>
              <p className="text-neutral-600">
                Development and testing utilities
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">Randomize Client Check-ins</h3>
                <p className="text-neutral-600 text-sm mb-4">
                  Generate realistic check-in patterns for all clients. Creates a distribution of active (35%), good (25%), moderate (20%), needs attention (15%), and offline (5%) clients with varied entry patterns over the past 2 weeks.
                </p>
                
                {randomizeProgress && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      <span className="text-sm font-medium text-blue-900">{randomizeProgress}</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: randomizeProgress === "Complete!" ? "100%" : "70%" }}></div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleRandomizeCheckins}
                  disabled={randomizing}
                  className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-medium"
                >
                  {randomizing ? "Randomizing..." : "🎲 Randomize Check-in Status"}
                </button>
              </div>
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
