"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/lib/auth-client"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { isAdmin } from "@/lib/permissions"
import { UserProfileMenu } from "@/components/UserProfileMenu"

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [hasChallenge, setHasChallenge] = useState(true) // optimistic — show by default
  const [challengeCheckDone, setChallengeCheckDone] = useState(false)

  useEffect(() => {
    const checkChallenges = async () => {
      try {
        const res = await fetch("/api/challenges/active", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data) ? data : data.challenges ?? []
          setHasChallenge(items.length > 0)
        }
      } catch {
        // On error, keep showing (optimistic)
      } finally {
        setChallengeCheckDone(true)
      }
    }

    if (session?.user) {
      checkChallenges()
    }
  }, [session?.user])

  if (!session) return null

  const firstName = session?.user?.name?.split(" ")[0] || "there"

  const tabs = [
    { name: "Dashboard", href: "/client-dashboard" },
    { name: "Classes", href: "/client-dashboard/classes" },
    ...(hasChallenge || !challengeCheckDone ? [{ name: "Challenges", href: "/client-dashboard/challenges" }] : []),
    { name: "Credits", href: "/client-dashboard/credits" },
    { name: "Settings", href: "/client-dashboard/settings" },
  ]

  return (
    <div className="min-h-screen min-h-[100dvh] bg-neutral-50 flex flex-col">
      {/* Top header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <Link href="/client-dashboard" className="text-base sm:text-lg font-semibold text-neutral-900">
            CoachFit
          </Link>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            <UserProfileMenu
              userName={firstName}
              showRoleSwitcher={false}
              showAdminLink={session?.user && isAdmin(session.user)}
            />
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="bg-white border-b border-neutral-200 sticky top-[49px] sm:top-[53px] z-20 px-3 sm:px-4 md:px-6">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive =
              tab.href === "/client-dashboard"
                ? pathname === tab.href
                : pathname === tab.href || pathname?.startsWith(tab.href + "/")
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                }`}
              >
                {tab.name}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 pb-20 sm:pb-6 overflow-x-hidden">{children}</main>
    </div>
  )
}
