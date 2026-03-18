"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard which will handle role-based routing
    router.push("/dashboard")
  }, [router])

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-gray-50 overflow-y-auto">
      <div className="text-gray-600">Redirecting...</div>
    </div>
  )
}
