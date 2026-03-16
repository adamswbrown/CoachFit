/**
 * POST /api/ingest/cronometer
 *
 * Cronometer CSV import via pairing token auth (for iOS app).
 * Same logic as POST /api/import/cronometer but uses X-Pairing-Token instead of Clerk session.
 */

import { NextRequest } from "next/server"
import { cronometerImportSchema } from "@/lib/validations"
import { db } from "@/lib/db"
import {
  validateIngestAuth,
  createIngestErrorResponse,
  createIngestSuccessResponse,
  handleIngestPreflight,
} from "@/lib/security/ingest-auth"

// The ingest variant adds client_id to the existing cronometer schema
import { z } from "zod"
const ingestCronometerSchema = cronometerImportSchema.extend({
  client_id: z.string().uuid("Invalid UUID format"),
})

interface ImportRowResult {
  date: string
  action: "created" | "merged" | "skipped"
  fieldsUpdated: string[]
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const body = await req.json()
    const parsed = ingestCronometerSchema.safeParse(body)

    if (!parsed.success) {
      return createIngestErrorResponse(
        { success: false, error: "Validation error", status: 400 },
        origin
      )
    }

    const { rows, client_id } = parsed.data

    // Validate authentication
    const authResult = await validateIngestAuth(req, client_id)
    if (!authResult.success) {
      return createIngestErrorResponse(authResult, origin)
    }

    const userId = client_id
    const results: ImportRowResult[] = []
    let created = 0
    let merged = 0
    let skipped = 0
    const errors: { date: string; message: string }[] = []

    for (const row of rows) {
      try {
        const date = new Date(row.date)
        date.setHours(0, 0, 0, 0)

        // Check for future dates
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        if (date > today) {
          errors.push({ date: row.date, message: "Future date not allowed" })
          skipped++
          continue
        }

        const existing = await db.entry.findUnique({
          where: { userId_date: { userId, date } },
        })

        const macroFields = ["calories", "proteinGrams", "carbsGrams", "fatGrams", "fiberGrams", "weightLbs"] as const

        if (existing) {
          // Merge: only update fields that are null on existing entry
          const updateData: Record<string, number> = {}
          const fieldsUpdated: string[] = []

          for (const field of macroFields) {
            const newValue = row[field]
            if (newValue != null && (existing as any)[field] == null) {
              updateData[field] = newValue
              fieldsUpdated.push(field)
            }
          }

          if (Object.keys(updateData).length === 0) {
            results.push({ date: row.date, action: "skipped", fieldsUpdated: [] })
            skipped++
            continue
          }

          // Update dataSources to include "cronometer"
          const existingSources = Array.isArray(existing.dataSources)
            ? (existing.dataSources as string[])
            : []
          const dataSources = existingSources.includes("cronometer")
            ? existingSources
            : [...existingSources, "cronometer"]

          await db.entry.update({
            where: { id: existing.id },
            data: { ...updateData, dataSources },
          })

          results.push({ date: row.date, action: "merged", fieldsUpdated })
          merged++
        } else {
          // Create new entry
          const fieldsUpdated: string[] = []
          const optionalFields: Record<string, number> = {}
          for (const field of macroFields) {
            const value = row[field]
            if (value != null) {
              optionalFields[field] = value
              fieldsUpdated.push(field)
            }
          }

          await db.entry.create({
            data: {
              userId,
              date,
              dataSources: ["cronometer"],
              ...optionalFields,
            },
          })
          results.push({ date: row.date, action: "created", fieldsUpdated })
          created++
        }
      } catch (err: any) {
        errors.push({ date: row.date, message: err.message || "Unknown error" })
        skipped++
      }
    }

    // Auto-mark user as having Cronometer linked on successful import
    if (created > 0 || merged > 0) {
      await db.user.update({
        where: { id: userId },
        data: { cronometerLinked: true },
      })
    }

    const statusCode = errors.length > 0 ? 207 : 200

    return createIngestSuccessResponse(
      {
        success: true,
        processed: rows.length,
        created,
        merged,
        skipped,
        results,
        ...(errors.length > 0 && { errors }),
      },
      origin,
      statusCode
    )
  } catch (error: unknown) {
    console.error("Error in /api/ingest/cronometer:", error)

    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      return createIngestErrorResponse(
        { success: false, error: "Validation error", status: 400 },
        origin
      )
    }

    return createIngestErrorResponse(
      { success: false, error: "Internal server error", status: 500 },
      origin
    )
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  return handleIngestPreflight(origin)
}
