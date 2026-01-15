"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useSession } from "next-auth/react"
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
