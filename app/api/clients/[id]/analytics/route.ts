import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"
import { calculateBMI } from "@/lib/bmi"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Must be COACH or ADMIN
    const isCoach = session.user.roles.includes(Role.COACH)
    const isAdminUser = isAdmin(session.user)

    if (!isCoach && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Authorization: If COACH, verify client is in at least one cohort owned by coach
    // If ADMIN, allow access to any client
    if (isCoach && !isAdminUser) {
    const membership = await db.cohortMembership.findFirst({
      where: {
        userId: id,
        Cohort: {
          coachId: session.user.id,
        },
      },
    })

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    // Fetch all entries ordered by date (ascending for proper chart display)
    const entries = await db.entry.findMany({
      where: {
        userId: id,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        date: true,
        weightLbs: true,
        steps: true,
        calories: true,
        heightInches: true,
        sleepQuality: true,
        perceivedEffort: true,
      },
    })

    if (entries.length === 0) {
      return NextResponse.json(
        {
          summary: {
            latestWeight: null,
            firstWeight: null,
            weightChange: null,
            latestBMI: null,
            firstBMI: null,
            bmiChange: null,
            avgSteps7d: null,
            avgSteps30d: null,
            avgCalories7d: null,
            avgCalories30d: null,
          },
          entries: [],
        },
        { status: 200 }
      )
    }

    // Calculate summary stats (handle null values)
    const latestWeight = entries[entries.length - 1].weightLbs
    const firstWeight = entries[0].weightLbs
    const weightChange = latestWeight && firstWeight ? latestWeight - firstWeight : null

    // Calculate BMI for first and latest entries (COACH ONLY)
    const latestHeight = entries[entries.length - 1].heightInches
    const firstHeight = entries[0].heightInches
    const latestBMI = calculateBMI(latestWeight, latestHeight)
    const firstBMI = calculateBMI(firstWeight, firstHeight)
    const bmiChange = latestBMI && firstBMI ? latestBMI - firstBMI : null

    // Calculate date ranges
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Filter entries for last 7 and 30 days (only count entries with values)
    type Entry = { date: Date; weightLbs: number | null; steps: number | null; calories: number | null; heightInches: number | null; sleepQuality: number | null; perceivedEffort: number | null }
    const entries7d = entries.filter((entry: Entry) => {
      const entryDate = new Date(entry.date)
      return entryDate >= sevenDaysAgo
    })

    const entries30d = entries.filter((entry: Entry) => {
      const entryDate = new Date(entry.date)
      return entryDate >= thirtyDaysAgo
    })

    // Calculate averages (only for entries with values, handle nulls)
    const steps7d = entries7d.filter((e: Entry) => e.steps !== null).map((e: Entry) => e.steps!)
    const avgSteps7d = steps7d.length > 0
      ? steps7d.reduce((sum: number, s: number) => sum + s, 0) / steps7d.length
      : null

    const steps30d = entries30d.filter((e: Entry) => e.steps !== null).map((e: Entry) => e.steps!)
    const avgSteps30d = steps30d.length > 0
      ? steps30d.reduce((sum: number, s: number) => sum + s, 0) / steps30d.length
      : null

    const calories7d = entries7d.filter((e: Entry) => e.calories !== null).map((e: Entry) => e.calories!)
    const avgCalories7d = calories7d.length > 0
      ? calories7d.reduce((sum: number, c: number) => sum + c, 0) / calories7d.length
      : null

    const calories30d = entries30d.filter((e: Entry) => e.calories !== null).map((e: Entry) => e.calories!)
    const avgCalories30d = calories30d.length > 0
      ? calories30d.reduce((sum: number, c: number) => sum + c, 0) / calories30d.length
      : null

    return NextResponse.json(
      {
        summary: {
          latestWeight,
          firstWeight,
          weightChange,
          latestBMI, // COACH ONLY
          firstBMI, // COACH ONLY
          bmiChange, // COACH ONLY
          avgSteps7d: avgSteps7d ? Math.round(avgSteps7d) : null,
          avgSteps30d: avgSteps30d ? Math.round(avgSteps30d) : null,
          avgCalories7d: avgCalories7d ? Math.round(avgCalories7d) : null,
          avgCalories30d: avgCalories30d ? Math.round(avgCalories30d) : null,
        },
        entries: entries.map((entry: Entry) => {
          const bmi = calculateBMI(entry.weightLbs, entry.heightInches)
          return {
            date: entry.date.toISOString().split("T")[0],
            weightLbs: entry.weightLbs,
            steps: entry.steps,
            calories: entry.calories,
            sleepQuality: entry.sleepQuality,
            perceivedEffort: entry.perceivedEffort,
            bmi: bmi, // COACH ONLY - only included if weight + height present
          }
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching client analytics:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
