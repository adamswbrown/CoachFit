/**
 * GET /api/healthkit/workouts
 *
 * Fetch workouts for a client. Coaches can view their clients' workouts.
 * Supports filtering by date range.
 *
 * SECURITY:
 * - Requires authenticated session with COACH or ADMIN role
 * - Validates coach-client relationship through multiple paths:
 *   1. Direct invitation (invitedByCoachId)
 *   2. Cohort ownership (client is in a cohort owned by the coach)
 *   3. Co-coach relationship (coach is a co-coach on client's cohort)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isCoach, isAdmin } from "@/lib/permissions"

/**
 * Check if a coach has access to a client's data through any valid relationship
 */
async function hasCoachAccessToClient(
  coachId: string,
  clientId: string
): Promise<boolean> {
  // Check direct invitation
  const client = await db.user.findUnique({
    where: { id: clientId },
    select: {
      invitedByCoachId: true,
      CohortMembership: {
        select: {
          Cohort: {
            select: {
              coachId: true,
              coachMemberships: {
                where: { coachId: coachId },
                select: { coachId: true },
              },
            },
          },
        },
      },
    },
  })

  if (!client) {
    return false
  }

  // Path 1: Direct invitation
  if (client.invitedByCoachId === coachId) {
    return true
  }

  // Path 2 & 3: Check cohort ownership or co-coach status
  for (const membership of client.CohortMembership) {
    // Cohort owner
    if (membership.Cohort.coachId === coachId) {
      return true
    }
    // Co-coach
    if (membership.Cohort.coachMemberships.length > 0) {
      return true
    }
  }

  return false
}

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
        { error: "Forbidden" },
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

    // Verify coach has access to this client (unless admin)
    if (!isAdmin(session.user)) {
      const hasAccess = await hasCoachAccessToClient(session.user.id, clientId)

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        )
      }
    }

    // Build query filters
    const where: Record<string, unknown> = { userId: clientId }

    if (startDate || endDate) {
      where.startTime = {}
      if (startDate) {
        (where.startTime as Record<string, Date>).gte = new Date(startDate)
      }
      if (endDate) {
        (where.startTime as Record<string, Date>).lte = new Date(endDate)
      }
    }

    // Get total count for pagination
    const total = await db.workout.count({ where })

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
      pagination: {
        total,
        hasMore: workouts.length >= 100,
      },
    }, { status: 200 })

  } catch (error: unknown) {
    console.error("Error in /api/healthkit/workouts:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
