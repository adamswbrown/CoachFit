"use client"

import { useSession } from "next-auth/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useRef, Suspense } from "react"
import { isAdmin } from "@/lib/permissions"
import { ClientsIcon, CohortsIcon, MobileIcon, CalendarIcon } from "@/components/icons"
import { HealthKitIcon } from "@/components/icons/HealthKitIcon"
import { UserProfileMenu } from "@/components/UserProfileMenu"
import { useRole } from "@/contexts/RoleContext"
import { Role } from "@/lib/types"

interface CoachLayoutProps {
  children: React.ReactNode
}

type ClientFilter = "all" | "active" | "connected" | "pending" | "offline" | "unassigned" | "invited" | "needs-attention"

function CoachLayoutContent({ children }: CoachLayoutProps) {
  const { data: session } = useSession()
  const { activeRole } = useRole()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false) // Sidebar starts closed for cleaner mobile UX, users can toggle if needed
  const [clientsDropdownOpen, setClientsDropdownOpen] = useState(false)
  const [cohortsDropdownOpen, setCohortsDropdownOpen] = useState(false)
  const clientsDropdownRef = useRef<HTMLDivElement>(null)
  const cohortsDropdownRef = useRef<HTMLDivElement>(null)
  const [healthkitEnabled, setHealthkitEnabled] = useState<boolean>(true)
  const [iosIntegrationEnabled, setIosIntegrationEnabled] = useState<boolean>(true)
  const [cohortsData, setCohortsData] = useState<Array<{ id: string; name: string; activeClients: number; pendingInvites: number }>>([])
  const [cohortsLoading, setCohortsLoading] = useState(true)

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

  // Fetch cohorts when session is available
  useEffect(() => {
    if (!session?.user?.id) {
      setCohortsLoading(false)
      return
    }

    const fetchCohorts = async () => {
      try {
        setCohortsLoading(true)
        const res = await fetch("/api/cohorts")
        if (res.ok) {
          const data = await res.json()
          setCohortsData(data)
        }
      } catch (err) {
        console.error("Error fetching cohorts:", err)
      } finally {
        setCohortsLoading(false)
      }
    }

    fetchCohorts()
  }, [session?.user?.id])

  if (!session) return null

  const firstName = session?.user?.name?.split(" ")[0] || session?.user?.email || "there"

  const isClientsActive = pathname === "/coach-dashboard" || pathname?.startsWith("/clients/") || pathname?.startsWith("/coach-dashboard/")

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

    if (!clientsDropdownOpen && !cohortsDropdownOpen) {
      return
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
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
  const isCoachPath = pathname === "/coach-dashboard" || pathname?.startsWith("/coach-dashboard/") || pathname?.startsWith("/clients/") || pathname?.startsWith("/cohorts/")
  const isAdminPath = pathname?.startsWith("/admin") || false

  // Build navigation array based on active role
  const navigation = []

  // Determine which navigation items to show
  const userHasCoachRole = session?.user?.roles.includes(Role.COACH)
  const userHasAdminRole = session?.user?.roles.includes(Role.ADMIN)
  
  // Show navigation based on activeRole (respects RoleSwitcher selection)
  const showCoachNav = userHasCoachRole && (activeRole === Role.COACH || (activeRole === null && !userHasAdminRole) || isCoachPath)
  const showAdminNav = userHasAdminRole && (activeRole === Role.ADMIN || (activeRole === null && !userHasCoachRole) || isAdminPath)
  
  // Show coach navigation
  if (showCoachNav && userHasCoachRole) {
    navigation.push(
      { name: "Clients", href: "/coach-dashboard", icon: ClientsIcon, hasDropdown: true, dropdownKey: "clients" },
      { name: "Cohorts", href: "/cohorts", icon: CohortsIcon, hasDropdown: true, dropdownKey: "cohorts" },
      { name: "Questionnaire Analytics", href: "/coach-dashboard/questionnaire-analytics", icon: CalendarIcon, hasDropdown: false, dropdownKey: "questionnaire-analytics" }
    )
    
    // Add Weekly Review as a separate navigation item
    navigation.push(
      { name: "Weekly Review", href: "/coach-dashboard/weekly-review", icon: CalendarIcon, hasDropdown: false, dropdownKey: "weekly-review" }
    )
    
    // Add Measurement Tracker for Gav
    if (session?.user?.email === "coachgav@gcgyms.com") {
      navigation.push(
        { name: "Measurements", href: "/measurement-tracker/", icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" /><circle cx="7" cy="6" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="17" cy="18" r="1.5" fill="currentColor" /></svg>, hasDropdown: false, dropdownKey: "measurements", external: true }
      )
    }

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

  // Show admin navigation
  if (showAdminNav && userHasAdminRole) {
    navigation.push(
      { name: "Users", href: "/admin", icon: (props: any) => <span className="text-xl">👤</span>, hasDropdown: false, dropdownKey: "admin-users" },
      { name: "Overview", href: "/admin/overview", icon: (props: any) => <span className="text-xl">📈</span>, hasDropdown: false, dropdownKey: "admin-overview" },
      { name: "Attention", href: "/admin/attention", icon: (props: any) => <span className="text-xl">🔔</span>, hasDropdown: false, dropdownKey: "admin-attention" },
      { name: "System", href: "/admin/system", icon: (props: any) => <span className="text-xl">⚙️</span>, hasDropdown: false, dropdownKey: "admin-system" },
      { name: "Settings", href: "/admin/settings", icon: (props: any) => <span className="text-xl">⚡</span>, hasDropdown: false, dropdownKey: "admin-settings" },
      { name: "Cohort Types", href: "/admin/cohort-types", icon: (props: any) => <span className="text-xl">🏷️</span>, hasDropdown: false, dropdownKey: "admin-cohort-types" },
      { name: "Audit Log", href: "/admin/audit-log", icon: (props: any) => <span className="text-xl">🧾</span>, hasDropdown: false, dropdownKey: "admin-audit-log" },
      { name: "Email Templates", href: "/admin/email-templates", icon: (props: any) => <span className="text-xl">✉️</span>, hasDropdown: false, dropdownKey: "admin-email-templates" }
    )
  }

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
            <Link href="/coach-dashboard" className="text-base sm:text-lg font-semibold text-neutral-900">
              CoachFit
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            <UserProfileMenu 
              userName={firstName}
              showRoleSwitcher={true}
              showAdminLink={isAdmin(session.user)}
            />
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
                      <div className="mt-1 ml-9 mr-2 bg-white border border-neutral-200 rounded-md shadow-sm overflow-hidden">
                        <div className="px-3 py-2 border-b border-neutral-100 flex items-center justify-between">
                          <span className="text-neutral-700 font-medium text-xs uppercase tracking-wide">Filters</span>
                          <item.icon size={14} className="text-neutral-400" />
                        </div>
                        <div className="py-1">
                          {clientFilters.map((filter) => (
                            <button
                              key={filter.value}
                              onClick={() => handleFilterChange(filter.value)}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                currentFilter === filter.value
                                  ? "bg-neutral-100 text-neutral-900"
                                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
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
                      <div className="mt-1 ml-9 mr-2 bg-white border border-neutral-200 rounded-md shadow-sm overflow-hidden">
                        <div className="px-3 py-2 border-b border-neutral-100 flex items-center justify-between">
                          <span className="text-neutral-700 font-medium text-xs uppercase tracking-wide">Cohorts</span>
                          <item.icon size={14} className="text-neutral-400" />
                        </div>
                        <div className="py-1">
                          <Link
                            href="/cohorts"
                            onClick={() => setCohortsDropdownOpen(false)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors block ${
                              pathname === "/cohorts"
                                ? "bg-neutral-100 text-neutral-900"
                                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                            }`}
                          >
                            All Cohorts
                          </Link>

                          {cohortsLoading ? (
                            <div className="px-3 py-2 text-sm text-neutral-500">Loading cohorts...</div>
                          ) : cohortsData.length > 0 ? (
                            <>
                              <div className="px-3 pt-2 pb-1 text-xs text-neutral-500 border-t border-neutral-100">My Cohorts</div>
                              {cohortsData.map((cohort) => (
                                <Link
                                  key={cohort.id}
                                  href={`/cohorts/${cohort.id}`}
                                  onClick={() => setCohortsDropdownOpen(false)}
                                  className="w-full text-left px-3 py-2 text-sm transition-colors block text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{cohort.name}</span>
                                    <span className="text-xs text-neutral-400">({cohort.activeClients})</span>
                                  </div>
                                </Link>
                              ))}
                            </>
                          ) : (
                            <div className="px-3 py-2 text-sm text-neutral-500">No cohorts yet</div>
                          )}

                          <div className="border-t border-neutral-100 pt-1">
                            <Link
                              href="/coach-dashboard?showForm=true"
                              onClick={() => setCohortsDropdownOpen(false)}
                              className="w-full text-left px-3 py-2 text-sm transition-colors block text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                            >
                              Create Cohort
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              if ((item as any).external) {
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <item.icon size={20} />
                    <span>{item.name}</span>
                    <svg className="w-3 h-3 ml-auto text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
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
        <main className="flex-1 w-full lg:w-auto">
          <div className="p-4 sm:p-6 md:p-8">{children}</div>
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
