"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"

type CreditSubmissionRow = {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  revolutReference: string
  note?: string | null
  createdAt: string
  client: {
    id: string
    name: string | null
    email: string
  }
  creditProduct: {
    id: string
    name: string
    creditMode: string
    creditsPerPeriod: number | null
  }
  reviewedByUser?: {
    id: string
    name: string | null
    email: string
  } | null
}

type CreditProductRow = {
  id: string
  name: string
  classEligible: boolean
  creditMode: string
  creditsPerPeriod: number | null
  periodType: string
  purchasePriceGbp: number | null
  purchasableByProviderOnly: boolean
  isActive: boolean
}

const defaultProductForm = {
  name: "",
  description: "",
  appliesToClassTypes: "HIIT,CORE,STRENGTH",
  creditMode: "ONE_TIME_PACK",
  creditsPerPeriod: 1,
  periodType: "ONE_TIME",
  purchasePriceGbp: "",
  purchasableByProviderOnly: false,
  classEligible: true,
}

export default function CoachClassCreditsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<CreditSubmissionRow[]>([])
  const [products, setProducts] = useState<CreditProductRow[]>([])
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null)

  const [showProductForm, setShowProductForm] = useState(false)
  const [productBusy, setProductBusy] = useState(false)
  const [productForm, setProductForm] = useState(defaultProductForm)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (!session?.user) return

    if (!isAdminOrCoach(session.user)) {
      if (session.user.roles.includes(Role.CLIENT)) {
        router.push("/client-dashboard")
      } else {
        router.push("/login")
      }
      return
    }

    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [submissionsRes, productsRes] = await Promise.all([
        fetch("/api/classes/credit-submissions"),
        fetch("/api/classes/credit-products"),
      ])

      if (!submissionsRes.ok || !productsRes.ok) {
        throw new Error("Failed to load credit data")
      }

      const submissionsJson = await submissionsRes.json()
      const productsJson = await productsRes.json()

      setSubmissions(submissionsJson.submissions || [])
      setProducts(productsJson.products || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load credit data")
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (submissionId: string, action: "APPROVE" | "REJECT") => {
    setReviewBusyId(submissionId)
    setError(null)

    try {
      const res = await fetch(`/api/classes/credit-submissions/${submissionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to review submission")
      }

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review submission")
    } finally {
      setReviewBusyId(null)
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setProductBusy(true)
    setError(null)

    try {
      const payload = {
        ...productForm,
        description: productForm.description || null,
        appliesToClassTypes: productForm.appliesToClassTypes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        creditsPerPeriod: Number(productForm.creditsPerPeriod),
        purchasePriceGbp: productForm.purchasePriceGbp
          ? Number(productForm.purchasePriceGbp)
          : null,
      }

      const res = await fetch("/api/classes/credit-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create credit product")
      }

      setProductForm(defaultProductForm)
      setShowProductForm(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create credit product")
    } finally {
      setProductBusy(false)
    }
  }

  if (loading) {
    return (
      <CoachLayout>
        <div className="max-w-7xl mx-auto py-8">Loading credits...</div>
      </CoachLayout>
    )
  }

  if (!session?.user || !isAdminOrCoach(session.user)) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/coach-dashboard/classes" className="text-sm text-neutral-600 hover:underline">
              Back to classes
            </Link>
            <h1 className="text-2xl font-semibold text-neutral-900 mt-1">Class Credits</h1>
            <p className="text-sm text-neutral-600 mt-1">
              {submissions.filter((submission) => submission.status === "PENDING").length} pending submissions
            </p>
          </div>
          <button
            onClick={() => setShowProductForm((prev) => !prev)}
            className="px-3 py-2 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800"
          >
            {showProductForm ? "Close" : "New Product"}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        )}

        {showProductForm && (
          <form onSubmit={handleCreateProduct} className="bg-white border border-neutral-200 rounded-lg p-4 grid gap-3">
            <h2 className="font-semibold text-neutral-900">Create Credit Product</h2>
            <div className="grid md:grid-cols-3 gap-3">
              <input
                value={productForm.name}
                onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Product name"
                className="px-3 py-2 border border-neutral-300 rounded-md"
                required
              />
              <select
                value={productForm.creditMode}
                onChange={(e) => setProductForm((prev) => ({ ...prev, creditMode: e.target.value }))}
                className="px-3 py-2 border border-neutral-300 rounded-md"
              >
                <option value="ONE_TIME_PACK">One-time pack</option>
                <option value="MONTHLY_TOPUP">Monthly top-up</option>
                <option value="CATALOG_ONLY">Catalog only</option>
              </select>
              <input
                type="number"
                min={0}
                value={productForm.creditsPerPeriod}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, creditsPerPeriod: Number(e.target.value) || 0 }))
                }
                className="px-3 py-2 border border-neutral-300 rounded-md"
                placeholder="Credits"
              />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <select
                value={productForm.periodType}
                onChange={(e) => setProductForm((prev) => ({ ...prev, periodType: e.target.value }))}
                className="px-3 py-2 border border-neutral-300 rounded-md"
              >
                <option value="ONE_TIME">One-time</option>
                <option value="MONTH">Month</option>
              </select>
              <input
                value={productForm.purchasePriceGbp}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, purchasePriceGbp: e.target.value }))
                }
                placeholder="Price GBP"
                className="px-3 py-2 border border-neutral-300 rounded-md"
              />
              <input
                value={productForm.appliesToClassTypes}
                onChange={(e) =>
                  setProductForm((prev) => ({ ...prev, appliesToClassTypes: e.target.value }))
                }
                placeholder="Class types"
                className="px-3 py-2 border border-neutral-300 rounded-md"
              />
            </div>
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              className="px-3 py-2 border border-neutral-300 rounded-md"
              rows={2}
            />
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={productForm.classEligible}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, classEligible: e.target.checked }))}
                />
                Class-eligible
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={productForm.purchasableByProviderOnly}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, purchasableByProviderOnly: e.target.checked }))
                  }
                />
                Provider-only purchase
              </label>
            </div>
            <div>
              <button
                type="submit"
                disabled={productBusy}
                className="px-4 py-2 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {productBusy ? "Saving..." : "Create Product"}
              </button>
            </div>
          </form>
        )}

        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">Pending Submissions</h2>
          </div>
          {submissions.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600">No submissions.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-2">Client</th>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Reference</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="border-t border-neutral-100 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">
                          {submission.client.name || submission.client.email}
                        </div>
                        <div className="text-xs text-neutral-500">{submission.client.email}</div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        <div>{submission.creditProduct.name}</div>
                        <div className="text-xs text-neutral-500">
                          {submission.creditProduct.creditMode}
                          {submission.creditProduct.creditsPerPeriod
                            ? ` • ${submission.creditProduct.creditsPerPeriod} credits`
                            : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        <div>{submission.revolutReference}</div>
                        {submission.note ? (
                          <div className="text-xs text-neutral-500 mt-1">{submission.note}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            submission.status === "PENDING"
                              ? "bg-amber-100 text-amber-700"
                              : submission.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-neutral-200 text-neutral-700"
                          }`}
                        >
                          {submission.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {submission.status === "PENDING" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReview(submission.id, "APPROVE")}
                              disabled={reviewBusyId === submission.id}
                              className="px-2 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReview(submission.id, "REJECT")}
                              disabled={reviewBusyId === submission.id}
                              className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-500">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">Credit Products</h2>
          </div>
          {products.length === 0 ? (
            <div className="p-4 text-sm text-neutral-600">No products configured.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-neutral-600">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Mode</th>
                    <th className="px-4 py-2">Credits</th>
                    <th className="px-4 py-2">Price</th>
                    <th className="px-4 py-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-t border-neutral-100">
                      <td className="px-4 py-3 text-neutral-900 font-medium">{product.name}</td>
                      <td className="px-4 py-3 text-neutral-700">{product.creditMode}</td>
                      <td className="px-4 py-3 text-neutral-700">{product.creditsPerPeriod ?? "-"}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {product.purchasePriceGbp != null ? `£${product.purchasePriceGbp}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {product.classEligible ? "Class" : "Catalog"}
                        {product.purchasableByProviderOnly ? " • Provider-only" : ""}
                        {!product.isActive ? " • Inactive" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </CoachLayout>
  )
}
