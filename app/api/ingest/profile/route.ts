/**
 * POST /api/ingest/profile
 *
 * Endpoint for iOS app to send HealthKit body metrics (weight, height, etc.).
 * HealthKit data overwrites manual entries (uses dataSources field).
 */

import { NextRequest, NextResponse } from "next/server"
import { ingestProfileSchema, type ProfileMetric } from "@/lib/validations"
import { db } from "@/lib/db"
import { kgToLbs, metersToInches, cmToInches } from "@/lib/utils/unit-conversions"

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
  try {
    const body = await req.json()

    // Validate request body
    const validated = ingestProfileSchema.parse(body)

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
      } catch (err: any) {
        results.errors.push({
          date: dateKey,
          message: err.message || "Failed to process metrics",
        })
      }
    }

    // Return results
    const statusCode = results.errors.length > 0 ? 207 : 200

    return NextResponse.json({
      success: results.processed > 0,
      processed: results.processed,
      total: metricsByDate.size,
      errors: results.errors.length > 0 ? results.errors : undefined,
    }, { status: statusCode })

  } catch (error: any) {
    console.error("Error in /api/ingest/profile:", error)

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
  const response = new NextResponse(null, { status: 200 })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}
