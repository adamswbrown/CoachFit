/**
 * POST /api/ingest/workouts
 *
 * Endpoint for iOS app to send HealthKit workout data.
 * Stores workout records with full metadata from Apple Health.
 */

import { NextRequest, NextResponse } from "next/server"
import { ingestWorkoutsSchema, type WorkoutItem } from "@/lib/validations"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validated = ingestWorkoutsSchema.parse(body)

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

    // Process each workout
    const results: { processed: number; errors: { index: number; message: string }[] } = {
      processed: 0,
      errors: [],
    }

    for (let i = 0; i < validated.workouts.length; i++) {
      const workout = validated.workouts[i]

      try {
        // Check for duplicate (same user, type, and start time)
        const existing = await db.workout.findFirst({
          where: {
            userId: validated.client_id,
            workoutType: workout.workout_type,
            startTime: new Date(workout.start_time),
          },
        })

        // Cast metadata to Prisma-compatible JSON type
        const metadataValue = workout.metadata ? JSON.parse(JSON.stringify(workout.metadata)) : null

        if (existing) {
          // Update existing workout
          await db.workout.update({
            where: { id: existing.id },
            data: {
              endTime: new Date(workout.end_time),
              durationSecs: workout.duration_seconds,
              caloriesActive: workout.calories_active ?? null,
              distanceMeters: workout.distance_meters ?? null,
              avgHeartRate: workout.avg_heart_rate ?? null,
              maxHeartRate: workout.max_heart_rate ?? null,
              sourceDevice: workout.source_device ?? null,
              metadata: metadataValue,
            },
          })
        } else {
          // Create new workout
          await db.workout.create({
            data: {
              userId: validated.client_id,
              workoutType: workout.workout_type,
              startTime: new Date(workout.start_time),
              endTime: new Date(workout.end_time),
              durationSecs: workout.duration_seconds,
              caloriesActive: workout.calories_active ?? null,
              distanceMeters: workout.distance_meters ?? null,
              avgHeartRate: workout.avg_heart_rate ?? null,
              maxHeartRate: workout.max_heart_rate ?? null,
              sourceDevice: workout.source_device ?? null,
              metadata: metadataValue,
            },
          })
        }

        results.processed++
      } catch (err: any) {
        results.errors.push({
          index: i,
          message: err.message || "Failed to process workout",
        })
      }
    }

    // Return results
    const statusCode = results.errors.length > 0 ? 207 : 200 // 207 Multi-Status if partial success

    return NextResponse.json({
      success: results.processed > 0,
      processed: results.processed,
      total: validated.workouts.length,
      errors: results.errors.length > 0 ? results.errors : undefined,
    }, { status: statusCode })

  } catch (error: any) {
    console.error("Error in /api/ingest/workouts:", error)

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
