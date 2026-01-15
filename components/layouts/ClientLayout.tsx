"use client"

import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { isAdmin } from "@/lib/permissions"

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
        <div className="px-6 py-4 flex items-center justify-between">
          <Link href="/client-dashboard" className="text-lg font-semibold text-neutral-900">
            CoachFit
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-sm text-neutral-600">
              {firstName}
            </div>
            <Link
              href="/client-dashboard/settings"
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                pathname === "/client-dashboard/settings"
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              Settings
            </Link>
            {session?.user && isAdmin(session.user) && (
              <Link
                href="/admin"
                className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
              >
                Admin
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-8">{children}</main>
    </div>
  )
}
