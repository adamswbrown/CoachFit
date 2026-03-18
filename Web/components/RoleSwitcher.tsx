"use client"

import { useState, useRef, useEffect } from "react"
import { useRole } from "@/contexts/RoleContext"
import { Role } from "@/lib/types"
import { useRouter } from "next/navigation"

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

export function RoleSwitcher() {
  const { activeRole, availableRoles, setActiveRole } = useRole()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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

  // Only show if user has multiple roles
  if (availableRoles.length <= 1) {
    return null
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

  if (!activeRole) return null

  const currentConfig = roleConfig[activeRole]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
      >
        <span>{currentConfig.icon}</span>
        <span>{currentConfig.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 w-auto sm:w-64 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-w-sm mx-auto sm:mx-0">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase">
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
                  <span className="text-xl">{config.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{config.label}</div>
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
        </div>
      )}
    </div>
  )
}
