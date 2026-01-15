/**
 * GET /api/healthkit/sleep
 *
 * Fetch sleep records for a client. Coaches can view their clients' sleep data.
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
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        where.date.lte = new Date(endDate)
      }
    }

    // Fetch sleep records
    const sleepRecords = await db.sleepRecord.findMany({
      where,
      orderBy: { date: "desc" },
      take: 100, // Limit to 100 most recent
    })

    return NextResponse.json({
      sleepRecords: sleepRecords.map(record => ({
        id: record.id,
        date: record.date.toISOString().split('T')[0],
        totalSleepMins: record.totalSleepMins,
        inBedMins: record.inBedMins,
        awakeMins: record.awakeMins,
        asleepCoreMins: record.asleepCoreMins,
        asleepDeepMins: record.asleepDeepMins,
        asleepREMMins: record.asleepREMMins,
        sleepStart: record.sleepStart?.toISOString(),
        sleepEnd: record.sleepEnd?.toISOString(),
        sourceDevices: record.sourceDevices as string[] | null,
        createdAt: record.createdAt.toISOString(),
      })),
    }, { status: 200 })

  } catch (error: any) {
    console.error("Error in /api/healthkit/sleep:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
