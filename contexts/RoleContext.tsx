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

  const inferRoleFromPath = (path: string | null) => {
    if (!path) return null
    if (path.startsWith("/admin")) return Role.ADMIN
    if (path.startsWith("/coach-dashboard") || path.startsWith("/clients") || path.startsWith("/cohorts")) {
      return Role.COACH
    }
    if (path.startsWith("/client-dashboard")) return Role.CLIENT
    return null
  }

  // Initialize active role from path/localStorage/default
  useEffect(() => {
    if (!session?.user?.roles || session.user.roles.length === 0) {
      setActiveRoleState(null)
      return
    }

    const inferredRole = inferRoleFromPath(pathname)
    const stored = localStorage.getItem("activeRole")
    const storedRole = stored && session.user.roles.includes(stored as Role) ? (stored as Role) : null

    const priority = [Role.CLIENT, Role.COACH, Role.ADMIN]
    const defaultRole = priority.find((role) => session.user.roles.includes(role)) || session.user.roles[0]
    const nextRole = (inferredRole && session.user.roles.includes(inferredRole)) ? inferredRole : (storedRole || defaultRole)

    if (activeRole !== nextRole) {
      setActiveRoleState(nextRole)
      localStorage.setItem("activeRole", nextRole)
    }
  }, [session, pathname, activeRole])

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
