"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Role } from "@/lib/types"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (status === "loading") return

    if (!session || !session.user) {
      router.push("/login")
      return
    }

    if ((session.user as any).mustChangePassword) {
      router.push("/client-dashboard/settings")
      return
    }

    // Redirect based on role (COACH takes priority over ADMIN)
    const userRoles = session.user.roles || []

    if (userRoles.includes(Role.COACH)) {
      router.push("/coach-dashboard")
    } else if (userRoles.includes(Role.ADMIN)) {
      router.push("/admin")
    } else if (userRoles.includes(Role.CLIENT)) {
      // Check if client has completed onboarding
      const isOnboardingComplete = (session.user as any)?.isOnboardingComplete ?? false
      if (!isOnboardingComplete) {
        // Detect if client was invited (via coach or cohort) to route to the
        // simplified invited onboarding instead of the full self-signup flow.
        if (!checking) {
          setChecking(true)
          fetch("/api/onboarding/detect-state")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              const route = data?.route
              if (route) {
                router.push(route)
              } else {
                router.push("/onboarding/client")
              }
            })
            .catch(() => {
              router.push("/onboarding/client")
            })
        }
      } else {
        router.push("/client-dashboard")
      }
    } else {
      router.push("/login")
    }
  }, [session, status, router, checking])

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-gray-50 overflow-y-auto">
      <div className="text-gray-600">Redirecting...</div>
    </div>
  )
}
