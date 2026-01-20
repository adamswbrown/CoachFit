"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRole } from "@/contexts/RoleContext"
import { Role } from "@/lib/types"
import { ConfirmDialog } from "./ConfirmDialog"
import { UnitToggle } from "./onboarding/UnitToggle"

interface UserProfileMenuProps {
  userName: string
  showRoleSwitcher?: boolean
  showAdminLink?: boolean
}

const roleConfig = {
  [Role.CLIENT]: {
    label: "Client",
    icon: "🏃",
    description: "Track your fitness journey",
    defaultPath: "/client-dashboard",
  },
  [Role.COACH]: {
    label: "Coach",
    icon: "🎯",
    description: "Manage clients and cohorts",
    defaultPath: "/coach-dashboard",
  },
  [Role.ADMIN]: {
    label: "Admin",
    icon: "⚙️",
    description: "Platform administration",
    defaultPath: "/admin",
  },
}

const dateFormatOptions = [
  "MM/dd/yyyy",
  "dd/MM/yyyy",
  "dd-MMM-yyyy",
  "yyyy-MM-dd",
  "MMM dd, yyyy",
] as const

export function UserProfileMenu({ 
  userName, 
  showRoleSwitcher = false,
  showAdminLink = false 
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState("")
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false)
  const [prefError, setPrefError] = useState("")
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)
  const [isPrefLoading, setIsPrefLoading] = useState(false)
  const [prefLoaded, setPrefLoaded] = useState(false)
  const [preferenceForm, setPreferenceForm] = useState({
    weightUnit: "lbs" as "lbs" | "kg",
    measurementUnit: "inches" as "inches" | "cm",
    dateFormat: dateFormatOptions[0] as (typeof dateFormatOptions)[number],
  })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { activeRole, availableRoles, setActiveRole } = useRole()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Get initials from name
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const handleRoleSwitch = (role: Role) => {
    setActiveRole(role)
    setIsOpen(false)

    // Navigate to the default path for the new role
    const config = roleConfig[role]
    if (config?.defaultPath) {
      router.push(config.defaultPath)
    }
  }

  const showRoles = showRoleSwitcher && availableRoles && availableRoles.length > 1
  const showClientActions = availableRoles?.includes(Role.CLIENT)

  useEffect(() => {
    const fetchPreferences = async () => {
      setIsPrefLoading(true)
      try {
        const res = await fetch("/api/onboarding/preferences")
        if (!res.ok) return
        const body = await res.json()
        const pref = body?.data?.preference
        if (!pref) return

        setPreferenceForm({
          weightUnit: (pref.weightUnit as "lbs" | "kg") ?? "lbs",
          measurementUnit: (pref.measurementUnit as "inches" | "cm") ?? "inches",
          dateFormat: (pref.dateFormat as (typeof dateFormatOptions)[number]) ?? dateFormatOptions[0],
        })
        setPrefLoaded(true)
      } catch (error) {
        console.error("Failed to fetch preferences", error)
      } finally {
        setIsPrefLoading(false)
      }
    }

    if (isPrefModalOpen && !prefLoaded) {
      void fetchPreferences()
    }
  }, [isPrefModalOpen, prefLoaded])

  const handleResetOnboarding = async () => {
    setResetError("")
    setIsResetting(true)

    try {
      const res = await fetch("/api/onboarding/reset", { method: "POST" })
      if (!res.ok) {
        throw new Error("Failed to reset onboarding")
      }

      setIsResetDialogOpen(false)
      setIsOpen(false)
      router.push("/onboarding/client")
      router.refresh()
    } catch (error) {
      setResetError("Could not reset onboarding. Please try again.")
    } finally {
      setIsResetting(false)
    }
  }

  const handleSavePreferences = async () => {
    setPrefError("")
    setIsSavingPrefs(true)

    try {
      const res = await fetch("/api/onboarding/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferenceForm),
      })

      if (!res.ok) {
        throw new Error("Failed to save preferences")
      }

      setIsPrefModalOpen(false)
      setIsOpen(false)
      router.refresh()
    } catch (error) {
      setPrefError("Could not save preferences. Please try again.")
    } finally {
      setIsSavingPrefs(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 sm:px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
        aria-label="User menu"
      >
        {/* Avatar circle with initials */}
        <div className="w-7 h-7 rounded-full bg-neutral-700 text-white flex items-center justify-center text-xs font-semibold">
          {getInitials(userName)}
        </div>
        {/* Name - hidden on mobile */}
        <span className="hidden md:inline">{userName}</span>
        {/* Dropdown arrow */}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-neutral-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {/* User info header */}
            <div className="px-3 py-2 border-b border-neutral-100">
              <div className="font-medium text-neutral-900 text-sm">{userName}</div>
            </div>

            {/* Role Switcher if enabled */}
            {showRoles && activeRole && (
              <div className="py-2 border-b border-neutral-100">
                <div className="px-3 py-1 text-xs font-semibold text-neutral-500 uppercase">
                  Switch Role
                </div>
                {availableRoles.map((role) => {
                  const config = roleConfig[role]
                  const isActive = role === activeRole

                  return (
                    <button
                      key={role}
                      onClick={() => handleRoleSwitch(role)}
                      className={`w-full flex items-start gap-3 px-3 py-2 rounded-md transition-colors ${
                        isActive
                          ? "bg-neutral-100 text-neutral-900"
                          : "hover:bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      <span className="text-lg">{config.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm">{config.label}</div>
                        <div className="text-xs text-neutral-500">{config.description}</div>
                      </div>
                      {isActive && (
                        <svg className="w-5 h-5 text-neutral-900" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/client-dashboard/settings"
                onClick={() => setIsOpen(false)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  pathname === "/client-dashboard/settings"
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span className="text-lg">🔧</span>
                <span>Settings</span>
              </Link>

              {showClientActions && (
                <>
                  <button
                    onClick={() => {
                      setResetError("")
                      setIsResetDialogOpen(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-lg">♻️</span>
                    <span>Reset onboarding</span>
                  </button>

                  <button
                    onClick={() => {
                      setPrefError("")
                      setIsPrefModalOpen(true)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-lg">📏</span>
                    <span>Units & dates</span>
                  </button>
                </>
              )}

              {showAdminLink && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    pathname.startsWith("/admin")
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <span className="text-lg">👤</span>
                  <span>Admin</span>
                </Link>
              )}
            </div>

            {/* Sign out */}
            <div className="pt-2 border-t border-neutral-100">
              <button
                onClick={() => {
                  setIsOpen(false)
                  signOut({ callbackUrl: "/login" })
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <span className="text-lg">🚪</span>
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={isResetDialogOpen}
        title="Reset onboarding?"
        message="You'll restart the onboarding flow and replace your current plan. Unit preferences are kept."
        confirmText="Yes, reset"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleResetOnboarding}
        onCancel={() => {
          if (!isResetting) setIsResetDialogOpen(false)
        }}
        isLoading={isResetting}
      />

      {isResetDialogOpen && resetError && (
        <div className="fixed inset-0 flex items-end justify-center pb-6 pointer-events-none">
          <div className="bg-red-600 text-white text-sm px-4 py-2 rounded shadow pointer-events-auto">
            {resetError}
          </div>
        </div>
      )}

      {isPrefModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Units & date format</h2>
                <p className="text-sm text-neutral-600 mt-1">Applies to dashboards and onboarding.</p>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-neutral-800">Weight</div>
                {isPrefLoading ? (
                  <div className="text-sm text-neutral-500">Loading preferences...</div>
                ) : (
                  <UnitToggle
                    unit1="lbs"
                    unit1Label="lbs"
                    unit2="kg"
                    unit2Label="kg"
                    value={preferenceForm.weightUnit}
                    onChange={(value) => setPreferenceForm((prev) => ({ ...prev, weightUnit: value as "lbs" | "kg" }))}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-neutral-800">Measurements</div>
                {isPrefLoading ? (
                  <div className="text-sm text-neutral-500">Loading preferences...</div>
                ) : (
                  <UnitToggle
                    unit1="inches"
                    unit1Label="inches"
                    unit2="cm"
                    unit2Label="cm"
                    value={preferenceForm.measurementUnit}
                    onChange={(value) => setPreferenceForm((prev) => ({ ...prev, measurementUnit: value as "inches" | "cm" }))}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-neutral-800">Date format</div>
                <div className="grid grid-cols-2 gap-2">
                  {dateFormatOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => setPreferenceForm((prev) => ({ ...prev, dateFormat: option }))}
                      className={`text-sm border rounded-md px-3 py-2 text-left transition-colors ${
                        preferenceForm.dateFormat === option
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-neutral-200 hover:border-blue-500 hover:text-blue-700"
                      } ${isPrefLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                      disabled={isPrefLoading}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {prefError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {prefError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    if (!isSavingPrefs) setIsPrefModalOpen(false)
                  }}
                  className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors disabled:opacity-50"
                  disabled={isSavingPrefs}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                  disabled={isSavingPrefs || isPrefLoading}
                >
                  {isSavingPrefs ? "Saving..." : "Save preferences"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
