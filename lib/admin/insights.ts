import { db } from "@/lib/db"
import { Role } from "@/lib/types"

export type EntityType = "user" | "coach" | "cohort" | "system"
export type InsightType = "trend" | "anomaly" | "opportunity" | "alert"
export type InsightCategory = "engagement" | "capacity" | "performance" | "health"
export type InsightSeverity = "info" | "warning" | "error" | "success"
export type Priority = "red" | "amber" | "green"

export interface Insight {
  entityType: EntityType
  entityId: string
  insightType: InsightType
  category: InsightCategory
  title: string
  description: string
  severity: InsightSeverity
  priority: Priority
  actionable: boolean
  metadata?: Record<string, any>
}

export interface Trend {
  metric: string
  timeframe: string
  direction: "up" | "down" | "stable"
  change: number
  percentage: number
  dataPoints: Array<{ date: string; value: number }>
}

export interface Opportunity {
  type: string
  title: string
  description: string
  impact: "high" | "medium" | "low"
  effort: "high" | "medium" | "low"
  metadata?: Record<string, any>
}

export class AdminInsightEngine {
  /**
   * Detect anomalies across users, coaches, cohorts, and system - OPTIMIZED
   */
  async detectAnomalies(): Promise<Insight[]> {
    const insights: Insight[] = []
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    // Batch load all data upfront
    const [allClients, activeClientIds, allCoaches, coachesWithCohorts, cohorts, coachClientCounts] = await Promise.all([
      // All clients
      db.user.findMany({
        where: {
          roles: { has: Role.CLIENT },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      }),

      // Active client IDs (those with entries in last 14 days)
      db.entry.findMany({
        where: {
          date: { gte: fourteenDaysAgo },
        },
        select: {
          userId: true,
        },
        distinct: ["userId"],
      }).then((entries: { userId: string }[]) => new Set(entries.map((e: { userId: string }) => e.userId))),

      // All coaches
      db.user.findMany({
        where: {
          roles: { has: Role.COACH },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      }),

      // Coaches with cohorts (using count to get IDs)
      db.user.findMany({
        where: {
          roles: { has: Role.COACH },
          Cohort: { some: {} },
        },
        select: {
          id: true,
        },
      }).then((coaches: { id: string }[]) => new Set(coaches.map((c: { id: string }) => c.id))),

      // All cohorts with memberships
      db.cohort.findMany({
        select: {
          id: true,
          name: true,
          memberships: {
            select: {
              userId: true,
            },
          },
        },
      }),

      // All coaches with their cohort client counts
      db.user.findMany({
        where: {
          roles: { has: Role.COACH },
        },
        select: {
          id: true,
          email: true,
          name: true,
          Cohort: {
            select: {
              memberships: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      }),
    ])

    // Process inactive clients (in memory)
    const inactiveClients = allClients.filter((client: { id: string; name: string | null; email: string }) => !activeClientIds.has(client.id))
    inactiveClients.forEach((client: { id: string; name: string | null; email: string }) => {
      insights.push({
        entityType: "user",
        entityId: client.id,
        insightType: "anomaly",
        category: "engagement",
        title: "Inactive Client",
        description: `${client.name || client.email} has not logged any entries in the last 14 days`,
        severity: "warning",
        priority: "amber",
        actionable: true,
        metadata: {
          lastActivityDays: 14,
          clientName: client.name,
          clientEmail: client.email,
        },
      })
    })

    // Process coaches without cohorts (in memory)
    const coachesWithoutCohorts = allCoaches.filter((coach: { id: string; name: string | null; email: string }) => !coachesWithCohorts.has(coach.id))
    coachesWithoutCohorts.forEach((coach: { id: string; name: string | null; email: string }) => {
      insights.push({
        entityType: "coach",
        entityId: coach.id,
        insightType: "anomaly",
        category: "capacity",
        title: "Coach Without Cohorts",
        description: `${coach.name || coach.email} is not assigned to any cohorts`,
        severity: "info",
        priority: "amber",
        actionable: true,
        metadata: {
          coachName: coach.name,
          coachEmail: coach.email,
        },
      })
    })

    // Process empty cohorts (in memory)
    cohorts.forEach((cohort: { id: string; name: string; memberships: { userId: string }[] }) => {
      if (cohort.memberships.length === 0) {
        insights.push({
          entityType: "cohort",
          entityId: cohort.id,
          insightType: "anomaly",
          category: "engagement",
          title: "Empty Cohort",
          description: `Cohort "${cohort.name}" has no active members`,
          severity: "warning",
          priority: "amber",
          actionable: true,
          metadata: {
            cohortName: cohort.name,
            memberCount: 0,
          },
        })
      }
    })

    // Process overloaded coaches (in memory)
    const MAX_RECOMMENDED_CLIENTS = 50
    coachClientCounts.forEach((coach: { id: string; name: string | null; email: string; Cohort: { memberships: { userId: string }[] }[] }) => {
      const totalClients = coach.Cohort.reduce(
        (sum: number, cohort: { memberships: { userId: string }[] }) => sum + cohort.memberships.length,
        0
      )

      if (totalClients > MAX_RECOMMENDED_CLIENTS) {
        insights.push({
          entityType: "coach",
          entityId: coach.id,
          insightType: "anomaly",
          category: "capacity",
          title: "Overloaded Coach",
          description: `${coach.name || coach.email} has ${totalClients} clients, exceeding recommended capacity`,
          severity: "warning",
          priority: "red",
          actionable: true,
          metadata: {
            coachName: coach.name,
            coachEmail: coach.email,
            clientCount: totalClients,
            recommendedMax: MAX_RECOMMENDED_CLIENTS,
          },
        })
      }
    })

    return insights
  }

  /**
   * Find optimization opportunities - OPTIMIZED
   */
  async findOpportunities(): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = []

    // Batch load data
    const [coaches, cohorts] = await Promise.all([
      db.user.findMany({
        where: {
          roles: { has: Role.COACH },
        },
        select: {
          id: true,
          Cohort: {
            select: {
              memberships: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      }),
      db.cohort.findMany({
        select: {
          id: true,
          name: true,
          memberships: {
            select: {
              userId: true,
            },
          },
        },
      }),
    ])

    // Calculate coach utilization
    const coachClientCounts = coaches.map((coach: { id: string; Cohort: { memberships: { userId: string }[] }[] }) => ({
      coachId: coach.id,
      clientCount: coach.Cohort.reduce((sum: number, cohort: { memberships: { userId: string }[] }) => sum + cohort.memberships.length, 0),
    }))

    const avgClientsPerCoach = coaches.length > 0
      ? coachClientCounts.reduce((sum: number, c: { coachId: string; clientCount: number }) => sum + c.clientCount, 0) / coaches.length
      : 0

    const underutilizedCoaches = coachClientCounts.filter((c: { coachId: string; clientCount: number }) => c.clientCount > 0 && c.clientCount < 10)

    if (underutilizedCoaches.length > 0) {
      opportunities.push({
        type: "coach_utilization",
        title: "Optimize Coach Capacity",
        description: `${underutilizedCoaches.length} coaches are underutilized (less than 10 clients). Consider redistributing clients for better balance.`,
        impact: "medium",
        effort: "medium",
        metadata: {
          underutilizedCount: underutilizedCoaches.length,
          averageClientsPerCoach: avgClientsPerCoach,
        },
      })
    }

    // Check for empty cohorts
    const emptyCohorts = cohorts.filter((c: { id: string; name: string; memberships: { userId: string }[] }) => c.memberships.length === 0)
    if (emptyCohorts.length > 0) {
      opportunities.push({
        type: "cohort_engagement",
        title: "Activate Empty Cohorts",
        description: `${emptyCohorts.length} cohorts have no members. Consider inviting clients or archiving unused cohorts.`,
        impact: "low",
        effort: "low",
        metadata: {
          emptyCohortCount: emptyCohorts.length,
        },
      })
    }

    return opportunities
  }

  /**
   * Generate trends for a specific metric - OPTIMIZED
   */
  async generateTrends(metric: string, timeframe: string): Promise<Trend[]> {
    const trends: Trend[] = []

    if (metric === "user_growth") {
      const now = new Date()
      const days = timeframe === "30d" ? 30 : 7
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

      // Get user counts by day
      const users = await db.user.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      // Group by day and count
      const dailyCounts = new Map<string, number>()
      users.forEach((user: { createdAt: Date }) => {
        const dateKey = user.createdAt.toISOString().split("T")[0]
        dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1)
      })

      const dataPoints = Array.from(dailyCounts.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date))

      if (dataPoints.length >= 2) {
        const firstValue = dataPoints[0].value
        const lastValue = dataPoints[dataPoints.length - 1].value
        const change = lastValue - firstValue
        const percentage = firstValue > 0 ? (change / firstValue) * 100 : 0

        trends.push({
          metric: "user_growth",
          timeframe,
          direction: change > 0 ? "up" : change < 0 ? "down" : "stable",
          change,
          percentage,
          dataPoints,
        })
      }
    }

    if (metric === "entry_completion") {
      const now = new Date()
      const days = timeframe === "30d" ? 30 : 7
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

      // Get entry counts by day
      const entries = await db.entry.findMany({
        where: {
          date: { gte: startDate },
        },
        select: {
          date: true,
        },
        orderBy: {
          date: "asc",
        },
      })

      // Group by day and count
      const dailyCounts = new Map<string, number>()
      entries.forEach((entry: { date: Date }) => {
        const dateKey = entry.date.toISOString().split("T")[0]
        dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1)
      })

      const dataPoints = Array.from(dailyCounts.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date))

      if (dataPoints.length >= 2) {
        const firstValue = dataPoints[0].value
        const lastValue = dataPoints[dataPoints.length - 1].value
        const change = lastValue - firstValue
        const percentage = firstValue > 0 ? (change / firstValue) * 100 : 0

        trends.push({
          metric: "entry_completion",
          timeframe,
          direction: change > 0 ? "up" : change < 0 ? "down" : "stable",
          change,
          percentage,
          dataPoints,
        })
      }
    }

    return trends
  }

  /**
   * Store insights in database
   */
  async storeInsights(insights: Insight[]): Promise<void> {
    if (insights.length === 0) return

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Use batch operations
    await db.adminInsight.deleteMany({
      where: {
        OR: insights.map((insight) => ({
          entityType: insight.entityType,
          entityId: insight.entityId,
          insightType: insight.insightType,
          category: insight.category,
        })),
      },
    })

    await db.adminInsight.createMany({
      data: insights.map((insight) => ({
        entityType: insight.entityType,
        entityId: insight.entityId,
        insightType: insight.insightType,
        category: insight.category,
        title: insight.title,
        description: insight.description,
        severity: insight.severity,
        priority: insight.priority,
        actionable: insight.actionable,
        metadata: insight.metadata || {},
        expiresAt,
      })),
      skipDuplicates: true,
    })
  }
}
