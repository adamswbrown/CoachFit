/**
 * POST /api/ingest/sleep
 *
 * Endpoint for iOS app to send HealthKit sleep data.
 * Stores detailed sleep records and merges into daily Entry records.
 *
 * SECURITY:
 * - Requires valid pairing token (X-Pairing-Token header)
 * - HealthKit must be enabled in system settings
 * - Rate limited per client
 *
 * CLIENT SYNC STRATEGY:
 * - First sync: Pulls all sleep data from last 365 days
 * - Subsequent syncs: Pulls only new data since last sync
 * - Each sync can send up to 400 sleep records
 *
 * Data Priority:
 * - Sleep stage details (deep, light, REM) are stored in SleepRecord model
 * - Total sleep minutes are also synced to Entry model (daily summary)
 * - If Entry has manual sleep data, preserve it and just mark dataSources as ["manual", "healthkit"]
 */

import { NextRequest } from "next/server"
import { ingestSleepSchema } from "@/lib/validations"
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
    const validated = ingestSleepSchema.parse(body)

    // Validate authentication
    const authResult = await validateIngestAuth(req, validated.client_id)

    if (!authResult.success) {
      return createIngestErrorResponse(authResult, origin)
    }

    // Process each sleep record
    const results: { processed: number; errors: { date: string; message: string }[] } = {
      processed: 0,
      errors: [],
    }

    for (const sleepRecord of validated.sleep_records) {
      try {
        const date = new Date(sleepRecord.date)
        date.setHours(0, 0, 0, 0)

        // Store/update detailed sleep record
        await db.sleepRecord.upsert({
          where: {
            userId_date: {
              userId: validated.client_id,
              date: date,
            },
          },
          update: {
            totalSleepMins: sleepRecord.total_sleep_minutes,
            inBedMins: sleepRecord.in_bed_minutes ?? null,
            awakeMins: sleepRecord.awake_minutes ?? null,
            asleepCoreMins: sleepRecord.asleep_core_minutes ?? null,
            asleepDeepMins: sleepRecord.asleep_deep_minutes ?? null,
            asleepREMMins: sleepRecord.asleep_rem_minutes ?? null,
            sleepStart: sleepRecord.sleep_start ? new Date(sleepRecord.sleep_start) : null,
            sleepEnd: sleepRecord.sleep_end ? new Date(sleepRecord.sleep_end) : null,
            sourceDevices: sleepRecord.source_devices ?? [],
          },
          create: {
            userId: validated.client_id,
            date: date,
            totalSleepMins: sleepRecord.total_sleep_minutes,
            inBedMins: sleepRecord.in_bed_minutes ?? null,
            awakeMins: sleepRecord.awake_minutes ?? null,
            asleepCoreMins: sleepRecord.asleep_core_minutes ?? null,
            asleepDeepMins: sleepRecord.asleep_deep_minutes ?? null,
            asleepREMMins: sleepRecord.asleep_rem_minutes ?? null,
            sleepStart: sleepRecord.sleep_start ? new Date(sleepRecord.sleep_start) : null,
            sleepEnd: sleepRecord.sleep_end ? new Date(sleepRecord.sleep_end) : null,
            sourceDevices: sleepRecord.source_devices ?? [],
          },
        })

        // Also merge into daily Entry (for daily summary)
        const existingEntry = await db.entry.findUnique({
          where: {
            userId_date: {
              userId: validated.client_id,
              date: date,
            },
          },
          select: {
            id: true,
            dataSources: true,
          },
        })

        let entryUpdateData: Record<string, unknown>

        if (existingEntry) {
          // Entry exists - check if it has manual sleep data
          const dataSources = Array.isArray(existingEntry.dataSources)
            ? existingEntry.dataSources
            : []
          const hasManualSleep = dataSources.includes("manual")

          if (hasManualSleep) {
            // Manual data exists - preserve it, but mark that we have both manual and healthkit
            entryUpdateData = {
              dataSources: Array.from(new Set([...dataSources, "healthkit"])),
              // Don't update sleep fields - keep the manual values
            }
          } else {
            // No manual data - update with HealthKit sleep minutes
            entryUpdateData = {
              dataSources: ["healthkit"],
            }
          }
        } else {
          // No existing entry - create new one with HealthKit data marker
          entryUpdateData = {
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
          update: entryUpdateData,
          create: {
            userId: validated.client_id,
            date: date,
            dataSources: ["healthkit"],
          },
        })

        results.processed++
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to process sleep record"
        results.errors.push({
          date: sleepRecord.date,
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
        total: validated.sleep_records.length,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
      origin,
      statusCode
    )
  } catch (error: unknown) {
    console.error("Error in /api/ingest/sleep:", error)

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
