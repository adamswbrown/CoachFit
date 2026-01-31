/**
 * POST /api/ingest/profile
 *
 * Endpoint for iOS app to send HealthKit body metrics (weight, height, etc.).
 *
 * SECURITY:
 * - Requires valid pairing token (X-Pairing-Token header)
 * - HealthKit must be enabled in system settings
 * - Rate limited per client
 */

import { NextRequest } from "next/server"
import { ingestProfileSchema, type ProfileMetric } from "@/lib/validations"
import { db } from "@/lib/db"
import { kgToLbs, metersToInches, cmToInches } from "@/lib/utils/unit-conversions"
import {
  validateIngestAuth,
  createIngestErrorResponse,
  createIngestSuccessResponse,
  handleIngestPreflight,
} from "@/lib/security/ingest-auth"

// Convert metric to imperial for storage
function convertToImperial(metric: ProfileMetric): { field: string; value: number } | null {
  switch (metric.metric) {
    case "weight":
      // Convert to lbs if in kg
      if (metric.unit === "kg") {
        return { field: "weightLbs", value: kgToLbs(metric.value) }
      } else if (metric.unit === "lbs") {
        return { field: "weightLbs", value: Math.round(metric.value * 10) / 10 }
      }
      return null

    case "height":
      // Convert to inches
      if (metric.unit === "m") {
        return { field: "heightInches", value: metersToInches(metric.value) }
      } else if (metric.unit === "cm") {
        return { field: "heightInches", value: cmToInches(metric.value) }
      } else if (metric.unit === "inches") {
        return { field: "heightInches", value: Math.round(metric.value) }
      }
      return null

    // Other metrics can be added here
    default:
      return null
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const body = await req.json()

    // Validate request body
    const validated = ingestProfileSchema.parse(body)

    // Validate authentication
    const authResult = await validateIngestAuth(req, validated.client_id)

    if (!authResult.success) {
      return createIngestErrorResponse(authResult, origin)
    }

    // Group metrics by date for batch processing
    const metricsByDate = new Map<string, { weightLbs?: number; heightInches?: number }>()

    for (const metric of validated.metrics) {
      const converted = convertToImperial(metric)
      if (!converted) continue

      // Extract date from measured_at
      const date = new Date(metric.measured_at)
      date.setHours(0, 0, 0, 0)
      const dateKey = date.toISOString().split("T")[0]

      const existing = metricsByDate.get(dateKey) || {}
      if (converted.field === "weightLbs") {
        existing.weightLbs = converted.value
      } else if (converted.field === "heightInches") {
        existing.heightInches = converted.value
      }
      metricsByDate.set(dateKey, existing)
    }

    // Process each date's metrics
    const results: { processed: number; errors: { date: string; message: string }[] } = {
      processed: 0,
      errors: [],
    }

    for (const [dateKey, metrics] of metricsByDate) {
      try {
        const date = new Date(dateKey)
        date.setHours(0, 0, 0, 0)

        // Build update data
        const updateData: {
          weightLbs?: number
          heightInches?: number
          dataSources: string[]
        } = {
          dataSources: ["healthkit"], // HealthKit overwrites, sets source
        }

        if (metrics.weightLbs !== undefined) {
          updateData.weightLbs = metrics.weightLbs
        }
        if (metrics.heightInches !== undefined) {
          updateData.heightInches = metrics.heightInches
        }

        // Upsert entry for this date
        await db.entry.upsert({
          where: {
            userId_date: {
              userId: validated.client_id,
              date: date,
            },
          },
          update: updateData,
          create: {
            userId: validated.client_id,
            date: date,
            ...updateData,
          },
        })

        results.processed++
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to process metrics"
        results.errors.push({
          date: dateKey,
          message,
        })
      }
    }

    // Return results
    const statusCode = results.errors.length > 0 ? 207 : 200

    return createIngestSuccessResponse(
      {
        success: results.processed > 0,
        processed: results.processed,
        total: metricsByDate.size,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
      origin,
      statusCode
    )
  } catch (error: unknown) {
    console.error("Error in /api/ingest/profile:", error)

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
