import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isCoach, isAdmin } from "@/lib/permissions"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!isCoach(session.user) && !isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden - Coach or Admin role required" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get("clientId")

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

    // Check if client has any used pairing codes
    const pairingCode = await db.pairingCode.findFirst({
      where: {
        clientId: clientId,
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
        syncsCount: 0,
      })
    }

    // Count workouts and sleep records as proxy for sync activity
    const [workoutCount, sleepCount] = await Promise.all([
      db.workout.count({
        where: { userId: clientId },
      }),
      db.sleepRecord.count({
        where: { userId: clientId },
      }),
    ])

    return NextResponse.json({
      paired: true,
      pairingCode: pairingCode.code,
      pairedAt: pairingCode.usedAt?.toISOString(),
      deviceName: "iPhone",
      syncsCount: workoutCount + sleepCount,
    })
  } catch (error: any) {
    console.error("Error in /api/coach/client-pairing-status:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
