/**
 * POST /api/ingest/steps
 *
 * Endpoint for iOS app to send HealthKit step count data.
 * HealthKit data overwrites manual entries (uses dataSources field).
 */

import { NextRequest, NextResponse } from "next/server"
import { ingestStepsSchema } from "@/lib/validations"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validated = ingestStepsSchema.parse(body)

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

    // Process each step record
    const results: { processed: number; errors: { date: string; message: string }[] } = {
      processed: 0,
      errors: [],
    }

    for (const stepRecord of validated.steps) {
      try {
        const date = new Date(stepRecord.date)
        date.setHours(0, 0, 0, 0)

        // Upsert entry for this date
        // HealthKit overwrites manual data, sets dataSources to ["healthkit"]
        await db.entry.upsert({
          where: {
            userId_date: {
              userId: validated.client_id,
              date: date,
            },
          },
          update: {
            steps: stepRecord.total_steps,
            dataSources: ["healthkit"],
          },
          create: {
            userId: validated.client_id,
            date: date,
            steps: stepRecord.total_steps,
            dataSources: ["healthkit"],
          },
        })

        results.processed++
      } catch (err: any) {
        results.errors.push({
          date: stepRecord.date,
          message: err.message || "Failed to process step record",
        })
      }
    }

    // Return results
    const statusCode = results.errors.length > 0 ? 207 : 200

    return NextResponse.json({
      success: results.processed > 0,
      processed: results.processed,
      total: validated.steps.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
    }, { status: statusCode })

  } catch (error: any) {
    console.error("Error in /api/ingest/steps:", error)

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
