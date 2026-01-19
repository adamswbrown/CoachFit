import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { AdminInsightEngine } from "@/lib/admin/insights"
import { cache } from "@/lib/cache"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Batch all count queries in parallel
    const [
      totalUsers,
      usersLast30Days,
      usersLast7Days,
      totalCoaches,
      coachesWithCohorts,
      totalClients,
      activeClients,
      totalEntries,
      entriesLast7Days,
      entriesLast30Days,
      totalCohorts,
      cohortsWithClients,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      db.user.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      db.user.count({
        where: {
          roles: { has: Role.COACH },
        },
      }),
      db.user.count({
        where: {
          roles: { has: Role.COACH },
          Cohort: { some: {} },
        },
      }),
      db.user.count({
        where: {
          roles: { has: Role.CLIENT },
        },
      }),
      db.user.count({
        where: {
          roles: { has: Role.CLIENT },
          Entry: {
            some: {
              date: { gte: sevenDaysAgo },
            },
          },
        },
      }),
      db.entry.count(),
      db.entry.count({
        where: {
          date: { gte: sevenDaysAgo },
        },
      }),
      db.entry.count({
        where: {
          date: { gte: thirtyDaysAgo },
        },
      }),
      db.cohort.count(),
      db.cohort.count({
        where: {
          memberships: { some: {} },
        },
      }),
    ])

    // Load coaches with cohorts in one optimized query
    const coaches = await db.user.findMany({
      where: {
        roles: { has: Role.COACH },
      },
      select: {
        id: true,
        name: true,
        email: true,
        Cohort: {
          select: {
            id: true,
            memberships: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    // Calculate metrics
    const userGrowthRate = usersLast30Days > 0 ? (usersLast7Days / usersLast30Days) * 100 : 0
    const activeRate = totalClients > 0 ? (activeClients / totalClients) * 100 : 0
    const avgEntriesPerDay = entriesLast7Days / 7
    const expectedEntriesPerDay = totalClients * 1
    const completionRate = expectedEntriesPerDay > 0 ? (avgEntriesPerDay / expectedEntriesPerDay) * 100 : 0

    const coachClientCounts = coaches.map((coach: { id: string; name: string | null; email: string; Cohort: { id: string; memberships: { userId: string }[] }[] }) => ({
      coachId: coach.id,
      coachName: coach.name || coach.email,
      clientCount: coach.Cohort.reduce((sum: number, cohort: { id: string; memberships: { userId: string }[] }) => sum + cohort.memberships.length, 0),
    }))

    const avgClientsPerCoach = totalCoaches > 0
      ? coachClientCounts.reduce((sum: number, c: { coachId: string; coachName: string; clientCount: number }) => sum + c.clientCount, 0) / totalCoaches
      : 0

    type CoachClientCount = { coachId: string; coachName: string; clientCount: number }
    const overloadedCoaches = coachClientCounts.filter((c: CoachClientCount) => c.clientCount > 50).length
    const underutilizedCoaches = coachClientCounts.filter((c: CoachClientCount) => c.clientCount > 0 && c.clientCount < 10).length

    // Try to get cached insights first (cache for 5 minutes)
    const INSIGHTS_CACHE_KEY = "admin:overview:insights"
    const INSIGHTS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
    
    let cachedInsights = cache.get<{
      anomalies: any[]
      opportunities: any[]
      userGrowthTrend: any[]
      entryCompletionTrend: any[]
    }>(INSIGHTS_CACHE_KEY)

    let anomalies: any[] = []
    let opportunities: any[] = []
    let userGrowthTrend: any[] = []
    let entryCompletionTrend: any[] = []

    if (cachedInsights) {
      // Use cached insights
      anomalies = cachedInsights.anomalies
      opportunities = cachedInsights.opportunities
      userGrowthTrend = cachedInsights.userGrowthTrend
      entryCompletionTrend = cachedInsights.entryCompletionTrend
    } else {
      // Generate insights and cache them
      const insightEngine = new AdminInsightEngine()
      
      try {
        [anomalies, opportunities, userGrowthTrend, entryCompletionTrend] = await Promise.all([
          insightEngine.detectAnomalies(),
          insightEngine.findOpportunities(),
          insightEngine.generateTrends("user_growth", "30d"),
          insightEngine.generateTrends("entry_completion", "30d"),
        ])

        // Cache the results
        cache.set(INSIGHTS_CACHE_KEY, {
          anomalies,
          opportunities,
          userGrowthTrend,
          entryCompletionTrend,
        }, INSIGHTS_CACHE_TTL)
      } catch (err: any) {
        console.error("Error generating insights:", err)
        // Continue with empty insights if generation fails
      }
    }

    const highPriority = anomalies.filter((a) => a.priority === "red")
    const trends = [...userGrowthTrend, ...entryCompletionTrend]

    return NextResponse.json(
      {
        insights: {
          highPriority,
          trends,
          anomalies,
          opportunities,
        },
        metrics: {
          userGrowth: {
            current: totalUsers,
            change: usersLast30Days,
            trend: userGrowthTrend[0]?.direction || "stable",
            prediction: Math.round(totalUsers * (1 + userGrowthRate / 100)),
            growthRate: userGrowthRate,
          },
          coachUtilization: {
            total: totalCoaches,
            active: coachesWithCohorts,
            average: avgClientsPerCoach,
            overloaded: overloadedCoaches,
            underutilized: underutilizedCoaches,
          },
          clientEngagement: {
            total: totalClients,
            active: activeClients,
            activeRate: activeRate,
            completionRate: completionRate,
            inactiveUsers: totalClients - activeClients,
          },
          entryMetrics: {
            total: totalEntries,
            last7Days: entriesLast7Days,
            last30Days: entriesLast30Days,
            avgPerDay: avgEntriesPerDay,
            expectedPerDay: expectedEntriesPerDay,
          },
          cohortHealth: {
            total: totalCohorts,
            withClients: cohortsWithClients,
            empty: totalCohorts - cohortsWithClients,
          },
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error fetching admin overview:", error)
    return NextResponse.json(
      { error: "Internal server error", message: error?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
