import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const where: Record<string, unknown> = { userId: session.user.id }

    if (startDate || endDate) {
      where.startTime = {}
      if (startDate) {
        ;(where.startTime as Record<string, Date>).gte = new Date(startDate)
      }
      if (endDate) {
        ;(where.startTime as Record<string, Date>).lte = new Date(endDate)
      }
    }

    const workouts = await db.workout.findMany({
      where,
      orderBy: { startTime: "desc" },
      take: 100,
    })

    return NextResponse.json(
      {
        workouts: workouts.map((workout) => ({
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
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error in /api/client/workouts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
