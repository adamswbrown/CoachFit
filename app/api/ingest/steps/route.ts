/**
 * POST /api/ingest/steps
 *
 * Endpoint for iOS app to send HealthKit step count data.
 * 
 * Data Priority:
 * - If Entry already exists with "manual" in dataSources, preserve manual value
 * - Only update steps if no manual data exists for that date
 * - Set dataSources to ["manual", "healthkit"] if manual exists, ["healthkit"] if only HealthKit
 * 
 * This ensures manual entries (coach prompts, user corrections) take precedence
 * over automatically collected HealthKit data.
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

        let updateData: any

        if (existingEntry) {
          // Entry exists - check if it has manual data
          const dataSources = Array.isArray(existingEntry.dataSources) ? existingEntry.dataSources : []
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
