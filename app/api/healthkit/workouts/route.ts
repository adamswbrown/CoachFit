/**
 * GET /api/healthkit/workouts
 *
 * Fetch workouts for a client. Coaches can view their clients' workouts.
 * Supports filtering by date range.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isCoach, isAdmin } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Only coaches and admins can view HealthKit data
    if (!isCoach(session.user) && !isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden - Coach or Admin role required" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get("clientId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId parameter is required" },
        { status: 400 }
      )
    }

    // Verify client belongs to this coach (unless admin)
    if (!isAdmin(session.user)) {
      const client = await db.user.findUnique({
        where: { id: clientId },
        select: { invitedByCoachId: true },
      })

      if (!client || client.invitedByCoachId !== session.user.id) {
        return NextResponse.json(
          { error: "Forbidden - Not your client" },
          { status: 403 }
        )
      }
    }

    // Build query filters
    const where: any = { userId: clientId }

    if (startDate || endDate) {
      where.startTime = {}
      if (startDate) {
        where.startTime.gte = new Date(startDate)
      }
      if (endDate) {
        where.startTime.lte = new Date(endDate)
      }
    }

    // Fetch workouts
    const workouts = await db.workout.findMany({
      where,
      orderBy: { startTime: "desc" },
      take: 100, // Limit to 100 most recent
    })

    return NextResponse.json({
      workouts: workouts.map(workout => ({
        id: workout.id,
        workoutType: workout.workoutType,
        startTime: workout.startTime.toISOString(),
        endTime: workout.endTime.toISOString(),
        durationSecs: workout.durationSecs,
        caloriesActive: workout.caloriesActive,
        distanceMeters: workout.distanceMeters,
        avgHeartRate: workout.avgHeartRate,
        maxHeartRate: workout.maxHeartRate,
        sourceDevice: workout.sourceDevice,
        createdAt: workout.createdAt.toISOString(),
      })),
    }, { status: 200 })

  } catch (error: any) {
    console.error("Error in /api/healthkit/workouts:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
