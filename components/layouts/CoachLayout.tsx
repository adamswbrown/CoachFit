"use client"

import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useRef, Suspense } from "react"
import { isAdmin } from "@/lib/permissions"
import { ClientsIcon, CohortsIcon, MobileIcon } from "@/components/icons"
import { HealthKitIcon } from "@/components/icons/HealthKitIcon"
import { RoleSwitcher } from "@/components/RoleSwitcher"
import { useRole } from "@/contexts/RoleContext"
import { Role } from "@/lib/types"

interface CoachLayoutProps {
  children: React.ReactNode
}

type ClientFilter = "all" | "active" | "connected" | "pending" | "offline" | "unassigned" | "invited" | "needs-attention"

function CoachLayoutContent({ children }: CoachLayoutProps) {
  const { data: session } = useSession()
  const { activeRole, setActiveRole } = useRole()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [clientsDropdownOpen, setClientsDropdownOpen] = useState(false)
  const [cohortsDropdownOpen, setCohortsDropdownOpen] = useState(false)
  const clientsDropdownRef = useRef<HTMLDivElement>(null)
  const cohortsDropdownRef = useRef<HTMLDivElement>(null)
  const [healthkitEnabled, setHealthkitEnabled] = useState<boolean>(true)
  const [iosIntegrationEnabled, setIosIntegrationEnabled] = useState<boolean>(true)

  const currentFilter = (searchParams.get("filter") as ClientFilter) || "all"

  // Fetch feature flags
  useEffect(() => {
    const fetchFeatureFlags = async () => {
      try {
        const res = await fetch("/api/admin/settings")
        if (res.ok) {
          const data = await res.json()
          setHealthkitEnabled(data.data.healthkitEnabled ?? true)
          setIosIntegrationEnabled(data.data.iosIntegrationEnabled ?? true)
        }
      } catch (err) {
        console.error("Error fetching feature flags:", err)
      }
    }
    fetchFeatureFlags()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    if (pathname?.startsWith("/admin") && session.user.roles.includes(Role.ADMIN) && activeRole !== Role.ADMIN) {
      setActiveRole(Role.ADMIN)
    }
  }, [pathname, session, activeRole, setActiveRole])

  if (!session) return null

  const isClientsActive = pathname === "/coach-dashboard" || pathname?.startsWith("/clients/")

  const clientFilters: { value: ClientFilter; label: string }[] = [
    { value: "all", label: "All Clients" },
    { value: "active", label: "Connected" },
    { value: "pending", label: "Pending" },
    { value: "offline", label: "Offline" },
    { value: "unassigned", label: "Unassigned" },
    { value: "invited", label: "Invited" },
    { value: "needs-attention", label: "Needs Attention" },
  ]

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientsDropdownRef.current && !clientsDropdownRef.current.contains(event.target as Node)) {
        setClientsDropdownOpen(false)
      }
      if (cohortsDropdownRef.current && !cohortsDropdownRef.current.contains(event.target as Node)) {
        setCohortsDropdownOpen(false)
      }
    }

    if (clientsDropdownOpen || cohortsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [clientsDropdownOpen, cohortsDropdownOpen])

  const handleFilterChange = (filter: ClientFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === "all") {
      params.delete("filter")
    } else {
      params.set("filter", filter)
    }
    router.push(`/coach-dashboard?${params.toString()}`)
    setClientsDropdownOpen(false)
  }

  const isCohortsActive = pathname === "/cohorts" || pathname?.startsWith("/cohorts/")
  const isPairingActive = pathname === "/coach-dashboard/pairing"

  // Build navigation array based on active role
  const navigation = []

  // Determine which navigation items to show
  const showCoachNav = activeRole === Role.COACH || (activeRole === null && session?.user?.roles.includes(Role.COACH))
  const showAdminNav = activeRole === Role.ADMIN || (activeRole === null && session?.user?.roles.includes(Role.ADMIN) && !session?.user?.roles.includes(Role.COACH))

  // Show coach navigation items
  if (showCoachNav) {
    navigation.push(
      { name: "Clients", href: "/coach-dashboard", icon: ClientsIcon, hasDropdown: true, dropdownKey: "clients" },
      { name: "Cohorts", href: "/cohorts", icon: CohortsIcon, hasDropdown: true, dropdownKey: "cohorts" }
    )
    
    // Conditionally add HealthKit navigation item
    if (healthkitEnabled) {
      navigation.push(
        { name: "HealthKit Data", href: "/coach-dashboard/healthkit-data", icon: HealthKitIcon, hasDropdown: false, dropdownKey: "healthkit" }
      )
    }
    
    // Conditionally add iOS Pairing navigation item
    if (iosIntegrationEnabled) {
      navigation.push(
        { name: "iOS Pairing", href: "/coach-dashboard/pairing", icon: MobileIcon, hasDropdown: false, dropdownKey: "pairing" }
      )
    }
  }

  // Add admin navigation items
  if (showAdminNav) {
    navigation.push(
      { name: "Users", href: "/admin", icon: (props: any) => <span className="text-xl">👤</span>, hasDropdown: false, dropdownKey: "admin-users" },
      { name: "Overview", href: "/admin/overview", icon: (props: any) => <span className="text-xl">📈</span>, hasDropdown: false, dropdownKey: "admin-overview" },
      { name: "Attention", href: "/admin/attention", icon: (props: any) => <span className="text-xl">🔔</span>, hasDropdown: false, dropdownKey: "admin-attention" },
      { name: "System", href: "/admin/system", icon: (props: any) => <span className="text-xl">⚙️</span>, hasDropdown: false, dropdownKey: "admin-system" },
      { name: "Settings", href: "/admin/settings", icon: (props: any) => <span className="text-xl">⚡</span>, hasDropdown: false, dropdownKey: "admin-settings" }
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/coach-dashboard" className="text-lg font-semibold text-neutral-900">
              CoachFit
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <RoleSwitcher />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left sidebar */}
        <aside
          className={`bg-white border-r border-neutral-200 transition-all duration-200 ${
            sidebarOpen ? "w-64" : "w-0 overflow-hidden"
          }`}
        >
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              const isItemActive = item.name === "Clients" ? isClientsActive : isCohortsActive
              
              if (item.hasDropdown && item.name === "Clients") {
                return (
                  <div key={item.name} className="relative" ref={clientsDropdownRef}>
                    <button
                      onClick={() => {
                        setClientsDropdownOpen(!clientsDropdownOpen)
                        setCohortsDropdownOpen(false)
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isClientsActive
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={20} />
                        <span>{item.name}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 transition-transform ${clientsDropdownOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Clients Dropdown Menu */}
                    {clientsDropdownOpen && (
                      <div className="absolute left-full top-0 ml-2 w-56 bg-neutral-900 rounded-lg shadow-xl z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                          <span className="text-white font-medium text-sm">{item.name}</span>
                          <item.icon size={16} className="text-neutral-400" />
                        </div>
                        <div className="py-2">
                          {clientFilters.map((filter) => (
                            <button
                              key={filter.value}
                              onClick={() => handleFilterChange(filter.value)}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                currentFilter === filter.value
                                  ? "bg-neutral-800 text-white"
                                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                              }`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              if (item.hasDropdown && item.name === "Cohorts") {
                return (
                  <div key={item.name} className="relative" ref={cohortsDropdownRef}>
                    <button
                      onClick={() => {
                        setCohortsDropdownOpen(!cohortsDropdownOpen)
                        setClientsDropdownOpen(false)
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isCohortsActive
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={20} />
                        <span>{item.name}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 transition-transform ${cohortsDropdownOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Cohorts Dropdown Menu */}
                    {cohortsDropdownOpen && (
                      <div className="absolute left-full top-0 ml-2 w-56 bg-neutral-900 rounded-lg shadow-xl z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                          <span className="text-white font-medium text-sm">{item.name}</span>
                          <item.icon size={16} className="text-neutral-400" />
                        </div>
                        <div className="py-2">
                          <Link
                            href="/cohorts"
                            onClick={() => setCohortsDropdownOpen(false)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors block ${
                              pathname === "/cohorts"
                                ? "bg-neutral-800 text-white"
                                : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                            }`}
                          >
                            All Cohorts
                          </Link>
                          <Link
                            href="/coach-dashboard?showForm=true"
                            onClick={() => setCohortsDropdownOpen(false)}
                            className="w-full text-left px-4 py-2.5 text-sm transition-colors block text-neutral-300 hover:bg-neutral-800 hover:text-white"
                          >
                            Create Cohort
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

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
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function CoachLayout({ children }: CoachLayoutProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    }>
      <CoachLayoutContent>{children}</CoachLayoutContent>
    </Suspense>
  )
}
