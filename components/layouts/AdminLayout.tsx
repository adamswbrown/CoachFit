"use client"

import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Default closed on mobile

  if (!session) return null

  const firstName = session?.user?.name?.split(" ")[0] || session?.user?.email || "there"

  const navigation = [
    { name: "Users", href: "/admin", icon: "👤" },
    { name: "Overview", href: "/admin/overview", icon: "📈" },
    { name: "Attention", href: "/admin/attention", icon: "🔔" },
    { name: "System", href: "/admin/system", icon: "⚙️" },
  ]

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-neutral-100 rounded-md transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/admin" className="text-base sm:text-lg font-semibold text-neutral-900">
              <span className="hidden sm:inline">CoachFit Admin</span>
              <span className="sm:hidden">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            <div className="hidden md:block text-sm text-neutral-600">
              {firstName}
            </div>
            <Link
              href="/client-dashboard/settings"
              className="hidden sm:inline-block px-2 sm:px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
            >
              Settings
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-2 sm:px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left sidebar - mobile overlay on small screens */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-neutral-200 transition-transform duration-200 lg:transition-all ${
            sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"
          }`}
        >
          <nav className="p-4 space-y-1 overflow-y-auto h-full">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 w-full lg:w-auto">
          <div className="p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
