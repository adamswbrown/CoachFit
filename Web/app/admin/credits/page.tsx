"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminCreditStats {
  totalCreditsInCirculation: number
  pendingSubmissionsCount: number
  totalTransactionsLast30Days: number
  totalClientsWithAccounts: number
}

interface RecentTransaction {
  id: string
  createdAt: string
  deltaCredits: number
  reason: string
  description: string | null
  clientName: string | null
  clientEmail: string
}

interface AllProduct {
  id: string
  name: string
  purchasePriceGbp: string | null
  creditsPerPeriod: number | null
  isActive: boolean
  purchasableByProviderOnly: boolean
  ownerCoachId: string
  ownerCoachName: string | null
  ownerCoachEmail: string
}

interface AdminOverviewResponse {
  stats: AdminCreditStats
  recentTransactions: RecentTransaction[]
  products: AllProduct[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGBP(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "—"
  return `£${num.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function StatCard({
  label,
  value,
  sublabel,
  accent = "neutral",
}: {
  label: string
  value: string | number
  sublabel?: string
  accent?: "neutral" | "green" | "amber" | "red"
}) {
  const accentColors = {
    neutral: "border-neutral-200",
    green: "border-green-200",
    amber: "border-amber-200",
    red: "border-red-200",
  }
  const valueColors = {
    neutral: "text-neutral-900",
    green: "text-green-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }

  return (
    <div className={`bg-white rounded-xl border p-5 ${accentColors[accent]}`}>
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-bold ${valueColors[accent]}`}>{value}</p>
      {sublabel && <p className="text-xs text-neutral-500 mt-1">{sublabel}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCreditsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data, setData] = useState<AdminOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdmin(session.user)) {
      router.push("/coach-dashboard")
    }
  }, [status, session, router])

  // ── Fetch overview ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/credits/admin/overview", {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to load admin credit overview")
      const json: AdminOverviewResponse = await res.json()
      setData(json)
    } catch (err) {
      setError("Could not load credit overview.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Loading state ───────────────────────────────────────────────────────────
  if (status === "loading" || loading) {
    return (
      <CoachLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-neutral-200 rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-neutral-200 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-neutral-200 rounded-xl" />
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session?.user) return null

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Credits — System Overview</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Platform-wide view of all credits, submissions, and products.
            </p>
          </div>
          <Link
            href="/coach-dashboard/credits"
            className="text-sm text-neutral-600 underline hover:no-underline"
          >
            Manage your credits &rarr;
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button onClick={loadData} className="ml-3 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {data && (
          <>
            {/* ── Stats grid ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Credits in Circulation"
                value={data.stats.totalCreditsInCirculation}
                sublabel="Across all client accounts"
                accent="green"
              />
              <StatCard
                label="Pending Submissions"
                value={data.stats.pendingSubmissionsCount}
                sublabel="Awaiting coach approval"
                accent={data.stats.pendingSubmissionsCount > 0 ? "amber" : "neutral"}
              />
              <StatCard
                label="Transactions (30d)"
                value={data.stats.totalTransactionsLast30Days}
                sublabel="Last 30 days"
              />
              <StatCard
                label="Clients with Accounts"
                value={data.stats.totalClientsWithAccounts}
              />
            </div>

            {/* ── Recent Transactions ─────────────────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-neutral-900 mb-3">
                Recent Transactions
              </h2>
              {data.recentTransactions.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
                  <p className="text-sm text-neutral-500">No transactions yet.</p>
                </div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-6 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    <span>Client</span>
                    <span>Description</span>
                    <span>Date</span>
                    <span>Credits</span>
                  </div>
                  {data.recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_auto_auto] gap-1 sm:gap-4 px-4 sm:px-6 py-4 border-b border-neutral-100 last:border-0 sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {tx.clientName || tx.clientEmail}
                        </p>
                        <p className="text-xs text-neutral-500">{tx.clientEmail}</p>
                      </div>
                      <p className="text-sm text-neutral-700">{tx.description || tx.reason}</p>
                      <p className="text-xs text-neutral-500">{formatDate(tx.createdAt)}</p>
                      <span
                        className={`text-sm font-semibold ${
                          tx.deltaCredits > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {tx.deltaCredits > 0 ? "+" : ""}
                        {tx.deltaCredits}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── All Products ─────────────────────────────────────────────── */}
            <section>
              <h2 className="text-base font-semibold text-neutral-900 mb-3">
                All Credit Products — All Coaches
              </h2>
              {data.products.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
                  <p className="text-sm text-neutral-500">No credit products exist yet.</p>
                </div>
              ) : (
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-6 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    <span>Product</span>
                    <span>Coach</span>
                    <span>Price</span>
                    <span>Credits</span>
                    <span>Status</span>
                  </div>
                  {data.products.map((product) => (
                    <div
                      key={product.id}
                      className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-1 sm:gap-4 px-4 sm:px-6 py-4 border-b border-neutral-100 last:border-0 sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{product.name}</p>
                        {product.purchasableByProviderOnly && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Provider only
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-neutral-700">
                          {product.ownerCoachName || product.ownerCoachEmail}
                        </p>
                        <p className="text-xs text-neutral-500">{product.ownerCoachEmail}</p>
                      </div>
                      <span className="text-sm text-neutral-800">
                        {formatGBP(product.purchasePriceGbp)}
                      </span>
                      <span className="text-sm text-neutral-800">
                        {product.creditsPerPeriod ?? "—"}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          product.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </CoachLayout>
  )
}
