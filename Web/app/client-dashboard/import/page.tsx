"use client"

import { useState, useCallback } from "react"
import { useSession } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { ClientLayout } from "@/components/layouts/ClientLayout"
import {
  parseCronometerDailyNutrition,
  type ParsedCronometerRow,
  type CronometerParseResult,
} from "@/lib/cronometer-csv"

interface ExistingEntry {
  id: string
  date: string
  calories: number | null
  proteinGrams: number | null
  carbsGrams: number | null
  fatGrams: number | null
  fiberGrams: number | null
  weightLbs: number | null
  dataSources: string[] | null
}

type ConflictResolution = "cronometer" | "keep"

interface PreviewRow {
  date: string
  csvData: ParsedCronometerRow
  existing: ExistingEntry | null
  status: "new" | "conflict" | "no_change"
  conflicts: {
    field: string
    existingValue: number
    cronometerValue: number
    resolution: ConflictResolution
  }[]
}

type Step = "upload" | "preview" | "importing" | "done"

interface ImportResult {
  success: boolean
  processed: number
  created: number
  merged: number
  skipped: number
}

const MACRO_FIELDS = [
  { key: "calories", label: "Calories" },
  { key: "proteinGrams", label: "Protein (g)" },
  { key: "carbsGrams", label: "Carbs (g)" },
  { key: "fatGrams", label: "Fat (g)" },
  { key: "fiberGrams", label: "Fiber (g)" },
] as const

export default function ImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [step, setStep] = useState<Step>("upload")
  const [parseResult, setParseResult] = useState<CronometerParseResult | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setError(null)
      setLoading(true)

      try {
        const text = await file.text()
        const result = parseCronometerDailyNutrition(text)

        if (result.rows.length === 0) {
          setError(
            result.warnings.length > 0
              ? result.warnings.join(" ")
              : "No nutrition data found in this CSV. Make sure you're uploading a Cronometer Daily Nutrition export."
          )
          setLoading(false)
          return
        }

        if (result.rows.length > 400) {
          setError("Maximum 400 rows per import. Please split your CSV into smaller date ranges.")
          setLoading(false)
          return
        }

        setParseResult(result)

        // Fetch existing entries for the date range
        const dates = result.rows.map((r) => r.date).sort()
        const startDate = dates[0]
        const endDate = dates[dates.length - 1]

        const res = await fetch(
          `/api/entries?startDate=${startDate}&endDate=${endDate}&limit=1000`
        )
        const existingEntries: ExistingEntry[] = res.ok ? await res.json() : []

        // Build a map of existing entries by date
        const existingMap = new Map<string, ExistingEntry>()
        for (const entry of existingEntries) {
          const dateStr = new Date(entry.date).toISOString().split("T")[0]
          existingMap.set(dateStr, entry)
        }

        // Build preview rows
        const preview: PreviewRow[] = result.rows.map((csvRow) => {
          const existing = existingMap.get(csvRow.date) || null

          if (!existing) {
            return { date: csvRow.date, csvData: csvRow, existing: null, status: "new" as const, conflicts: [] }
          }

          // Check for conflicts
          const conflicts: PreviewRow["conflicts"] = []
          for (const { key } of MACRO_FIELDS) {
            const existingVal = (existing as any)[key]
            const csvVal = (csvRow as any)[key]
            if (existingVal != null && csvVal != null && existingVal !== csvVal) {
              conflicts.push({
                field: key,
                existingValue: existingVal,
                cronometerValue: csvVal,
                resolution: "cronometer",
              })
            }
          }

          if (conflicts.length === 0) {
            // Check if there's new data to fill in
            const hasNewData = MACRO_FIELDS.some(
              ({ key }) => (existing as any)[key] == null && (csvRow as any)[key] != null
            )
            return {
              date: csvRow.date,
              csvData: csvRow,
              existing,
              status: hasNewData ? "new" as const : "no_change" as const,
              conflicts: [],
            }
          }

          return { date: csvRow.date, csvData: csvRow, existing, status: "conflict" as const, conflicts }
        })

        setPreviewRows(preview)
        setStep("preview")
      } catch (err: any) {
        setError(`Failed to parse CSV: ${err.message}`)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const setConflictResolution = useCallback(
    (date: string, field: string, resolution: ConflictResolution) => {
      setPreviewRows((prev) =>
        prev.map((row) => {
          if (row.date !== date) return row
          return {
            ...row,
            conflicts: row.conflicts.map((c) =>
              c.field === field ? { ...c, resolution } : c
            ),
          }
        })
      )
    },
    []
  )

  const setBulkResolution = useCallback((resolution: ConflictResolution) => {
    setPreviewRows((prev) =>
      prev.map((row) => ({
        ...row,
        conflicts: row.conflicts.map((c) => ({ ...c, resolution })),
      }))
    )
  }, [])

  const handleImport = useCallback(async () => {
    setStep("importing")
    setError(null)

    try {
      // Build the final rows to import, applying conflict resolutions
      const rows = previewRows
        .filter((r) => r.status !== "no_change")
        .map((row) => {
          const finalRow: any = { date: row.date }

          for (const { key } of MACRO_FIELDS) {
            const conflict = row.conflicts.find((c) => c.field === key)
            if (conflict) {
              if (conflict.resolution === "cronometer") {
                finalRow[key] = conflict.cronometerValue
              }
              // "keep" means don't include the field — API will skip null fields on existing entries
            } else {
              const csvVal = (row.csvData as any)[key]
              if (csvVal != null) {
                finalRow[key] = csvVal
              }
            }
          }

          return finalRow
        })

      if (rows.length === 0) {
        setImportResult({ success: true, processed: 0, created: 0, merged: 0, skipped: 0 })
        setStep("done")
        return
      }

      const res = await fetch("/api/import/cronometer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Import failed (${res.status})`)
      }

      const result = await res.json()
      setImportResult(result)
      setStep("done")
    } catch (err: any) {
      setError(`Import failed: ${err.message}`)
      setStep("preview")
    }
  }, [previewRows])

  if (status === "loading") {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-neutral-500">Loading...</p>
        </div>
      </ClientLayout>
    )
  }

  const conflictCount = previewRows.filter((r) => r.status === "conflict").length
  const newCount = previewRows.filter((r) => r.status === "new").length
  const noChangeCount = previewRows.filter((r) => r.status === "no_change").length

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900">Import Cronometer Data</h1>
          <p className="text-neutral-600 mt-1">
            Upload a CSV export from Cronometer to import your nutrition data.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <h3 className="font-semibold text-blue-900 mb-3 text-base">How to export your data from Cronometer</h3>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">1</span>
                  <div className="text-sm text-blue-800">
                    <p>Log into your account at <strong>cronometer.com</strong> (you&apos;ll need a <strong>Gold</strong> subscription for data export).</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">2</span>
                  <div className="text-sm text-blue-800">
                    <p>Click your <strong>profile icon</strong> in the top-right corner, then select <strong>Account</strong>.</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">3</span>
                  <div className="text-sm text-blue-800">
                    <p>Scroll down to the <strong>Export Data</strong> section.</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">4</span>
                  <div className="text-sm text-blue-800">
                    <p>Set your <strong>date range</strong> &mdash; choose the period you want to import (e.g., the last 4 weeks).</p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">5</span>
                  <div className="text-sm text-blue-800">
                    <p>Under export type, select <strong>&quot;Daily Nutrition&quot;</strong>. This gives you one row per day with your total calories, protein, carbs, fat, and fiber.</p>
                    <p className="mt-1 text-blue-600 text-xs italic">Tip: &quot;Servings&quot; exports individual food items &mdash; that&apos;s not what you need here.</p>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center">6</span>
                  <div className="text-sm text-blue-800">
                    <p>Click <strong>Export</strong> to download the <code className="bg-blue-100 px-1 rounded">.csv</code> file, then upload it below.</p>
                  </div>
                </div>
              </div>

              {/* What gets imported */}
              <div className="mt-4 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-700 font-medium mb-1">What gets imported:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Calories</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Protein</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Carbs</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Fat</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Fiber</span>
                </div>
                <p className="text-xs text-blue-600 mt-2">Your existing manually-entered data (steps, sleep, etc.) won&apos;t be overwritten. You&apos;ll get a chance to review everything before importing.</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                  {loading ? "Processing..." : "Choose CSV File"}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={loading}
                  className="hidden"
                />
              </label>
              <p className="mt-2 text-xs text-neutral-500">CSV files only, max 400 rows</p>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && parseResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {newCount} new
              </span>
              {conflictCount > 0 && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                  {conflictCount} conflicts
                </span>
              )}
              {noChangeCount > 0 && (
                <span className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded-full text-sm font-medium">
                  {noChangeCount} unchanged
                </span>
              )}
              {parseResult.warnings.length > 0 && (
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                  {parseResult.warnings.length} warnings
                </span>
              )}
            </div>

            {parseResult.unmappedColumns.length > 0 && (
              <p className="text-xs text-neutral-500">
                Unmapped columns (ignored): {parseResult.unmappedColumns.join(", ")}
              </p>
            )}

            {parseResult.warnings.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                {parseResult.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}

            {/* Bulk actions for conflicts */}
            {conflictCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-neutral-600">For all conflicts:</span>
                <button
                  onClick={() => setBulkResolution("cronometer")}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                >
                  Use Cronometer values
                </button>
                <button
                  onClick={() => setBulkResolution("keep")}
                  className="px-3 py-1 bg-neutral-100 text-neutral-600 rounded hover:bg-neutral-200 transition-colors"
                >
                  Keep existing values
                </button>
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Status</th>
                    {MACRO_FIELDS.map(({ key, label }) => (
                      <th key={key} className="px-3 py-2 text-right font-medium text-neutral-600">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {previewRows.map((row) => (
                    <tr
                      key={row.date}
                      className={
                        row.status === "new"
                          ? "bg-green-50/50"
                          : row.status === "conflict"
                            ? "bg-yellow-50/50"
                            : ""
                      }
                    >
                      <td className="px-3 py-2 font-mono text-xs">{row.date}</td>
                      <td className="px-3 py-2">
                        {row.status === "new" && (
                          <span className="text-green-600 text-xs font-medium">New</span>
                        )}
                        {row.status === "conflict" && (
                          <span className="text-yellow-600 text-xs font-medium">Conflict</span>
                        )}
                        {row.status === "no_change" && (
                          <span className="text-neutral-400 text-xs">No change</span>
                        )}
                      </td>
                      {MACRO_FIELDS.map(({ key }) => {
                        const conflict = row.conflicts.find((c) => c.field === key)
                        const csvVal = (row.csvData as any)[key]

                        if (conflict) {
                          return (
                            <td key={key} className="px-3 py-2 text-right">
                              <div className="space-y-1">
                                <button
                                  onClick={() =>
                                    setConflictResolution(row.date, key, "cronometer")
                                  }
                                  className={`block w-full text-right text-xs px-1 py-0.5 rounded ${
                                    conflict.resolution === "cronometer"
                                      ? "bg-green-100 text-green-700 font-medium"
                                      : "text-neutral-400 hover:bg-neutral-100"
                                  }`}
                                >
                                  {conflict.cronometerValue} (new)
                                </button>
                                <button
                                  onClick={() =>
                                    setConflictResolution(row.date, key, "keep")
                                  }
                                  className={`block w-full text-right text-xs px-1 py-0.5 rounded ${
                                    conflict.resolution === "keep"
                                      ? "bg-blue-100 text-blue-700 font-medium"
                                      : "text-neutral-400 hover:bg-neutral-100"
                                  }`}
                                >
                                  {conflict.existingValue} (keep)
                                </button>
                              </div>
                            </td>
                          )
                        }

                        return (
                          <td key={key} className="px-3 py-2 text-right text-xs">
                            {csvVal != null ? csvVal : <span className="text-neutral-300">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleImport}
                disabled={newCount + conflictCount === 0 && previewRows.some((r) => r.status === "new")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {newCount + conflictCount} {newCount + conflictCount === 1 ? "entry" : "entries"}
              </button>
              <button
                onClick={() => {
                  setStep("upload")
                  setParseResult(null)
                  setPreviewRows([])
                  setError(null)
                }}
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors text-sm"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <p className="text-neutral-600">Importing your data...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <svg
                className="mx-auto h-10 w-10 text-green-500 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <h3 className="text-lg font-semibold text-green-900">Import Complete</h3>
              <div className="mt-2 text-sm text-green-700 space-y-1">
                <p>{importResult.created} entries created</p>
                <p>{importResult.merged} entries merged</p>
                {importResult.skipped > 0 && (
                  <p>{importResult.skipped} entries skipped</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/client-dashboard")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => {
                  setStep("upload")
                  setParseResult(null)
                  setPreviewRows([])
                  setImportResult(null)
                  setError(null)
                }}
                className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors text-sm"
              >
                Import More
              </button>
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  )
}
