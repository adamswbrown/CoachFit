/**
 * POST /api/ingest/sleep
 *
 * Endpoint for iOS app to send HealthKit sleep data.
 * Stores detailed sleep records and merges into daily Entry records.
 * 
 * CLIENT SYNC STRATEGY:
 * - First sync: Pulls all sleep data from last 365 days
 * - Subsequent syncs: Pulls only new data since last sync (client tracks via timestamp)
 * - Each sync can send up to 400 sleep records (supports 365-day batches)
 * 
 * Data Priority:
 * - Sleep stage details (deep, light, REM) are stored in SleepRecord model
 * - Total sleep minutes are also synced to Entry model (daily summary)
 * - If Entry has manual sleep data, preserve it and just mark dataSources as ["manual", "healthkit"]
 * - HealthKit total_sleep_minutes only overwrites if no manual data exists
 * 
 * This ensures manual entries take precedence over HealthKit data.
 */

import { NextRequest, NextResponse } from "next/server"
import { ingestSleepSchema } from "@/lib/validations"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validated = ingestSleepSchema.parse(body)

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id: validated.client_id },
      select: { id: true },
    })

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      )
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
        // Check if entry exists for this date
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

        let entryUpdateData: any

        if (existingEntry) {
          // Entry exists - check if it has manual sleep data
          const dataSources = Array.isArray(existingEntry.dataSources) ? existingEntry.dataSources : []
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
              // Don't store sleepQuality in Entry since we have detailed SleepRecord
              // sleepQuality is for manual perception ratings (separate from objective duration)
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
      } catch (err: any) {
        results.errors.push({
          date: sleepRecord.date,
          message: err.message || "Failed to process sleep record",
        })
      }
    }

    // Return results
    const statusCode = results.errors.length > 0 ? 207 : 200

    const response = NextResponse.json({
      success: results.processed > 0,
      processed: results.processed,
      total: validated.sleep_records.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
    }, { status: statusCode })
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response

  } catch (error: any) {
    console.error("Error in /api/ingest/sleep:", error)

    if (error.name === "ZodError") {
      const response = NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    const response = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}
