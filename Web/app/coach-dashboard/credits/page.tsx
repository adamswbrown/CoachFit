"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { isAdminOrCoach } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditSubmission {
  id: string
  clientId: string
  creditProductId: string
  status: string
  paymentMethod: string | null
  revolutOrderId: string | null
  createdAt: string
  client: {
    id: string
    name: string | null
    email: string
  }
  creditProduct: {
    id: string
    name: string
    purchasePriceGbp: string | null
    creditsPerPeriod: number | null
  }
}

interface CreditProduct {
  id: string
  name: string
  description: string | null
  creditMode: string
  creditsPerPeriod: number | null
  purchasePriceGbp: string | null
  purchasableByProviderOnly: boolean
  isActive: boolean
  allowRepeatPurchase?: boolean
}

interface ClientCreditRow {
  id: string
  name: string | null
  email: string
  balance: number
}

interface AdjustmentForm {
  clientId: string
  clientName: string
  amount: string
  reason: string
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    APPROVED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-neutral-100 text-neutral-700"}`}>
      {status}
    </span>
  )
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  confirmClassName?: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmClassName = "bg-green-600 hover:bg-green-700 text-white",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <h2 className="text-base font-semibold text-neutral-900 mb-2">{title}</h2>
        <p className="text-sm text-neutral-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Adjustment Dialog ────────────────────────────────────────────────────────

interface AdjustmentDialogProps {
  form: AdjustmentForm
  onChange: (form: AdjustmentForm) => void
  onSubmit: () => void
  onClose: () => void
  submitting: boolean
  error: string | null
}

function AdjustmentDialog({ form, onChange, onSubmit, onClose, submitting, error }: AdjustmentDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <h2 className="text-base font-semibold text-neutral-900 mb-1">Adjust Credits</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Client: <span className="font-medium">{form.clientName}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Amount (positive to add, negative to deduct)
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => onChange({ ...form, amount: e.target.value })}
              placeholder="e.g. 5 or -2"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => onChange({ ...form, reason: e.target.value })}
              placeholder="e.g. Goodwill credit, correction"
              maxLength={500}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || !form.amount || !form.reason}
            className="px-4 py-2 text-sm rounded-lg font-medium bg-neutral-900 hover:bg-neutral-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving…" : "Apply Adjustment"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ActiveTab = "submissions" | "products" | "clients"

export default function CoachCreditsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<ActiveTab>("submissions")

  // Submissions
  const [submissions, setSubmissions] = useState<CreditSubmission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(true)
  const [submissionsError, setSubmissionsError] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{
    id: string
    action: "APPROVE" | "REJECT"
    clientName: string
    productName: string
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Products
  const [products, setProducts] = useState<CreditProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)

  // Client balances
  const [clients, setClients] = useState<ClientCreditRow[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientsError, setClientsError] = useState<string | null>(null)

  // Adjustment dialog
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm | null>(null)
  const [adjustSubmitting, setAdjustSubmitting] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdminOrCoach(session.user)) {
      router.push("/client-dashboard")
    }
  }, [status, session, router])

  // ── Fetch submissions ───────────────────────────────────────────────────────
  const loadSubmissions = useCallback(async () => {
    if (!session?.user) return
    setSubmissionsLoading(true)
    setSubmissionsError(null)
    try {
      const res = await fetch("/api/credits/submissions?status=PENDING", {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to load submissions")
      const data = await res.json()
      setSubmissions(Array.isArray(data) ? data : data.submissions ?? [])
    } catch (err) {
      setSubmissionsError("Could not load pending submissions.")
      console.error(err)
    } finally {
      setSubmissionsLoading(false)
    }
  }, [session?.user])

  // ── Fetch products ──────────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    if (!session?.user) return
    setProductsLoading(true)
    setProductsError(null)
    try {
      const res = await fetch("/api/credits/products", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load products")
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : data.products ?? [])
    } catch (err) {
      setProductsError("Could not load credit products.")
      console.error(err)
    } finally {
      setProductsLoading(false)
    }
  }, [session?.user])

  // ── Fetch client balances ───────────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    if (!session?.user) return
    setClientsLoading(true)
    setClientsError(null)
    try {
      const res = await fetch("/api/credits/clients", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load client balances")
      const data = await res.json()
      setClients(Array.isArray(data) ? data : data.clients ?? [])
    } catch (err) {
      setClientsError("Could not load client credit overview.")
      console.error(err)
    } finally {
      setClientsLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    loadSubmissions()
    loadProducts()
    loadClients()
  }, [loadSubmissions, loadProducts, loadClients])

  // ── Approve / Reject ────────────────────────────────────────────────────────
  const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
    setActioningId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/credits/submissions/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Action failed")
      }
      // Remove the submission from the list after action
      setSubmissions((prev) => prev.filter((s) => s.id !== id))
      setPendingAction(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed. Please try again.")
    } finally {
      setActioningId(null)
    }
  }

  // ── Adjustment submit ───────────────────────────────────────────────────────
  const handleAdjustSubmit = async () => {
    if (!adjustmentForm) return
    const amount = parseInt(adjustmentForm.amount, 10)
    if (isNaN(amount) || amount === 0) {
      setAdjustError("Please enter a non-zero amount.")
      return
    }
    if (!adjustmentForm.reason.trim()) {
      setAdjustError("Reason is required.")
      return
    }

    setAdjustSubmitting(true)
    setAdjustError(null)
    try {
      const res = await fetch("/api/credits/adjust", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: adjustmentForm.clientId,
          amount,
          reason: adjustmentForm.reason.trim(),
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Adjustment failed")
      }
      setAdjustmentForm(null)
      // Refresh client list to show updated balances
      loadClients()
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Could not apply adjustment.")
    } finally {
      setAdjustSubmitting(false)
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <CoachLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-neutral-200 rounded" />
            <div className="h-64 bg-neutral-200 rounded-xl" />
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session?.user) return null

  const pendingCount = submissions.length

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <CoachLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">Credits Management</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Review purchase requests, manage credit products, and adjust client balances.
          </p>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-neutral-200 -mb-px">
          {(
            [
              { id: "submissions", label: "Pending Submissions", badge: pendingCount },
              { id: "products", label: "Credit Products" },
              { id: "clients", label: "Client Balances" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {tab.label}
              {"badge" in tab && tab.badge > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Global action error */}
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {actionError}
            <button
              onClick={() => setActionError(null)}
              className="ml-3 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Tab: Submissions ─────────────────────────────────────────────── */}
        {activeTab === "submissions" && (
          <section>
            {submissionsLoading ? (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0 animate-pulse"
                  >
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-32 bg-neutral-200 rounded" />
                      <div className="h-3 w-48 bg-neutral-100 rounded" />
                    </div>
                    <div className="h-8 w-20 bg-neutral-200 rounded-lg" />
                    <div className="h-8 w-20 bg-neutral-200 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : submissionsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {submissionsError}
              </div>
            ) : submissions.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
                <svg className="w-10 h-10 text-neutral-300 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-medium text-neutral-700">No pending submissions</p>
                <p className="text-xs text-neutral-500 mt-1">
                  New credit purchase requests will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                {/* Desktop table header */}
                <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  <span>Client</span>
                  <span>Product</span>
                  <span>Reference / Method</span>
                  <span>Submitted</span>
                  <span>Actions</span>
                </div>

                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 px-4 sm:px-6 py-4 border-b border-neutral-100 last:border-0 items-start sm:items-center"
                  >
                    {/* Client */}
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {sub.client.name || sub.client.email}
                      </p>
                      <p className="text-xs text-neutral-500 sm:hidden">{sub.client.email}</p>
                    </div>

                    {/* Product */}
                    <div>
                      <p className="text-sm text-neutral-800">{sub.creditProduct.name}</p>
                      {sub.creditProduct.purchasePriceGbp && (
                        <p className="text-xs text-neutral-500">
                          {formatGBP(sub.creditProduct.purchasePriceGbp)}
                          {sub.creditProduct.creditsPerPeriod != null && (
                            <> &bull; {sub.creditProduct.creditsPerPeriod} credits</>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Reference / method */}
                    <div>
                      <StatusBadge status={sub.status} />
                      {sub.revolutOrderId && (
                        <p className="text-xs text-neutral-500 mt-0.5 font-mono truncate max-w-[160px]">
                          {sub.revolutOrderId}
                        </p>
                      )}
                      {sub.paymentMethod && !sub.revolutOrderId && (
                        <p className="text-xs text-neutral-500 mt-0.5">{sub.paymentMethod}</p>
                      )}
                    </div>

                    {/* Date */}
                    <p className="text-xs text-neutral-500">{formatDate(sub.createdAt)}</p>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() =>
                          setPendingAction({
                            id: sub.id,
                            action: "APPROVE",
                            clientName: sub.client.name || sub.client.email,
                            productName: sub.creditProduct.name,
                          })
                        }
                        disabled={actioningId === sub.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          setPendingAction({
                            id: sub.id,
                            action: "REJECT",
                            clientName: sub.client.name || sub.client.email,
                            productName: sub.creditProduct.name,
                          })
                        }
                        disabled={actioningId === sub.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Tab: Products ────────────────────────────────────────────────── */}
        {activeTab === "products" && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-neutral-600">
                {products.length} {products.length === 1 ? "product" : "products"}
              </p>
              <a
                href="/coach-dashboard/credits/products/new"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-neutral-900 hover:bg-neutral-700 text-white transition-colors"
              >
                + New Product
              </a>
            </div>

            {productsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5 animate-pulse">
                    <div className="h-5 w-32 bg-neutral-200 rounded mb-2" />
                    <div className="h-4 w-20 bg-neutral-100 rounded mb-2" />
                    <div className="h-3 w-40 bg-neutral-100 rounded" />
                  </div>
                ))}
              </div>
            ) : productsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {productsError}
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
                <p className="text-sm font-medium text-neutral-700">No credit products yet</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Create your first credit pack to let clients purchase sessions.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`bg-white border rounded-xl p-5 ${
                      product.isActive ? "border-neutral-200" : "border-neutral-100 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-neutral-900">{product.name}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {product.purchasePriceGbp && (
                          <span className="text-sm font-bold text-neutral-900">
                            {formatGBP(product.purchasePriceGbp)}
                          </span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            product.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500 mb-3">
                      {product.creditsPerPeriod != null && (
                        <span>{product.creditsPerPeriod} credits</span>
                      )}
                      <span className="capitalize">
                        {product.creditMode?.toLowerCase().replace("_", " ")}
                      </span>
                      {product.purchasableByProviderOnly && (
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          Provider only
                        </span>
                      )}
                    </div>

                    {product.description && (
                      <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{product.description}</p>
                    )}

                    <a
                      href={`/coach-dashboard/credits/products/${product.id}/edit`}
                      className="text-xs text-neutral-600 underline hover:no-underline"
                    >
                      Edit
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Tab: Client Balances ─────────────────────────────────────────── */}
        {activeTab === "clients" && (
          <section>
            {clientsLoading ? (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 last:border-0 animate-pulse"
                  >
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 bg-neutral-200 rounded" />
                      <div className="h-3 w-24 bg-neutral-100 rounded" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-8 bg-neutral-200 rounded" />
                      <div className="h-8 w-20 bg-neutral-200 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : clientsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {clientsError}
              </div>
            ) : clients.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center">
                <p className="text-sm text-neutral-500">No clients with credit accounts yet.</p>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  <span>Client</span>
                  <span>Balance</span>
                  <span>Actions</span>
                </div>
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between sm:grid sm:grid-cols-[1fr_auto_auto] gap-4 px-4 sm:px-6 py-4 border-b border-neutral-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {client.name || client.email}
                      </p>
                      <p className="text-xs text-neutral-500">{client.email}</p>
                    </div>

                    <span
                      className={`text-sm font-semibold ${
                        client.balance === 0
                          ? "text-red-600"
                          : client.balance <= 2
                          ? "text-amber-600"
                          : "text-green-600"
                      }`}
                    >
                      {client.balance}
                    </span>

                    <button
                      onClick={() => {
                        setAdjustError(null)
                        setAdjustmentForm({
                          clientId: client.id,
                          clientName: client.name || client.email,
                          amount: "",
                          reason: "",
                        })
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      Adjust
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Approve / Reject confirm dialog */}
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.action === "APPROVE" ? "Approve Submission?" : "Reject Submission?"}
          message={
            pendingAction.action === "APPROVE"
              ? `Approve "${pendingAction.productName}" for ${pendingAction.clientName}? Credits will be added to their account.`
              : `Reject "${pendingAction.productName}" for ${pendingAction.clientName}? No credits will be added.`
          }
          confirmLabel={pendingAction.action === "APPROVE" ? "Approve" : "Reject"}
          confirmClassName={
            pendingAction.action === "APPROVE"
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }
          onConfirm={() => handleAction(pendingAction.id, pendingAction.action)}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {/* Adjustment dialog */}
      {adjustmentForm && (
        <AdjustmentDialog
          form={adjustmentForm}
          onChange={setAdjustmentForm}
          onSubmit={handleAdjustSubmit}
          onClose={() => setAdjustmentForm(null)}
          submitting={adjustSubmitting}
          error={adjustError}
        />
      )}
    </CoachLayout>
  )
}
