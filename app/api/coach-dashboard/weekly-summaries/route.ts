import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin, isCoach } from "@/lib/permissions"

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

/**
 * GET /api/coach-dashboard/weekly-summaries
 * 
 * Returns weekly summary stats for all clients in the coach's cohorts.
 * Query params:
 *   - weekStart: YYYY-MM-DD (optional, defaults to current week's Monday)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Must be COACH or ADMIN
    const isCoachUser = isCoach(session.user)
    const isAdminUser = isAdmin(session.user)

    if (!isCoachUser && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get weekStart from query params (optional, defaults to current week Monday)
    const searchParams = req.nextUrl.searchParams
    const weekStartParam = searchParams.get("weekStart")
    const weekStart = weekStartParam
      ? getMonday(new Date(weekStartParam))
      : getMonday(new Date())
    const weekEnd = getSunday(weekStart)

    // Normalize dates to start of day for comparison
    weekStart.setHours(0, 0, 0, 0)
    weekEnd.setHours(23, 59, 59, 999)

    // Get all clients - admins see all, coaches see their cohorts
    let clients
    if (isAdminUser) {
      // Admins see all users with CLIENT role
      const allUsers = await db.user.findMany({
        where: {
          roles: {
            has: Role.CLIENT,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
      clients = allUsers
    } else {
      // Coaches see only clients in their cohorts
      const cohortMemberships = await db.cohortMembership.findMany({
        where: {
          Cohort: {
            coachId: session.user.id,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Extract unique clients
      const clientsMap = new Map()
      cohortMemberships.forEach((membership) => {
        if (!clientsMap.has(membership.user.id)) {
          clientsMap.set(membership.user.id, membership.user)
        }
      })

      clients = Array.from(clientsMap.values())
    }

    // Fetch all entries for the week for all clients (batch query)
    const clientIds = clients.map((c) => c.id)
    const allEntries = await db.entry.findMany({
      where: {
        userId: { in: clientIds },
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: {
        userId: true,
        date: true,
        weightLbs: true,
        steps: true,
        calories: true,
      },
    })

    // Fetch all sleep records for the week for all clients (batch query)
    const allSleepRecords = await db.sleepRecord.findMany({
      where: {
        userId: { in: clientIds },
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: {
        userId: true,
        totalSleepMins: true,
      },
    })

    // Group entries by userId
    const entriesByClient = new Map<string, typeof allEntries>()
    allEntries.forEach((entry) => {
      if (!entriesByClient.has(entry.userId)) {
        entriesByClient.set(entry.userId, [])
      }
      entriesByClient.get(entry.userId)!.push(entry)
    })

    // Group sleep records by userId
    const sleepByClient = new Map<string, typeof allSleepRecords>()
    allSleepRecords.forEach((sleep) => {
      if (!sleepByClient.has(sleep.userId)) {
        sleepByClient.set(sleep.userId, [])
      }
      sleepByClient.get(sleep.userId)!.push(sleep)
    })

    // Calculate stats for each client
    const clientSummaries = clients.map((client) => {
      const entries = (entriesByClient.get(client.id) || []).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      const sleepRecords = sleepByClient.get(client.id) || []

      const checkInCount = entries.length
      const checkInRate = checkInCount / 7

      // Weight stats - filter entries with weight and sort by date
      const entriesWithWeight = entries
        .filter((e) => e.weightLbs !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      const weightsWithValues = entriesWithWeight.map((e) => e.weightLbs!)
      const avgWeight =
        weightsWithValues.length > 0
          ? weightsWithValues.reduce((sum, w) => sum + w, 0) /
            weightsWithValues.length
          : null

      // Weight trend: compare first vs last weight (chronologically sorted)
      let weightTrend: number | null = null
      if (entriesWithWeight.length >= 2) {
        const firstWeight = entriesWithWeight[0].weightLbs!
        const lastWeight = entriesWithWeight[entriesWithWeight.length - 1].weightLbs!
        weightTrend = lastWeight - firstWeight
      }

      // Steps stats
      const stepsWithValues = entries
        .filter((e) => e.steps !== null)
        .map((e) => e.steps!)
      const avgSteps =
        stepsWithValues.length > 0
          ? Math.round(
              stepsWithValues.reduce((sum, s) => sum + s, 0) /
                stepsWithValues.length
            )
          : null

      // Calories stats
      const caloriesWithValues = entries
        .filter((e) => e.calories !== null)
        .map((e) => e.calories!)
      const avgCalories =
        caloriesWithValues.length > 0
          ? Math.round(
              caloriesWithValues.reduce((sum, c) => sum + c, 0) /
                caloriesWithValues.length
            )
          : null

      // Sleep stats
      const sleepMins = sleepRecords.map((s) => s.totalSleepMins)
      const avgSleepMins =
        sleepMins.length > 0
          ? Math.round(
              sleepMins.reduce((sum, m) => sum + m, 0) / sleepMins.length
            )
          : null

      // Last check-in date
      const lastCheckInDate =
        entries.length > 0
          ? formatDate(
              new Date(
                Math.max(...entries.map((e) => new Date(e.date).getTime()))
              )
            )
          : null

      return {
        clientId: client.id,
        name: client.name,
        email: client.email,
        stats: {
          checkInCount,
          checkInRate: Math.round(checkInRate * 100) / 100,
          avgWeight: avgWeight ? Math.round(avgWeight * 10) / 10 : null,
          weightTrend: weightTrend ? Math.round(weightTrend * 10) / 10 : null,
          avgSteps,
          avgCalories,
          avgSleepMins,
        },
        lastCheckInDate,
      }
    })

    return NextResponse.json(
      {
        weekStart: formatDate(weekStart),
        weekEnd: formatDate(weekEnd),
        clients: clientSummaries,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching weekly summaries:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
