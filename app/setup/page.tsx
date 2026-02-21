"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnvCheck {
  name: string
  status: "pass" | "fail" | "warn"
  message: string
}

type SetupStep = "loading" | "environment" | "database" | "admin" | "organisation" | "review"

// ─── Step Components ─────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: SetupStep }) {
  const steps: { key: SetupStep; label: string; number: number }[] = [
    { key: "environment", label: "Environment", number: 1 },
    { key: "database", label: "Database", number: 2 },
    { key: "admin", label: "Admin Account", number: 3 },
    { key: "organisation", label: "Organisation", number: 4 },
    { key: "review", label: "Review", number: 5 },
  ]

  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <nav aria-label="Setup progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <li key={step.key} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  isComplete
                    ? "bg-green-600 text-white"
                    : isCurrent
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {isComplete ? "✓" : step.number}
              </div>
              <span
                className={`hidden sm:inline text-sm ${
                  isCurrent ? "font-semibold text-gray-900" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`w-6 sm:w-12 h-0.5 ${
                    isComplete ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function EnvironmentStep({
  onNext,
}: {
  onNext: () => void
}) {
  const [checks, setChecks] = useState<EnvCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [allPassed, setAllPassed] = useState(false)

  const runChecks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/setup/check-env")
      const data = await res.json()
      setChecks(data.checks || [])
      setAllPassed(data.allPassed || false)
    } catch {
      setChecks([
        {
          name: "CONNECTION",
          status: "fail",
          message: "Cannot reach the server. Please check your deployment.",
        },
      ])
      setAllPassed(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    runChecks()
  }, [runChecks])

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Environment Check</h2>
      <p className="text-gray-600 mb-6">
        Verifying your environment configuration and database connectivity.
      </p>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-500 py-8">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Running checks...
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {checks.map((check) => (
            <div
              key={check.name}
              className={`p-4 rounded-lg border ${
                check.status === "pass"
                  ? "bg-green-50 border-green-200"
                  : check.status === "warn"
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌"}
                </span>
                <div>
                  <p className="font-medium text-sm text-gray-900">{check.name}</p>
                  <p className="text-sm text-gray-600">{check.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={runChecks}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Re-check
        </button>
        <button
          onClick={onNext}
          disabled={!allPassed}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>

      {!allPassed && !loading && (
        <p className="mt-3 text-sm text-red-600">
          Fix the failing checks above before continuing. Warnings can be addressed later.
        </p>
      )}
    </div>
  )
}

function DatabaseStep({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seedDatabase = useCallback(async () => {
    setSeeding(true)
    setError(null)
    try {
      const res = await fetch("/api/setup/seed", { method: "POST" })
      const data = await res.json()
      if (res.ok && data.success) {
        setSeeded(true)
      } else {
        setError(data.error || "Failed to seed database")
      }
    } catch {
      setError("Failed to connect to the server")
    } finally {
      setSeeding(false)
    }
  }, [])

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Database Setup</h2>
      <p className="text-gray-600 mb-6">
        Initialize your database with default system settings and configuration.
      </p>

      {seeded ? (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">✅</span>
            <p className="text-sm text-green-800">
              Database initialized successfully with default settings.
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            This will create the default system settings row with sensible defaults.
            You can customize all settings later from the admin dashboard.
          </p>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm mb-4">
              {error}
            </div>
          )}
          <button
            onClick={seedDatabase}
            disabled={seeding}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {seeding ? "Initializing..." : "Initialize Database"}
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!seeded}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function AdminStep({
  onNext,
  onBack,
  onAdminCreated,
}: {
  onNext: () => void
  onBack: () => void
  onAdminCreated: (admin: { name: string; email: string }) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setValidationErrors([])

      // Client-side validation
      const errors: string[] = []
      if (password !== confirmPassword) {
        errors.push("Passwords do not match")
      }
      if (password.length < 12) {
        errors.push("Password must be at least 12 characters")
      }
      if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain at least one uppercase letter")
      }
      if (!/[a-z]/.test(password)) {
        errors.push("Password must contain at least one lowercase letter")
      }
      if (!/[0-9]/.test(password)) {
        errors.push("Password must contain at least one number")
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push("Password must contain at least one special character")
      }
      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch("/api/setup/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setCreated(true)
          onAdminCreated({ name, email })
        } else if (data.details) {
          setValidationErrors(
            data.details.map((d: { message: string }) => d.message)
          )
        } else {
          setError(data.error || "Failed to create admin")
        }
      } catch {
        setError("Failed to connect to the server")
      } finally {
        setSubmitting(false)
      }
    },
    [name, email, password, confirmPassword, onAdminCreated]
  )

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Create Admin Account</h2>
      <p className="text-gray-600 mb-6">
        Create the first administrator account. This user will have full access to manage the platform.
      </p>

      {created ? (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-sm font-medium text-green-800">Admin account created</p>
              <p className="text-sm text-green-700">{email}</p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
              {error}
            </div>
          )}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g. John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="admin@yourdomain.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Min 12 chars, uppercase, lowercase, number, special"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Re-enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Admin Account"}
          </button>
        </form>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!created}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Athens",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
]

function OrganisationStep({
  onNext,
  onBack,
  onOrgSaved,
}: {
  onNext: () => void
  onBack: () => void
  onOrgSaved: (org: { name: string; timezone: string; unitSystem: string }) => void
}) {
  const [orgName, setOrgName] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [unitSystem, setUnitSystem] = useState("metric")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setSubmitting(true)

      try {
        const res = await fetch("/api/setup/organisation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organisationName: orgName,
            timezone,
            unitSystem,
          }),
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setSaved(true)
          onOrgSaved({ name: orgName, timezone, unitSystem })
        } else {
          setError(data.error || "Failed to save settings")
        }
      } catch {
        setError("Failed to connect to the server")
      } finally {
        setSubmitting(false)
      }
    },
    [orgName, timezone, unitSystem, onOrgSaved]
  )

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Organisation Settings</h2>
      <p className="text-gray-600 mb-6">
        Configure your organisation details. These can be changed later in admin settings.
      </p>

      {saved ? (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-lg">✅</span>
            <p className="text-sm text-green-800">Organisation settings saved</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organisation Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="e.g. My Coaching Business"
            />
            <p className="mt-1 text-xs text-gray-500">Used in emails and the app header</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit System</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="unitSystem"
                  value="metric"
                  checked={unitSystem === "metric"}
                  onChange={(e) => setUnitSystem(e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Metric (kg, km)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="unitSystem"
                  value="imperial"
                  checked={unitSystem === "imperial"}
                  onChange={(e) => setUnitSystem(e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Imperial (lbs, mi)</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Organisation Settings"}
          </button>
        </form>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!saved}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function ReviewStep({
  adminInfo,
  orgInfo,
  onBack,
  onComplete,
}: {
  adminInfo: { name: string; email: string } | null
  orgInfo: { name: string; timezone: string; unitSystem: string } | null
  onBack: () => void
  onComplete: () => void
}) {
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleComplete = useCallback(async () => {
    setError(null)
    setCompleting(true)
    try {
      const res = await fetch("/api/setup/complete", { method: "POST" })
      const data = await res.json()
      if (res.ok && data.success) {
        onComplete()
      } else {
        setError(data.error || "Failed to complete setup")
      }
    } catch {
      setError("Failed to connect to the server")
    } finally {
      setCompleting(false)
    }
  }, [onComplete])

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Review & Finalise</h2>
      <p className="text-gray-600 mb-6">
        Review your configuration and complete the setup.
      </p>

      <div className="space-y-4 mb-6">
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">✅ Environment</h3>
          <p className="text-sm text-gray-600">All required checks passed</p>
        </div>

        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">✅ Database</h3>
          <p className="text-sm text-gray-600">System settings initialized</p>
        </div>

        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">✅ Admin Account</h3>
          {adminInfo ? (
            <div className="text-sm text-gray-600">
              <p>{adminInfo.name}</p>
              <p className="text-gray-500">{adminInfo.email}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Admin account created</p>
          )}
        </div>

        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">✅ Organisation</h3>
          {orgInfo ? (
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="text-gray-500">Name:</span> {orgInfo.name}</p>
              <p><span className="text-gray-500">Timezone:</span> {orgInfo.timezone}</p>
              <p><span className="text-gray-500">Units:</span> {orgInfo.unitSystem === "metric" ? "Metric (kg, km)" : "Imperial (lbs, mi)"}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Organisation configured</p>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleComplete}
          disabled={completing}
          className="px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {completing ? "Completing Setup..." : "Complete Setup"}
        </button>
      </div>
    </div>
  )
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<SetupStep>("loading")
  const [adminInfo, setAdminInfo] = useState<{ name: string; email: string } | null>(null)
  const [orgInfo, setOrgInfo] = useState<{ name: string; timezone: string; unitSystem: string } | null>(null)

  // On mount, check if setup is already complete
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/setup/status")
        const data = await res.json()
        if (data.setupComplete) {
          // Setup already done — redirect to login
          router.replace("/login")
        } else {
          setStep("environment")
        }
      } catch {
        // If we can't check, show the wizard
        setStep("environment")
      }
    }
    checkStatus()
  }, [router])

  const handleComplete = useCallback(() => {
    router.push("/login")
  }, [router])

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Checking setup status...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CoachFit Setup</h1>
          <p className="text-gray-600">
            Welcome! Let&apos;s get your CoachFit instance up and running.
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Step Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          {step === "environment" && (
            <EnvironmentStep onNext={() => setStep("database")} />
          )}
          {step === "database" && (
            <DatabaseStep
              onNext={() => setStep("admin")}
              onBack={() => setStep("environment")}
            />
          )}
          {step === "admin" && (
            <AdminStep
              onNext={() => setStep("organisation")}
              onBack={() => setStep("database")}
              onAdminCreated={setAdminInfo}
            />
          )}
          {step === "organisation" && (
            <OrganisationStep
              onNext={() => setStep("review")}
              onBack={() => setStep("admin")}
              onOrgSaved={setOrgInfo}
            />
          )}
          {step === "review" && (
            <ReviewStep
              adminInfo={adminInfo}
              orgInfo={orgInfo}
              onBack={() => setStep("organisation")}
              onComplete={handleComplete}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          CoachFit Installation Wizard
        </p>
      </div>
    </div>
  )
}
