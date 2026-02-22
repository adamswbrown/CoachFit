"use client"

import { useSession } from "next-auth/react"
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

      <nav className="bg-white border-b border-neutral-200">
        <div className="px-3 sm:px-4 md:px-6 py-2 flex flex-wrap gap-2">
          {[
            { href: "/client-dashboard", label: "Dashboard" },
            { href: "/client-dashboard/classes", label: "Classes" },
            { href: "/client-dashboard/settings", label: "Settings" },
            { href: "/client-dashboard/pairing", label: "iOS Pairing" },
          ].map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {item.label}
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
