/**
 * POST /api/ingest/steps
 *
 * Endpoint for iOS app to send HealthKit step count data.
 *
 * SECURITY:
 * - Requires valid pairing token (X-Pairing-Token header)
 * - HealthKit must be enabled in system settings
 * - Rate limited per client
 *
 * CLIENT SYNC STRATEGY:
 * - First sync: Pulls all step data from last 365 days
 * - Subsequent syncs: Pulls only new data since last sync
 * - Aggregated daily (one record per day) from HealthKit statistics
 *
 * Data Priority:
 * - If Entry already exists with "manual" in dataSources, preserve manual value
 * - Only update steps if no manual data exists for that date
 * - Set dataSources to ["manual", "healthkit"] if manual exists, ["healthkit"] if only HealthKit
 */

import { NextRequest } from "next/server"
import { ingestStepsSchema } from "@/lib/validations"
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

    // Validate request body
    const validated = ingestStepsSchema.parse(body)

    // Validate authentication
    const authResult = await validateIngestAuth(req, validated.client_id)

    if (!authResult.success) {
      return createIngestErrorResponse(authResult, origin)
    }

    // Process each step record
    const results: { processed: number; errors: { date: string; message: string }[] } = {
      processed: 0,
      errors: [],
    }

    for (const stepRecord of validated.steps) {
      try {
        const date = new Date(stepRecord.date)
        date.setHours(0, 0, 0, 0)

        // Check if entry exists for this date
        const existingEntry = await db.entry.findUnique({
          where: {
            userId_date: {
              userId: validated.client_id,
              date: date,
            },
          },
          select: { steps: true, dataSources: true },
        })

        let updateData: Record<string, unknown>

        if (existingEntry) {
          // Entry exists - check if it has manual data
          const dataSources = Array.isArray(existingEntry.dataSources)
            ? existingEntry.dataSources
            : []
          const hasManualData = dataSources.includes("manual")

          if (hasManualData) {
            // Manual data exists - preserve it, but mark that we have both manual and healthkit
            updateData = {
              dataSources: Array.from(new Set([...dataSources, "healthkit"])),
              // Don't update steps - keep the manual value
            }
          } else {
            // No manual data - update with HealthKit value
            updateData = {
              steps: stepRecord.total_steps,
              dataSources: ["healthkit"],
            }
          }
        } else {
          // No existing entry - create new one with HealthKit data
          updateData = {
            steps: stepRecord.total_steps,
            dataSources: ["healthkit"],
          }
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
            steps: stepRecord.total_steps,
            dataSources: ["healthkit"],
          },
        })

        results.processed++
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to process step record"
        results.errors.push({
          date: stepRecord.date,
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
        total: validated.steps.length,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
      origin,
      statusCode
    )
  } catch (error: unknown) {
    console.error("Error in /api/ingest/steps:", error)

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
