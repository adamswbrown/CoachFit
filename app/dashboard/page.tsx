"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useRole } from "@/contexts/RoleContext"
import { Role } from "@/lib/types"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const { activeRole, setActiveRole } = useRole()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    if (!session || !session.user) {
      router.push("/login")
      return
    }

    // Default to CLIENT role when visiting the root dashboard
    // This ensures users start with their client dashboard
    if (!activeRole || activeRole === Role.ADMIN) {
      const userRoles = session.user.roles || []
      if (userRoles.includes(Role.CLIENT)) {
        setActiveRole(Role.CLIENT)
      }
    }

    // Redirect based on active role from context (respects user's choice)
    if (activeRole === Role.COACH) {
      router.push("/coach-dashboard")
    } else if (activeRole === Role.ADMIN) {
      router.push("/admin")
    } else if (activeRole === Role.CLIENT) {
      router.push("/client-dashboard")
    } else {
      // Fallback: use CLIENT as default priority
      const userRoles = session.user.roles || []
      if (userRoles.includes(Role.CLIENT)) {
        router.push("/client-dashboard")
      } else if (userRoles.includes(Role.COACH)) {
        router.push("/coach-dashboard")
      } else if (userRoles.includes(Role.ADMIN)) {
        router.push("/admin")
      } else {
        router.push("/login")
      }
    }
  }, [session, status, activeRole, router, setActiveRole])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-600">Redirecting...</div>
    </div>
  )
}
