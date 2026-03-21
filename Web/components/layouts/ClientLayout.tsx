"use client"

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

  if (!session) return null

  const firstName = session?.user?.name?.split(" ")[0] || "there"

  return (
    <div className="min-h-screen bg-neutral-50">
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
      <nav className="bg-white border-b border-neutral-200 px-3 sm:px-4 md:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { name: "Dashboard", href: "/client-dashboard" },
            { name: "Classes", href: "/client-dashboard/classes" },
            { name: "Challenges", href: "/client-dashboard/challenges" },
            { name: "Credits", href: "/client-dashboard/credits" },
            { name: "Settings", href: "/client-dashboard/settings" },
          ].map((tab) => {
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
      <main className="p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  )
}
