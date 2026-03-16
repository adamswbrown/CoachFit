/**
 * POST /api/ingest/entry
 *
 * Daily check-in submission via pairing token auth (for iOS app).
 * Same validation as POST /api/entries but uses X-Pairing-Token instead of Clerk session.
 *
 * Merge strategy:
 * - On create: sets dataSources to ["manual"]
 * - On update: only fills null fields, appends "manual" to dataSources if not already present
 * - Never overwrites data written by HealthKit or Cronometer
 */

import { NextRequest } from "next/server"
import { ingestEntrySchema } from "@/lib/validations"
import { db } from "@/lib/db"
import {
  validateIngestAuth,
  createIngestErrorResponse,
  createIngestSuccessResponse,
  handleIngestPreflight,
} from "@/lib/security/ingest-auth"

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const body = await req.json()
    const validated = ingestEntrySchema.parse(body)

    // Validate authentication
    const authResult = await validateIngestAuth(req, validated.client_id)
    if (!authResult.success) {
      return createIngestErrorResponse(authResult, origin)
    }

    const date = new Date(validated.date)
    date.setHours(0, 0, 0, 0)

    // Check for future dates
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (date > today) {
      return createIngestErrorResponse(
        { success: false, error: "Future date not allowed", status: 400 },
        origin
      )
    }

    // Check for existing entry
    const existing = await db.entry.findUnique({
      where: {
        userId_date: {
          userId: validated.client_id,
          date,
        },
      },
    })

    // Fields that can be set from a manual check-in
    const manualFields = [
      "weightLbs", "steps", "calories", "proteinGrams", "carbsGrams",
      "fatGrams", "fiberGrams", "sleepQuality", "perceivedStress", "notes",
    ] as const

    if (existing) {
      // Merge: only fill null fields on existing entry
      const updateData: Record<string, unknown> = {}
      const fieldsUpdated: string[] = []

      for (const field of manualFields) {
        const newValue = validated[field]
        if (newValue != null && (existing as Record<string, unknown>)[field] == null) {
          updateData[field] = newValue
          fieldsUpdated.push(field)
        }
      }

      // Update dataSources to include "manual"
      const existingSources = Array.isArray(existing.dataSources)
        ? (existing.dataSources as string[])
        : []
      if (!existingSources.includes("manual")) {
        updateData.dataSources = [...existingSources, "manual"]
      }

      if (Object.keys(updateData).length === 0) {
        // Nothing to update — entry already has all these fields filled
        return createIngestSuccessResponse(
          {
            success: true,
            action: "skipped",
            message: "All fields already populated",
            entry_id: existing.id,
          },
          origin,
          200
        )
      }

      const entry = await db.entry.update({
        where: { id: existing.id },
        data: updateData,
      })

      return createIngestSuccessResponse(
        {
          success: true,
          action: "merged",
          fields_updated: fieldsUpdated,
          entry_id: entry.id,
        },
        origin,
        200
      )
    } else {
      // Create new entry
      const createData: Record<string, unknown> = {
        userId: validated.client_id,
        date,
        dataSources: ["manual"],
      }

      for (const field of manualFields) {
        const value = validated[field]
        if (value != null) {
          createData[field] = value
        }
      }

      const entry = await db.entry.create({
        data: createData as any,
      })

      return createIngestSuccessResponse(
        {
          success: true,
          action: "created",
          entry_id: entry.id,
        },
        origin,
        201
      )
    }
  } catch (error: unknown) {
    console.error("Error in /api/ingest/entry:", error)

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
