"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Role } from "@/lib/types"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    if (!session || !session.user) {
      router.push("/login")
      return
    }

    // Redirect based on role
    const userRoles = session.user.roles || []

    if (userRoles.includes(Role.ADMIN)) {
      router.push("/admin")
    } else if (userRoles.includes(Role.COACH)) {
      router.push("/coach-dashboard")
    } else if (userRoles.includes(Role.CLIENT)) {
      router.push("/client-dashboard")
    } else {
      router.push("/login")
    }
  }, [session, status, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-600">Redirecting...</div>
    </div>
  )
}
