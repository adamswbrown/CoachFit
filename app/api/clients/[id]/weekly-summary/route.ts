import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"
import { calculateBMI } from "@/lib/bmi"

/**
 * Get Monday of a given date (start of week)
 */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(d.setDate(diff))
}

/**
 * Get Sunday of the week containing a given date (end of week)
 */
function getSunday(date: Date): Date {
  const monday = getMonday(date)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return sunday
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

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

    // Get weekStart from query params (optional, defaults to current week Monday)
    const searchParams = req.nextUrl.searchParams
    const weekStartParam = searchParams.get("weekStart")
    const weekStart = weekStartParam
      ? getMonday(new Date(weekStartParam))
      : getMonday(new Date())
    const weekEnd = getSunday(weekStart)

    // Convert to ISO date strings for database queries (Date columns don't have time)
    const weekStartStr = formatDate(weekStart)
    const weekEndStr = formatDate(weekEnd)

    // Fetch entries for the week
    const entries = await db.entry.findMany({
      where: {
        userId: id,
        date: {
          gte: new Date(weekStartStr),
          lte: new Date(weekEndStr),
        },
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
        dataSources: true,
      },
    })

    // Log data sources for debugging
    console.log(`[WeeklySummary] Client: ${id}, Week: ${formatDate(weekStart)} to ${formatDate(weekEnd)}`)
    console.log(`[WeeklySummary] Total entries found: ${entries.length}`)
    entries.forEach((entry: any) => {
      console.log(`[WeeklySummary] ${formatDate(new Date(entry.date))}: weight=${entry.weightLbs}, steps=${entry.steps}, dataSources=${JSON.stringify(entry.dataSources)}`)
    })

    // Build day-by-day array for the week (7 days: Monday-Sunday)
    const weekEntries: Array<{
      date: string
      weightLbs: number | null
      steps: number | null
      calories: number | null
      sleepQuality: number | null
      perceivedEffort: number | null
      bmi: number | null
      hasEntry: boolean
    }> = []

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart)
      dayDate.setDate(dayDate.getDate() + i)
      const dayStr = formatDate(dayDate)

      const entry = entries.find(
        (e) => formatDate(new Date(e.date)) === dayStr
      )

      weekEntries.push({
        date: dayStr,
        weightLbs: entry?.weightLbs ?? null,
        steps: entry?.steps ?? null,
        calories: entry?.calories ?? null,
        sleepQuality: entry?.sleepQuality ?? null,
        perceivedEffort: entry?.perceivedEffort ?? null,
        bmi: entry ? calculateBMI(entry.weightLbs, entry.heightInches) : null,
        hasEntry: !!entry,
      })
    }

    // Calculate summary stats
    type WeekEntry = { date: string; weightLbs: number | null; steps: number | null; calories: number | null; sleepQuality: number | null; perceivedEffort: number | null; bmi: number | null; hasEntry: boolean }
    const entriesWithData = weekEntries.filter((e: WeekEntry) => e.hasEntry)
    const checkInCount = entriesWithData.length
    const checkInRate = checkInCount / 7

    // Weight stats (only if all days have weight)
    const weightsWithValues = weekEntries
      .filter((e: WeekEntry) => e.weightLbs !== null)
      .map((e: WeekEntry) => e.weightLbs!)
    const weekStartWeight = weekEntries[0].weightLbs
    const weekEndWeight = weekEntries[6].weightLbs
    const avgWeight =
      weightsWithValues.length > 0
        ? weightsWithValues.reduce((sum: number, w: number) => sum + w, 0) /
          weightsWithValues.length
        : null
    
    // Weight trend: compare first vs last available weight in the week
    let weightTrend: number | null = null
    if (weightsWithValues.length >= 2) {
      // If we have at least 2 weight readings, calculate trend from first to last
      const firstWeight = weightsWithValues[0]
      const lastWeight = weightsWithValues[weightsWithValues.length - 1]
      weightTrend = lastWeight - firstWeight
    } else if (weekStartWeight !== null && weekEndWeight !== null) {
      // Otherwise try start to end of week
      weightTrend = weekEndWeight - weekStartWeight
    }

    // Steps stats
    const stepsWithValues = weekEntries
      .filter((e: WeekEntry) => e.steps !== null)
      .map((e: WeekEntry) => e.steps!)
    const avgSteps =
      stepsWithValues.length > 0
        ? stepsWithValues.reduce((sum: number, s: number) => sum + s, 0) / stepsWithValues.length
        : null

    // Calories stats
    const caloriesWithValues = weekEntries
      .filter((e: WeekEntry) => e.calories !== null)
      .map((e: WeekEntry) => e.calories!)
    const avgCalories =
      caloriesWithValues.length > 0
        ? caloriesWithValues.reduce((sum: number, c: number) => sum + c, 0) /
          caloriesWithValues.length
        : null

    // BMI stats (COACH ONLY)
    const bmisWithValues = weekEntries
      .filter((e: WeekEntry) => e.bmi !== null)
      .map((e: WeekEntry) => e.bmi!)
    const avgBMI =
      bmisWithValues.length > 0
        ? bmisWithValues.reduce((sum: number, b: number) => sum + b, 0) / bmisWithValues.length
        : null

    // Adherence score: composite of check-ins (70%) + completeness (30%)
    // Completeness = average of fields filled per entry (weight, steps, calories, sleepQuality, perceivedEffort)
    const completenessScores = entriesWithData.map((entry: WeekEntry) => {
      let fieldsFilled = 0
      let totalFields = 5 // weight, steps, calories, sleepQuality, perceivedEffort
      if (entry.weightLbs !== null) fieldsFilled++
      if (entry.steps !== null) fieldsFilled++
      if (entry.calories !== null) fieldsFilled++
      if (entry.sleepQuality !== null) fieldsFilled++
      if (entry.perceivedEffort !== null) fieldsFilled++
      return fieldsFilled / totalFields
    })
    const avgCompleteness =
      completenessScores.length > 0
        ? completenessScores.reduce((sum, c) => sum + c, 0) /
          completenessScores.length
        : 0
    const adherenceScore = Math.round(
      checkInRate * 70 + avgCompleteness * 30
    )

    // Calculate average sleep quality and perceived effort
    const sleepQualities = weekEntries
      .filter((e) => e.sleepQuality !== null)
      .map((e) => e.sleepQuality!)
    const avgSleepQuality =
      sleepQualities.length > 0
        ? sleepQualities.reduce((sum, s) => sum + s, 0) / sleepQualities.length
        : null

    const perceivedEfforts = weekEntries
      .filter((e) => e.perceivedEffort !== null)
      .map((e) => e.perceivedEffort!)
    const avgPerceivedEffort =
      perceivedEfforts.length > 0
        ? perceivedEfforts.reduce((sum, p) => sum + p, 0) / perceivedEfforts.length
        : null

    // Get previous week for comparison
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekEnd = getSunday(prevWeekStart)
    const prevWeekStartStr = formatDate(prevWeekStart)
    const prevWeekEndStr = formatDate(prevWeekEnd)

    const prevWeekEntries = await db.entry.findMany({
      where: {
        userId: id,
        date: {
          gte: new Date(prevWeekStartStr),
          lte: new Date(prevWeekEndStr),
        },
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
        dataSources: true,
      },
    })

    // Calculate previous week summary (simplified)
    const prevCheckInCount = prevWeekEntries.length
    const prevCheckInRate = prevCheckInCount / 7
    const prevWeights = prevWeekEntries
      .filter((e) => e.weightLbs !== null)
      .map((e) => e.weightLbs!)
    const prevAvgWeight =
      prevWeights.length > 0
        ? prevWeights.reduce((sum: number, w: number) => sum + w, 0) / prevWeights.length
        : null
    const prevSteps = prevWeekEntries
      .filter((e) => e.steps !== null)
      .map((e) => e.steps!)
    const prevAvgSteps =
      prevSteps.length > 0
        ? prevSteps.reduce((sum: number, s: number) => sum + s, 0) / prevSteps.length
        : null

    return NextResponse.json(
      {
        weekStart: formatDate(weekStart),
        weekEnd: formatDate(weekEnd),
        entries: weekEntries,
        summary: {
          checkInCount,
          checkInRate,
          avgWeight,
          weightTrend,
          avgSteps: avgSteps ? Math.round(avgSteps) : null,
          avgCalories: avgCalories ? Math.round(avgCalories) : null,
          avgSleepQuality: avgSleepQuality ? Math.round(avgSleepQuality * 10) / 10 : null,
          avgPerceivedEffort: avgPerceivedEffort ? Math.round(avgPerceivedEffort * 10) / 10 : null,
          avgBMI: avgBMI ? Math.round(avgBMI * 10) / 10 : null, // COACH ONLY
          adherenceScore,
        },
        previousWeek: {
          weekStart: formatDate(prevWeekStart),
          weekEnd: formatDate(prevWeekEnd),
          checkInCount: prevCheckInCount,
          checkInRate: prevCheckInRate,
          avgWeight: prevAvgWeight,
          avgSteps: prevAvgSteps ? Math.round(prevAvgSteps) : null,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching weekly summary:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
