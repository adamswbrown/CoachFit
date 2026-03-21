"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { ClientLayout } from "@/components/layouts/ClientLayout"
import { CreditBalance } from "@/components/credits/credit-balance"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditProduct {
  id: string
  name: string
  description: string | null
  creditMode: string
  creditsPerPeriod: number | null
  purchasePriceGbp: string | null
  purchasableByProviderOnly: boolean
  isActive: boolean
}

interface LedgerEntry {
  id: string
  createdAt: string
  deltaCredits: number
  reason: string
  description: string | null
  balanceAfter: number
}

interface LedgerResponse {
  entries: LedgerEntry[]
  total: number
  page: number
  limit: number
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

function CoinIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v1m0 10v1M9 12h6" strokeLinecap="round" />
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientCreditsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [products, setProducts] = useState<CreditProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)

  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [ledgerError, setLedgerError] = useState<string | null>(null)
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const LEDGER_LIMIT = 10

  const [buyingProductId, setBuyingProductId] = useState<string | null>(null)
  const [buySuccess, setBuySuccess] = useState<string | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)

  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0)

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // ── Fetch products ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user) return
    const load = async () => {
      try {
        const res = await fetch("/api/credits/products", { credentials: "include" })
        if (!res.ok) throw new Error("Failed to load credit products")
        const data = await res.json()
        const available = (Array.isArray(data) ? data : data.products ?? []).filter(
          (p: CreditProduct) => !p.purchasableByProviderOnly && p.isActive
        )
        setProducts(available)
      } catch (err) {
        setProductsError("Could not load available credit packs.")
        console.error(err)
      } finally {
        setProductsLoading(false)
      }
    }
    load()
  }, [session?.user])

  // ── Fetch ledger ───────────────────────────────────────────────────────────
  const loadLedger = useCallback(
    async (page: number) => {
      if (!session?.user) return
      setLedgerLoading(true)
      setLedgerError(null)
      try {
        const res = await fetch(
          `/api/credits/ledger?page=${page}&limit=${LEDGER_LIMIT}`,
          { credentials: "include" }
        )
        if (!res.ok) throw new Error("Failed to load transaction history")
        const data: LedgerResponse = await res.json()
        setLedger(data.entries ?? [])
        setLedgerTotal(data.total ?? 0)
        setLedgerPage(page)
      } catch (err) {
        setLedgerError("Could not load transaction history.")
        console.error(err)
      } finally {
        setLedgerLoading(false)
      }
    },
    [session?.user]
  )

  useEffect(() => {
    loadLedger(1)
  }, [loadLedger])

  // ── Purchase handler (manual flow — creates pending submission) ────────────
  const handleBuy = async (productId: string) => {
    setBuyingProductId(productId)
    setBuyError(null)
    setBuySuccess(null)
    try {
      const res = await fetch("/api/credits/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditProductId: productId }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Purchase request failed. Please try again.")
      }
      setBuySuccess(
        "Request submitted! Your coach will review and approve your credit purchase."
      )
      // Refresh ledger in case anything changed
      loadLedger(1)
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBuyingProductId(null)
    }
  }

  // ── Loading / auth states ──────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <ClientLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-neutral-200 rounded" />
            <div className="h-32 bg-neutral-200 rounded-xl" />
            <div className="h-64 bg-neutral-200 rounded-xl" />
          </div>
        </div>
      </ClientLayout>
    )
  }

  if (!session?.user) return null

  const totalPages = Math.ceil(ledgerTotal / LEDGER_LIMIT)

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Credits</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Request credit packs and view your transaction history.
          </p>
        </div>

        {/* Success banner */}
        {buySuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-green-800">{buySuccess}</p>
            <button
              onClick={() => setBuySuccess(null)}
              className="ml-auto text-green-600 hover:text-green-800 text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Credit balance card */}
        <CreditBalance
          variant="large"
          disableLink
          refreshKey={balanceRefreshKey}
        />

        {/* Buy error alert */}
        {buyError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {buyError}
          </div>
        )}

        {/* ── Available packs ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-3">Available Credit Packs</h2>

          {productsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-neutral-200 rounded-xl p-5 animate-pulse"
                >
                  <div className="h-5 w-32 bg-neutral-200 rounded mb-2" />
                  <div className="h-4 w-24 bg-neutral-100 rounded mb-4" />
                  <div className="h-9 w-full bg-neutral-200 rounded-lg" />
                </div>
              ))}
            </div>
          ) : productsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {productsError}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <CoinIcon className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-700">No credit products available</p>
              <p className="text-xs text-neutral-500 mt-1">
                Your coach has not listed any credit packs yet. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col justify-between hover:border-neutral-300 transition-colors"
                >
                  <div className="mb-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-neutral-900 leading-tight">
                        {product.name}
                      </h3>
                      {product.purchasePriceGbp && (
                        <span className="text-base font-bold text-neutral-900 whitespace-nowrap">
                          {formatGBP(product.purchasePriceGbp)}
                        </span>
                      )}
                    </div>
                    {product.creditsPerPeriod !== null && (
                      <p className="text-xs text-neutral-500">
                        {product.creditsPerPeriod}{" "}
                        {product.creditsPerPeriod === 1 ? "credit" : "credits"} awarded
                      </p>
                    )}
                    {product.description && (
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleBuy(product.id)}
                    disabled={buyingProductId === product.id}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {buyingProductId === product.id ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Submitting&hellip;
                      </>
                    ) : (
                      "Request Purchase"
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Transaction history ────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold text-neutral-900 mb-3">Transaction History</h2>

          {ledgerLoading ? (
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-100 last:border-0 animate-pulse"
                >
                  <div className="space-y-1.5">
                    <div className="h-4 w-40 bg-neutral-200 rounded" />
                    <div className="h-3 w-24 bg-neutral-100 rounded" />
                  </div>
                  <div className="h-5 w-12 bg-neutral-200 rounded" />
                </div>
              ))}
            </div>
          ) : ledgerError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {ledgerError}
            </div>
          ) : ledger.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
              <p className="text-sm text-neutral-500">No transactions yet.</p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                {ledger.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-100 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {entry.description || entry.reason}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {formatDate(entry.createdAt)}
                        {entry.balanceAfter !== undefined && (
                          <span className="ml-2 text-neutral-400">
                            Balance: {entry.balanceAfter}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold flex-shrink-0 ml-4 ${
                        entry.deltaCredits > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {entry.deltaCredits > 0 ? "+" : ""}
                      {entry.deltaCredits}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm">
                  <p className="text-neutral-500">
                    Page {ledgerPage} of {totalPages} &mdash; {ledgerTotal} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadLedger(ledgerPage - 1)}
                      disabled={ledgerPage <= 1}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => loadLedger(ledgerPage + 1)}
                      disabled={ledgerPage >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </ClientLayout>
  )
}
