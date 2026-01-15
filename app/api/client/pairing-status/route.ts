import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!isClient(session.user)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Check if user has any used pairing codes
    const pairingCode = await db.pairingCode.findFirst({
      where: {
        clientId: session.user.id,
        usedAt: { not: null },
      },
      orderBy: { usedAt: "desc" },
    })

    if (!pairingCode) {
      return NextResponse.json({
        paired: false,
        pairingCode: null,
        pairedAt: null,
        deviceName: null,
        lastSyncAt: null,
        syncsCount: 0,
      })
    }

    // Count workouts and sleep records as proxy for sync activity
    const [workoutCount, sleepCount] = await Promise.all([
      db.workout.count({
        where: { userId: session.user.id },
      }),
      db.sleepRecord.count({
        where: { userId: session.user.id },
      }),
    ])

    // Get the most recent workout/sleep for last sync time
    const [latestWorkout, latestSleep] = await Promise.all([
      db.workout.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.sleepRecord.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ])

    const lastSyncAt = [latestWorkout?.createdAt, latestSleep?.createdAt]
      .filter(Boolean)
      .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0]

    return NextResponse.json({
      paired: true,
      pairingCode: pairingCode.code,
      pairedAt: pairingCode.usedAt?.toISOString(),
      deviceName: "iPhone",
      lastSyncAt: lastSyncAt?.toISOString() || null,
      syncsCount: workoutCount + sleepCount,
    })
  } catch (error) {
    console.error("Error fetching pairing status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
