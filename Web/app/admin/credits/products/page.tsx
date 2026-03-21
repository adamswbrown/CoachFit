"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/permissions"
import { CoachLayout } from "@/components/layouts/CoachLayout"

interface CreditProduct {
  id: string
  name: string
  description: string | null
  creditMode: string
  creditsPerPeriod: number | null
  periodType: string
  purchasePriceGbp: number | null
  appliesToClassTypes: string[]
  purchasableByProviderOnly: boolean
  classEligible: boolean
  isActive: boolean
  allowRepeatPurchase: boolean
}

export default function AdminCreditProductsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [products, setProducts] = useState<CreditProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<CreditProduct | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formCreditMode, setFormCreditMode] = useState("ONE_TIME_PACK")
  const [formCredits, setFormCredits] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formActive, setFormActive] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    else if (session?.user && !isAdmin(session.user)) router.push("/dashboard")
  }, [status, session, router])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/credits/products")
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch {
      setError("Failed to load products")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (session) fetchProducts() }, [session, fetchProducts])

  const resetForm = () => {
    setFormName("")
    setFormDescription("")
    setFormCreditMode("ONE_TIME_PACK")
    setFormCredits("")
    setFormPrice("")
    setFormActive(true)
    setEditingProduct(null)
    setShowForm(false)
  }

  const startEdit = (product: CreditProduct) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormDescription(product.description || "")
    setFormCreditMode(product.creditMode)
    setFormCredits(product.creditsPerPeriod?.toString() || "")
    setFormPrice(product.purchasePriceGbp?.toString() || "")
    setFormActive(product.isActive)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const body: Record<string, unknown> = {
      name: formName,
      description: formDescription || undefined,
      creditMode: formCreditMode,
      creditsPerPeriod: formCredits ? parseInt(formCredits) : undefined,
      periodType: formCreditMode === "MONTHLY_TOPUP" ? "MONTH" : "ONE_TIME",
      purchasePriceGbp: formPrice ? parseFloat(formPrice) : undefined,
      isActive: formActive,
    }

    try {
      const url = editingProduct
        ? `/api/credits/products/${editingProduct.id}`
        : "/api/credits/products"
      const method = editingProduct ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Save failed")
      }

      resetForm()
      await fetchProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/credits/products/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      await fetchProducts()
    } catch {
      setError("Failed to delete product")
    }
  }

  const toggleActive = async (product: CreditProduct) => {
    try {
      const res = await fetch(`/api/credits/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !product.isActive }),
      })
      if (!res.ok) throw new Error("Update failed")
      await fetchProducts()
    } catch {
      setError("Failed to update product")
    }
  }

  if (status === "loading" || loading) {
    return <CoachLayout><div className="max-w-4xl mx-auto animate-pulse"><div className="h-8 w-48 bg-neutral-200 rounded mb-6" /></div></CoachLayout>
  }

  return (
    <CoachLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Credit Products</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Manage credit packs and subscription products.</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800"
          >
            Add Product
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}

        {showForm && (
          <div className="mb-6 bg-white border border-neutral-200 rounded-xl p-6">
            <h2 className="text-base font-medium text-neutral-900 mb-4">
              {editingProduct ? "Edit Product" : "New Product"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} required
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Mode</label>
                  <select value={formCreditMode} onChange={(e) => setFormCreditMode(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm">
                    <option value="ONE_TIME_PACK">One-Time Pack</option>
                    <option value="MONTHLY_TOPUP">Monthly Top-up</option>
                    <option value="CATALOG_ONLY">Catalog Only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Credits</label>
                  <input type="number" value={formCredits} onChange={(e) => setFormCredits(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Price (GBP)</label>
                  <input type="number" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
                <span className="text-sm text-neutral-700">Active</span>
              </label>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50">
                  {saving ? "Saving..." : editingProduct ? "Update" : "Create"}
                </button>
                <button type="button" onClick={resetForm}
                  className="px-4 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-700">Product</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-700">Mode</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-700">Credits</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-700">Price</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-700">Active</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{p.name}</div>
                    {p.description && <div className="text-xs text-neutral-500 mt-0.5">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{p.creditMode.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-right text-neutral-900">{p.creditsPerPeriod ?? "\u2014"}</td>
                  <td className="px-4 py-3 text-right text-neutral-900">
                    {p.purchasePriceGbp ? `\u00A3${p.purchasePriceGbp.toFixed(2)}` : "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(p)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(p)} className="text-blue-600 hover:text-blue-800 text-xs mr-3">Edit</button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="text-red-600 hover:text-red-800 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No products yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CoachLayout>
  )
}
