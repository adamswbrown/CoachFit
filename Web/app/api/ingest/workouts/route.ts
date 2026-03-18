/**
 * POST /api/ingest/workouts
 *
 * Endpoint for iOS app to send HealthKit workout data.
 * Stores workout records with full metadata from Apple Health.
 *
 * SECURITY:
 * - Requires valid pairing token (X-Pairing-Token header)
 * - HealthKit must be enabled in system settings
 * - Rate limited per client
 *
 * CLIENT SYNC STRATEGY:
 * - First sync: Pulls all workouts from last 365 days
 * - Subsequent syncs: Pulls only new/updated workouts since last sync
 * - Deduplicates by (userId, workoutType, startTime)
 */

import { NextRequest } from "next/server"
import { ingestWorkoutsSchema } from "@/lib/validations"
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

    // Validate request body first to get client_id
    const validated = ingestWorkoutsSchema.parse(body)

    // Validate authentication
    const authResult = await validateIngestAuth(req, validated.client_id)

    if (!authResult.success) {
      return createIngestErrorResponse(authResult, origin)
    }

    // Log sync batch details
    const dateRange =
      validated.workouts.length > 0
        ? {
            earliest: new Date(
              Math.min(
                ...validated.workouts.map((w) => new Date(w.start_time).getTime())
              )
            ).toISOString(),
            latest: new Date(
              Math.max(
                ...validated.workouts.map((w) => new Date(w.start_time).getTime())
              )
            ).toISOString(),
          }
        : null
    console.log(
      `[/api/ingest/workouts] Processing ${validated.workouts.length} workouts for client ${validated.client_id}${
        dateRange ? ` (${dateRange.earliest} to ${dateRange.latest})` : ""
      }`
    )

    // Process each workout
    const results: {
      processed: number
      errors: { index: number; message: string }[]
    } = {
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
        const metadataValue = workout.metadata
          ? JSON.parse(JSON.stringify(workout.metadata))
          : null

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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to process workout"
        results.errors.push({
          index: i,
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
        total: validated.workouts.length,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
      origin,
      statusCode
    )
  } catch (error: unknown) {
    console.error("Error in /api/ingest/workouts:", error)

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
