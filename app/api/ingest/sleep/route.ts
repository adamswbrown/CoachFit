/**
 * POST /api/ingest/sleep
 *
 * Endpoint for iOS app to send HealthKit sleep data.
 * Stores detailed sleep records with sleep stage breakdown.
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

        // Upsert sleep record (one per user per date)
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

    return NextResponse.json({
      success: results.processed > 0,
      processed: results.processed,
      total: validated.sleep_records.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
    }, { status: statusCode })

  } catch (error: any) {
    console.error("Error in /api/ingest/sleep:", error)

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}
