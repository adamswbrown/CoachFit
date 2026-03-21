"use client"

import { useState } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { CoachLayout } from "@/components/layouts/CoachLayout"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductFormState {
  name: string
  description: string
  creditMode: "MONTHLY_TOPUP" | "ONE_TIME_PACK" | "CATALOG_ONLY"
  creditsPerPeriod: string
  periodType: "MONTH" | "ONE_TIME"
  purchasePriceGbp: string
  appliesToClassTypes: string
  purchasableByProviderOnly: boolean
  classEligible: boolean
  allowRepeatPurchase: boolean
  rolloverPolicy: "NONE" | "CAPPED" | "UNLIMITED"
}

const DEFAULT_FORM: ProductFormState = {
  name: "",
  description: "",
  creditMode: "ONE_TIME_PACK",
  creditsPerPeriod: "",
  periodType: "ONE_TIME",
  purchasePriceGbp: "",
  appliesToClassTypes: "",
  purchasableByProviderOnly: false,
  classEligible: true,
  allowRepeatPurchase: true,
  rolloverPolicy: "NONE",
}

// ─── Form Component ───────────────────────────────────────────────────────────

export default function NewCreditProductPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [form, setForm] = useState<ProductFormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "loading") {
    return (
      <CoachLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-neutral-200 rounded" />
            <div className="h-64 bg-neutral-200 rounded-xl" />
          </div>
        </div>
      </CoachLayout>
    )
  }

  if (!session?.user) return null

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const creditsPerPeriod = form.creditsPerPeriod ? parseInt(form.creditsPerPeriod, 10) : undefined
      const purchasePriceGbp = form.purchasePriceGbp ? parseFloat(form.purchasePriceGbp) : undefined
      const appliesToClassTypes = form.appliesToClassTypes
        ? form.appliesToClassTypes.split(",").map((s) => s.trim()).filter(Boolean)
        : []

      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        creditMode: form.creditMode,
        creditsPerPeriod,
        periodType: form.periodType,
        purchasePriceGbp,
        appliesToClassTypes,
        purchasableByProviderOnly: form.purchasableByProviderOnly,
        classEligible: form.classEligible,
        allowRepeatPurchase: form.allowRepeatPurchase,
        rolloverPolicy: form.rolloverPolicy,
      }

      const res = await fetch("/api/credits/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create product")
      }

      router.push("/coach-dashboard/credits")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CoachLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <a
              href="/coach-dashboard/credits"
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              &larr; Credits
            </a>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-900">New Credit Product</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Create a credit pack or subscription that clients can purchase.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              maxLength={200}
              placeholder="e.g. 10-Class Pack"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              placeholder="Optional: shown to clients when browsing packs"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400 resize-none"
            />
          </div>

          {/* Credit mode */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Credit Mode <span className="text-red-500">*</span>
            </label>
            <select
              name="creditMode"
              value={form.creditMode}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400 bg-white"
            >
              <option value="ONE_TIME_PACK">One-Time Pack</option>
              <option value="MONTHLY_TOPUP">Monthly Top-Up</option>
              <option value="CATALOG_ONLY">Catalogue Only (provider assigns)</option>
            </select>
          </div>

          {/* Credits per period */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Credits Awarded
            </label>
            <input
              type="number"
              name="creditsPerPeriod"
              value={form.creditsPerPeriod}
              onChange={handleChange}
              min={1}
              placeholder="e.g. 10"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400"
            />
          </div>

          {/* Period type */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Period Type
            </label>
            <select
              name="periodType"
              value={form.periodType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400 bg-white"
            >
              <option value="ONE_TIME">One-Time</option>
              <option value="MONTH">Monthly</option>
            </select>
          </div>

          {/* Purchase price */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Purchase Price (£)
            </label>
            <input
              type="number"
              name="purchasePriceGbp"
              value={form.purchasePriceGbp}
              onChange={handleChange}
              min={0}
              step="0.01"
              placeholder="e.g. 50.00"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400"
            />
          </div>

          {/* Applies to class types */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Applies to Class Types
            </label>
            <input
              type="text"
              name="appliesToClassTypes"
              value={form.appliesToClassTypes}
              onChange={handleChange}
              placeholder="e.g. Yoga, HIIT (comma-separated, leave blank for all)"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Comma-separated list of class types this pack can be used for. Leave blank to apply to all.
            </p>
          </div>

          {/* Rollover policy */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Rollover Policy
            </label>
            <select
              name="rolloverPolicy"
              value={form.rolloverPolicy}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-400 bg-white"
            >
              <option value="NONE">None (credits expire at period end)</option>
              <option value="CAPPED">Capped (unused credits roll over up to a cap)</option>
              <option value="UNLIMITED">Unlimited (all unused credits roll over)</option>
            </select>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="purchasableByProviderOnly"
                checked={form.purchasableByProviderOnly}
                onChange={handleChange}
                className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">Provider-only purchase</span>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Only coaches/admins can assign this product. It will not appear in the client store.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="classEligible"
                checked={form.classEligible}
                onChange={handleChange}
                className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">Class eligible</span>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Credits from this product can be spent on class bookings.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="allowRepeatPurchase"
                checked={form.allowRepeatPurchase}
                onChange={handleChange}
                className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
              />
              <div>
                <span className="text-sm font-medium text-neutral-700">Allow repeat purchase</span>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Clients can buy this product more than once.
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-100">
            <a
              href="/coach-dashboard/credits"
              className="px-4 py-2 text-sm rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-neutral-900 hover:bg-neutral-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating…" : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </CoachLayout>
  )
}
