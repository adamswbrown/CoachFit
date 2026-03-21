"use client"

import { useState, useEffect, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditBalanceData {
  balance: number
}

export interface CreditBalanceProps {
  /** Display format for the balance widget. */
  variant: "large" | "pill" | "inline"
  /** If true, the component will not navigate on click (useful when already on credits page). */
  disableLink?: boolean
  /** External balance override — if provided, no fetch is made. */
  balance?: number
  /** Called when balance is loaded/refreshed — useful for parents to react. */
  onBalanceLoaded?: (balance: number) => void
  /** Forces a re-fetch when this value changes (increment to trigger refresh). */
  refreshKey?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function balanceColor(balance: number): string {
  if (balance === 0) return "text-red-600"
  if (balance <= 2) return "text-amber-600"
  return "text-green-600"
}

function balanceBg(balance: number): string {
  if (balance === 0) return "bg-red-50 border-red-200"
  if (balance <= 2) return "bg-amber-50 border-amber-200"
  return "bg-green-50 border-green-200"
}

function pillBg(balance: number): string {
  if (balance === 0) return "bg-red-100 text-red-700"
  if (balance <= 2) return "bg-amber-100 text-amber-700"
  return "bg-green-100 text-green-700"
}

// Coin SVG icon — inline to avoid extra file dependency
function CoinIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v1m0 10v1M9 12h6" strokeLinecap="round" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CreditBalance — reusable credit balance widget.
 *
 * Variants:
 *  - "large"  → Full card for the credits page header
 *  - "pill"   → Compact badge for the navigation header
 *  - "inline" → Small inline display for booking confirmation screens
 */
export function CreditBalance({
  variant,
  disableLink = false,
  balance: externalBalance,
  onBalanceLoaded,
  refreshKey = 0,
}: CreditBalanceProps) {
  const [balance, setBalance] = useState<number | null>(externalBalance ?? null)
  const [loading, setLoading] = useState(externalBalance === undefined)
  const [error, setError] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (externalBalance !== undefined) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/credits/balance", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to fetch balance")
      const data: CreditBalanceData = await res.json()
      const b = typeof data.balance === "number" ? data.balance : 0
      setBalance(b)
      onBalanceLoaded?.(b)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [externalBalance, onBalanceLoaded])

  // Sync external balance override
  useEffect(() => {
    if (externalBalance !== undefined) {
      setBalance(externalBalance)
      setLoading(false)
    }
  }, [externalBalance])

  // Fetch on mount or when refreshKey changes
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance, refreshKey])

  // ── Pill variant (navigation header) ──────────────────────────────────────
  if (variant === "pill") {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-400 animate-pulse">
          <CoinIcon className="w-3.5 h-3.5" />
          <span className="w-4 h-3 bg-neutral-300 rounded" />
        </span>
      )
    }
    if (error || balance === null) {
      return null
    }
    const content = (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${pillBg(balance)}`}>
        <CoinIcon className="w-3.5 h-3.5" />
        {balance} {balance === 1 ? "credit" : "credits"}
      </span>
    )
    if (disableLink) return content
    return (
      <a href="/client-dashboard/credits" className="hover:opacity-80 transition-opacity">
        {content}
      </a>
    )
  }

  // ── Inline variant (booking screens) ──────────────────────────────────────
  if (variant === "inline") {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-1 text-sm text-neutral-400 animate-pulse">
          <CoinIcon className="w-4 h-4" />
          <span className="w-8 h-4 bg-neutral-200 rounded" />
        </span>
      )
    }
    if (error || balance === null) return null
    return (
      <span className={`inline-flex items-center gap-1 text-sm font-medium ${balanceColor(balance)}`}>
        <CoinIcon className="w-4 h-4" />
        {balance} {balance === 1 ? "credit" : "credits"}
      </span>
    )
  }

  // ── Large variant (credits page) ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border p-6 bg-white border-neutral-200 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-neutral-200" />
          <div className="h-5 w-32 bg-neutral-200 rounded" />
        </div>
        <div className="h-14 w-24 bg-neutral-200 rounded mb-2" />
        <div className="h-4 w-40 bg-neutral-100 rounded" />
      </div>
    )
  }

  if (error || balance === null) {
    return (
      <div className="rounded-xl border p-6 bg-red-50 border-red-200">
        <p className="text-sm text-red-600">Unable to load credit balance.</p>
        <button
          onClick={fetchBalance}
          className="mt-2 text-xs text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border p-6 ${balanceBg(balance)}`}>
      <div className="flex items-center gap-2 mb-3">
        <CoinIcon className={`w-6 h-6 ${balanceColor(balance)}`} />
        <span className="text-sm font-medium text-neutral-600">Your credit balance</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-5xl font-bold ${balanceColor(balance)}`}>{balance}</span>
        <span className="text-lg text-neutral-500">{balance === 1 ? "credit" : "credits"}</span>
      </div>
      {balance === 0 && (
        <p className="text-sm text-red-600 font-medium">
          You have no credits. Buy a pack to book classes.
        </p>
      )}
      {balance > 0 && balance <= 2 && (
        <p className="text-sm text-amber-700">
          Running low — buy more to keep booking.
        </p>
      )}
      {balance > 2 && (
        <p className="text-sm text-green-700">
          You&apos;re all set to book classes.
        </p>
      )}
    </div>
  )
}
