"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Role } from "@/lib/types"

interface RoleContextType {
  activeRole: Role | null
  availableRoles: Role[]
  setActiveRole: (role: Role) => void
  isInRole: (role: Role) => boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [activeRole, setActiveRoleState] = useState<Role | null>(null)

  // Get available roles from session
  const availableRoles = session?.user?.roles || []

  // Initialize active role from localStorage or default
  useEffect(() => {
    if (!session?.user?.roles || session.user.roles.length === 0) {
      setActiveRoleState(null)
      return
    }

    // Try to restore from localStorage
    const stored = localStorage.getItem("activeRole")
    if (stored && session.user.roles.includes(stored as Role)) {
      setActiveRoleState(stored as Role)
    } else {
      // Default to first role (CLIENT -> COACH -> ADMIN priority)
      const priority = [Role.CLIENT, Role.COACH, Role.ADMIN]
      const defaultRole = priority.find((role) => session.user.roles.includes(role))
      setActiveRoleState(defaultRole || session.user.roles[0])
    }
  }, [session])

  useEffect(() => {
    if (!session?.user?.roles || !pathname) return

    let inferredRole: Role | null = null
    if (pathname.startsWith("/admin")) {
      inferredRole = Role.ADMIN
    } else if (pathname.startsWith("/coach-dashboard") || pathname.startsWith("/clients") || pathname.startsWith("/cohorts")) {
      inferredRole = Role.COACH
    } else if (pathname.startsWith("/client-dashboard")) {
      inferredRole = Role.CLIENT
    }

    if (inferredRole && session.user.roles.includes(inferredRole) && activeRole !== inferredRole) {
      setActiveRoleState(inferredRole)
      localStorage.setItem("activeRole", inferredRole)
    }
  }, [pathname, session, activeRole])

  const setActiveRole = (role: Role) => {
    if (availableRoles.includes(role)) {
      setActiveRoleState(role)
      localStorage.setItem("activeRole", role)
    }
  }

  const isInRole = (role: Role) => {
    return activeRole === role
  }

  return (
    <RoleContext.Provider value={{ activeRole, availableRoles, setActiveRole, isInRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return context
}
