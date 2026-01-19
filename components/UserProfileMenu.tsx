"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRole } from "@/contexts/RoleContext"
import { Role } from "@/lib/types"

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

export function UserProfileMenu({ 
  userName, 
  showRoleSwitcher = false,
  showAdminLink = false 
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
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
    </div>
  )
}
