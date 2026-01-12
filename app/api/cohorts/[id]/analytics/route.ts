import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"

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

    // Verify cohort exists
    const cohort = await db.cohort.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Authorization: If COACH, verify ownership. If ADMIN, allow access.
    if (isCoach && !isAdminUser) {
      if (cohort.coachId !== session.user.id) {
        return NextResponse.json(
          { error: "Forbidden: You don't own this cohort" },
          { status: 403 }
        )
      }
    }

    // Get all active clients (users with memberships)
    const activeClients = cohort.memberships.map((m) => m.user)

    if (activeClients.length === 0) {
      return NextResponse.json(
        {
          cohortSummary: {
            activeClients: 0,
            avgWeightChange: null,
            avgSteps7d: null,
            avgSteps30d: null,
          },
          clients: [],
        },
        { status: 200 }
      )
    }

    // Fetch entries for all clients
    const clientIds = activeClients.map((c) => c.id)
    const allEntries = await db.entry.findMany({
      where: {
        userId: { in: clientIds },
      },
      orderBy: {
        date: "asc",
      },
      select: {
        userId: true,
        date: true,
        weightLbs: true,
        steps: true,
        calories: true,
        heightInches: true,
        sleepQuality: true,
        perceivedEffort: true,
      },
    })

    // Calculate date ranges
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Process data for each client
    const clientData = activeClients.map((client) => {
      const clientEntries = allEntries.filter((e) => e.userId === client.id)

      if (clientEntries.length === 0) {
        return {
          id: client.id,
          name: client.name,
          email: client.email,
          latestWeight: null,
          weightChange: null,
          avgSteps7d: null,
          avgSteps30d: null,
          avgCalories7d: null,
          avgCalories30d: null,
          sparklineData: [],
        }
      }

      // Calculate weight stats
      const latestWeight = clientEntries[clientEntries.length - 1].weightLbs
      const firstWeight = clientEntries[0].weightLbs
      const weightChange = 
        latestWeight !== null && firstWeight !== null
          ? latestWeight - firstWeight
          : null

      // Filter entries for date ranges
      const entries7d = clientEntries.filter((entry) => {
        const entryDate = new Date(entry.date)
        return entryDate >= sevenDaysAgo
      })

      const entries30d = clientEntries.filter((entry) => {
        const entryDate = new Date(entry.date)
        return entryDate >= thirtyDaysAgo
      })

      // Calculate averages (filter null values)
      const steps7dWithValues = entries7d.filter((e) => e.steps !== null).map((e) => e.steps!)
      const avgSteps7d =
        steps7dWithValues.length > 0
          ? steps7dWithValues.reduce((sum, s) => sum + s, 0) / steps7dWithValues.length
          : null

      const steps30dWithValues = entries30d.filter((e) => e.steps !== null).map((e) => e.steps!)
      const avgSteps30d =
        steps30dWithValues.length > 0
          ? steps30dWithValues.reduce((sum, s) => sum + s, 0) / steps30dWithValues.length
          : null

      const calories7dWithValues = entries7d.filter((e) => e.calories !== null).map((e) => e.calories!)
      const avgCalories7d =
        calories7dWithValues.length > 0
          ? calories7dWithValues.reduce((sum, c) => sum + c, 0) / calories7dWithValues.length
          : null

      const calories30dWithValues = entries30d.filter((e) => e.calories !== null).map((e) => e.calories!)
      const avgCalories30d =
        calories30dWithValues.length > 0
          ? calories30dWithValues.reduce((sum, c) => sum + c, 0) / calories30dWithValues.length
          : null

      // Sparkline data (last 30 days weight)
      const sparklineData = entries30d
        .slice(-30) // Last 30 entries
        .map((entry) => ({
          date: entry.date.toISOString().split("T")[0],
          weight: entry.weightLbs,
        }))

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        latestWeight,
        weightChange,
        avgSteps7d: avgSteps7d ? Math.round(avgSteps7d) : null,
        avgSteps30d: avgSteps30d ? Math.round(avgSteps30d) : null,
        avgCalories7d: avgCalories7d ? Math.round(avgCalories7d) : null,
        avgCalories30d: avgCalories30d ? Math.round(avgCalories30d) : null,
        sparklineData,
      }
    })

    // Calculate cohort averages (only from clients with data)
    const clientsWithWeightChange = clientData.filter(
      (c) => c.weightChange !== null
    )
    const avgWeightChange =
      clientsWithWeightChange.length > 0
        ? clientsWithWeightChange.reduce((sum, c) => sum + (c.weightChange || 0), 0) /
          clientsWithWeightChange.length
        : null

    const clientsWithSteps7d = clientData.filter((c) => c.avgSteps7d !== null)
    const avgSteps7d =
      clientsWithSteps7d.length > 0
        ? clientsWithSteps7d.reduce((sum, c) => sum + (c.avgSteps7d || 0), 0) /
          clientsWithSteps7d.length
        : null

    const clientsWithSteps30d = clientData.filter((c) => c.avgSteps30d !== null)
    const avgSteps30d =
      clientsWithSteps30d.length > 0
        ? clientsWithSteps30d.reduce((sum, c) => sum + (c.avgSteps30d || 0), 0) /
          clientsWithSteps30d.length
        : null

    return NextResponse.json(
      {
        cohortSummary: {
          activeClients: activeClients.length,
          avgWeightChange: avgWeightChange ? Number(avgWeightChange.toFixed(1)) : null,
          avgSteps7d: avgSteps7d ? Math.round(avgSteps7d) : null,
          avgSteps30d: avgSteps30d ? Math.round(avgSteps30d) : null,
        },
        clients: clientData,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching cohort analytics:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
