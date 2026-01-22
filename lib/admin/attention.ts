import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import type { Priority } from "./insights"

export interface AttentionScore {
  entityType: "user" | "coach" | "cohort" | "system"
  entityId: string
  priority: Priority
  score: number // 0-100
  reasons: string[]
  suggestedActions: string[]
  metadata?: Record<string, any>
}

export interface AttentionQueueItem {
  entityType: "user" | "coach" | "cohort" | "system"
  entityId: string
  entityName: string
  entityEmail?: string
  priority: Priority
  score: number
  reasons: string[]
  suggestedActions: string[]
  metadata?: Record<string, any>
}

export class AttentionScoreCalculator {
  /**
   * Check if we can use cached attention scores
   */
  private async getCachedScores(): Promise<AttentionQueueItem[] | null> {
    const now = new Date()
    const cachedScores = await db.attentionScore.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: {
        score: "desc",
      },
    })

    if (cachedScores.length === 0) {
      return null
    }

    // Fetch entity names/emails for cached scores
    const userIds = cachedScores.filter((s) => s.entityType === "user").map((s) => s.entityId)
    const coachIds = cachedScores.filter((s) => s.entityType === "coach").map((s) => s.entityId)
    const cohortIds = cachedScores.filter((s) => s.entityType === "cohort").map((s) => s.entityId)

    const [users, coaches, cohorts] = await Promise.all([
      userIds.length > 0 ? db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      }) : [],
      coachIds.length > 0 ? db.user.findMany({
        where: { id: { in: coachIds } },
        select: { id: true, name: true, email: true },
      }) : [],
      cohortIds.length > 0 ? db.cohort.findMany({
        where: { id: { in: cohortIds } },
        select: { id: true, name: true },
      }) : [],
    ])

    const userMap = new Map(users.map((u) => [u.id, u] as [string, any]))
    const coachMap = new Map(coaches.map((c) => [c.id, c] as [string, any]))
    const cohortMap = new Map(cohorts.map((c) => [c.id, c] as [string, any]))

    return cachedScores.map((score) => {
      let entityName = ""
      let entityEmail: string | undefined

      if (score.entityType === "user") {
        const user = userMap.get(score.entityId)
        entityName = user?.name || user?.email || score.entityId
        entityEmail = user?.email
      } else if (score.entityType === "coach") {
        const coach = coachMap.get(score.entityId)
        entityName = coach?.name || coach?.email || score.entityId
        entityEmail = coach?.email
      } else if (score.entityType === "cohort") {
        const cohort = cohortMap.get(score.entityId)
        entityName = cohort?.name || score.entityId
      }

      return {
        entityType: score.entityType as "user" | "coach" | "cohort" | "system",
        entityId: score.entityId,
        entityName,
        entityEmail,
        priority: score.priority as Priority,
        score: score.score,
        reasons: score.reasons,
        suggestedActions: [], // Not stored in cache, will be empty
        metadata: score.metadata as Record<string, any> | undefined,
      }
    })
  }

  /**
   * Calculate attention score for a user (client) - optimized version
   */
  private calculateUserScoreFromData(
    user: {
      id: string
      name: string | null
      email: string
      entries: Array<{ date: Date }>
      memberships: Array<{ cohortId: string }>
    },
    fourteenDaysAgo: Date
  ): AttentionScore {
    let score = 0
    const reasons: string[] = []
    const suggestedActions: string[] = []
    const metadata: Record<string, any> = {}

    const now = new Date()
    const lastEntry = user.entries[0]
    const lastEntryDate = lastEntry ? new Date(lastEntry.date) : null
    const daysSinceLastEntry = lastEntryDate
      ? Math.floor((now.getTime() - lastEntryDate.getTime()) / (24 * 60 * 60 * 1000))
      : null

    if (!lastEntry || (lastEntryDate && lastEntryDate < fourteenDaysAgo)) {
      const daysSinceLastEntryValue = lastEntryDate
        ? daysSinceLastEntry ?? 0
        : 999

      if (daysSinceLastEntryValue >= 30) {
        score += 40
        reasons.push(`No entries for ${daysSinceLastEntryValue} days`)
        suggestedActions.push("Contact client to check engagement")
        metadata.daysSinceLastEntry = daysSinceLastEntryValue
      } else if (daysSinceLastEntryValue >= 14) {
        score += 25
        reasons.push(`No entries for ${daysSinceLastEntryValue} days`)
        suggestedActions.push("Send reminder to client")
        metadata.daysSinceLastEntry = daysSinceLastEntryValue
      }
    }

    if (daysSinceLastEntry !== null && daysSinceLastEntry >= 1 && daysSinceLastEntry < 14) {
      score = Math.max(score, 30)
      reasons.push("No entry in the last day")
      suggestedActions.push("Check in with client")
      metadata.daysSinceLastEntry = daysSinceLastEntry
    }

    const entriesLast14Days = user.entries.filter(
      (e) => new Date(e.date) >= fourteenDaysAgo
    ).length

    if (entriesLast14Days === 0) {
      score += 30
      reasons.push("No entries in last 14 days")
      suggestedActions.push("Send engagement reminder")
      metadata.entriesLast14Days = 0
    } else if (entriesLast14Days < 7) {
      score += 15
      reasons.push(`Only ${entriesLast14Days} entries in last 14 days (low engagement)`)
      suggestedActions.push("Review client engagement")
      metadata.entriesLast14Days = entriesLast14Days
    }

    if (user.memberships.length === 0) {
      score += 20
      reasons.push("Not assigned to any cohort")
      suggestedActions.push("Assign client to a cohort")
      metadata.cohortCount = 0
    }

    let priority: Priority = "green"
    if (score >= 60) {
      priority = "red"
    } else if (score >= 30) {
      priority = "amber"
    }

    return {
      entityType: "user",
      entityId: user.id,
      priority,
      score: Math.min(score, 100),
      reasons,
      suggestedActions,
      metadata,
    }
  }

  /**
   * Calculate attention score for a coach - optimized version
   */
  private calculateCoachScoreFromData(
    coach: {
      id: string
      name: string | null
      email: string
      cohorts: Array<{
        id: string
        memberships: Array<{ userId: string }>
      }>
    },
    clientEntryCounts: Map<string, number>
  ): AttentionScore {
    let score = 0
    const reasons: string[] = []
    const suggestedActions: string[] = []
    const metadata: Record<string, any> = {}

    const totalClients = coach.cohorts.reduce(
      (sum, cohort) => sum + cohort.memberships.length,
      0
    )

    metadata.clientCount = totalClients
    metadata.cohortCount = coach.cohorts.length

    const MAX_RECOMMENDED_CLIENTS = 50
    if (totalClients > MAX_RECOMMENDED_CLIENTS) {
      score += 50
      reasons.push(`Overloaded: ${totalClients} clients (recommended max: ${MAX_RECOMMENDED_CLIENTS})`)
      suggestedActions.push("Reassign some clients to other coaches")
      suggestedActions.push("Consider adding another coach")
      metadata.overloaded = true
      metadata.recommendedMax = MAX_RECOMMENDED_CLIENTS
    }

    if (coach.cohorts.length === 0) {
      score += 30
      reasons.push("No cohorts assigned")
      suggestedActions.push("Assign coach to cohorts")
      metadata.hasNoCohorts = true
    } else if (totalClients === 0) {
      score += 20
      reasons.push("No active clients in assigned cohorts")
      suggestedActions.push("Review cohort assignments")
      metadata.hasNoClients = true
    }

    const MIN_RECOMMENDED_CLIENTS = 10
    if (totalClients > 0 && totalClients < MIN_RECOMMENDED_CLIENTS && coach.cohorts.length > 0) {
      score += 10
      reasons.push(`Underutilized: Only ${totalClients} clients (could take more)`)
      suggestedActions.push("Assign more clients to optimize capacity")
      metadata.underutilized = true
      metadata.recommendedMin = MIN_RECOMMENDED_CLIENTS
    }

    if (totalClients > 0) {
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

      const clientIds = coach.cohorts.flatMap((c) => c.memberships.map((m) => m.userId))
      const recentEntries = clientIds.reduce((sum, clientId) => {
        return sum + (clientEntryCounts.get(clientId) || 0)
      }, 0)

      const expectedEntries = totalClients * 14
      const engagementRate = expectedEntries > 0 ? recentEntries / expectedEntries : 0

      metadata.engagementRate = engagementRate
      metadata.recentEntries = recentEntries
      metadata.expectedEntries = expectedEntries

      if (engagementRate < 0.3) {
        score += 25
        reasons.push(`Low client engagement: ${(engagementRate * 100).toFixed(0)}% entry completion`)
        suggestedActions.push("Review client engagement strategies")
        metadata.lowEngagement = true
      } else if (engagementRate < 0.5) {
        score += 15
        reasons.push(`Moderate client engagement: ${(engagementRate * 100).toFixed(0)}% entry completion`)
        suggestedActions.push("Monitor client engagement")
        metadata.moderateEngagement = true
      }
    }

    let priority: Priority = "green"
    if (score >= 60) {
      priority = "red"
    } else if (score >= 30) {
      priority = "amber"
    }

    return {
      entityType: "coach",
      entityId: coach.id,
      priority,
      score: Math.min(score, 100),
      reasons,
      suggestedActions,
      metadata,
    }
  }

  /**
   * Calculate attention score for a cohort - optimized version
   */
  private calculateCohortScoreFromData(
    cohort: {
      id: string
      name: string
      coachId: string
      memberships: Array<{ userId: string }>
    },
    clientEntryCounts: Map<string, number>
  ): AttentionScore {
    let score = 0
    const reasons: string[] = []
    const suggestedActions: string[] = []
    const metadata: Record<string, any> = {}

    const clientCount = cohort.memberships.length
    metadata.clientCount = clientCount
    metadata.cohortName = cohort.name

    if (clientCount === 0) {
      score += 40
      reasons.push("No active members")
      suggestedActions.push("Invite clients to join cohort")
      suggestedActions.push("Review cohort purpose and goals")
      metadata.isEmpty = true
    }

    if (clientCount > 0) {
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

      const clientIds = cohort.memberships.map((m: { userId: string }) => m.userId)
      const recentEntries = clientIds.reduce((sum, clientId) => {
        return sum + (clientEntryCounts.get(clientId) || 0)
      }, 0)

      const expectedEntries = clientCount * 14
      const engagementRate = expectedEntries > 0 ? recentEntries / expectedEntries : 0

      metadata.engagementRate = engagementRate
      metadata.recentEntries = recentEntries
      metadata.expectedEntries = expectedEntries

      if (engagementRate < 0.3) {
        score += 35
        reasons.push(`Very low engagement: ${(engagementRate * 100).toFixed(0)}% entry completion`)
        suggestedActions.push("Review cohort engagement strategies")
        suggestedActions.push("Contact coach to discuss")
        metadata.veryLowEngagement = true
      } else if (engagementRate < 0.5) {
        score += 20
        reasons.push(`Low engagement: ${(engagementRate * 100).toFixed(0)}% entry completion`)
        suggestedActions.push("Monitor engagement closely")
        metadata.lowEngagement = true
      } else if (engagementRate > 0.8) {
        score -= 10
        reasons.push(`High engagement: ${(engagementRate * 100).toFixed(0)}% entry completion`)
        metadata.highEngagement = true
      }
    }

    if (!cohort.coachId) {
      score += 30
      reasons.push("No coach assigned")
      suggestedActions.push("Assign coach to cohort")
      metadata.hasNoCoach = true
    }

    let priority: Priority = "green"
    if (score >= 60) {
      priority = "red"
    } else if (score >= 30) {
      priority = "amber"
    }

    score = Math.max(score, 0)

    return {
      entityType: "cohort",
      entityId: cohort.id,
      priority,
      score: Math.min(score, 100),
      reasons,
      suggestedActions,
      metadata,
    }
  }

  /**
   * Calculate attention queue for all entities - OPTIMIZED VERSION
   */
  async calculateAttentionQueue(): Promise<{
    red: AttentionQueueItem[]
    amber: AttentionQueueItem[]
    green: AttentionQueueItem[]
  }> {
    // First, try to use cached scores if available
    const cachedScores = await this.getCachedScores()
    if (cachedScores && cachedScores.length > 0) {
      const red = cachedScores.filter((item) => item.priority === "red")
      const amber = cachedScores.filter((item) => item.priority === "amber")
      const green = cachedScores.filter((item) => item.priority === "green")
      return { red, amber, green }
    }

    // If no cache, calculate fresh scores with optimized batch queries
    const queue: AttentionQueueItem[] = []
    const now = new Date()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Batch load all data upfront
    const [clients, coaches, cohorts, allEntries, allMemberships] = await Promise.all([
      // Load all clients with their latest entries and memberships
      db.user.findMany({
      where: {
        roles: {
          has: Role.CLIENT,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        CohortMembership: {
          select: {
            cohortId: true,
          },
        },
      },
    }),

      // Load all coaches with their cohorts and memberships
      db.user.findMany({
        where: {
          roles: {
            has: Role.COACH,
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
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
      }),

      // Load all cohorts with memberships
      db.cohort.findMany({
        select: {
          id: true,
          name: true,
          coachId: true,
          memberships: {
            select: {
              userId: true,
            },
          },
        },
      }),

      // Batch load all recent entries for engagement calculation
      db.entry.findMany({
        where: {
          date: { gte: fourteenDaysAgo },
        },
        select: {
          userId: true,
          date: true,
        },
      }),

      // Load all memberships for cohort calculations
      db.cohortMembership.findMany({
        select: {
          userId: true,
          cohortId: true,
        },
      }),
    ])

    // Build a map of client entry counts for engagement calculations
    const clientEntryCounts = new Map<string, number>()
    for (const entry of allEntries) {
      const count = clientEntryCounts.get(entry.userId) || 0
      clientEntryCounts.set(entry.userId, count + 1)
    }

    // Get all latest entries for all clients in one batch query
    const clientIds = clients.map((c: { id: string }) => c.id)
    const allClientEntries = await db.entry.findMany({
      where: {
        userId: { in: clientIds },
      },
      select: {
        userId: true,
        date: true,
      },
      orderBy: {
        date: "desc",
      },
    })

    // Group by userId and take the first (latest) entry for each
    const latestEntryMap = new Map<string, { userId: string; date: Date }>()
    for (const entry of allClientEntries) {
      if (!latestEntryMap.has(entry.userId)) {
        latestEntryMap.set(entry.userId, entry)
      }
    }

    // Calculate scores for all clients (in memory, no additional queries)
    for (const client of clients) {
      const latestEntry = latestEntryMap.get(client.id)
      // The Entry relation is included in the query, access it safely
      const clientWithEntries = {
        id: client.id,
        name: client.name,
        email: client.email,
        entries: latestEntry ? [{ date: latestEntry.date }] : [],
        memberships: (client as any).CohortMembership?.map((m: any) => ({ cohortId: m.cohortId })) || [],
      }

      const score = this.calculateUserScoreFromData(clientWithEntries, fourteenDaysAgo)
      if (score.score > 0) {
        queue.push({
          ...score,
          entityName: client.name || client.email,
          entityEmail: client.email,
        })
      }
    }

    // Calculate scores for all coaches (in memory)
    for (const coach of coaches) {
      const score = this.calculateCoachScoreFromData(
        {
          id: coach.id,
          name: coach.name,
          email: coach.email,
          cohorts: coach.Cohort,
        },
        clientEntryCounts
      )
      if (score.score > 0) {
        queue.push({
          ...score,
          entityName: coach.name || coach.email,
          entityEmail: coach.email,
        })
      }
    }

    // Calculate scores for all cohorts (in memory)
    for (const cohort of cohorts) {
      const score = this.calculateCohortScoreFromData(cohort, clientEntryCounts)
      if (score.score > 0) {
        queue.push({
          ...score,
          entityName: cohort.name,
        })
      }
    }

    // Sort by score (highest first) and group by priority
    queue.sort((a, b) => b.score - a.score)

    const red = queue.filter((item) => item.priority === "red")
    const amber = queue.filter((item) => item.priority === "amber")
    const green = queue.filter((item) => item.priority === "green")

    // Store attention scores in database (async, don't wait)
    this.storeAttentionScores(queue).catch((err) => {
      console.error("Error storing attention scores:", err)
    })

    return { red, amber, green }
  }

  /**
   * Store attention scores in database
   */
  private async storeAttentionScores(scores: AttentionQueueItem[]): Promise<void> {
    if (scores.length === 0) return

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Use upsert instead of delete + create for better performance
    // First, delete existing scores for these entities
    const entityKeys = scores.map(s => ({ entityType: s.entityType, entityId: s.entityId }))
    await db.attentionScore.deleteMany({
      where: {
        OR: entityKeys.map(key => ({
          entityType: key.entityType,
          entityId: key.entityId,
        })),
      },
    })

    // Then create new scores
    if (scores.length > 0) {
      await db.attentionScore.createMany({
        data: scores.map((score) => ({
        entityType: score.entityType,
        entityId: score.entityId,
        priority: score.priority,
        score: score.score,
        reasons: score.reasons,
        metadata: score.metadata || {},
        expiresAt,
      })),
      skipDuplicates: true,
    })
    }

    // Clean up expired scores (async, don't wait)
    db.attentionScore.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    }).catch((err: unknown) => {
      console.error("Error cleaning up expired scores:", err)
    })
  }

  // Legacy methods kept for backward compatibility but not used in optimized path
  async calculateUserScore(userId: string): Promise<AttentionScore> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        Entry: {
          orderBy: { date: "desc" },
          take: 30,
        },
        CohortMembership: {
          include: {
            Cohort: {
              include: {
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user || !user.roles.includes(Role.CLIENT)) {
      return {
        entityType: "user",
        entityId: userId,
        priority: "green",
        score: 0,
        reasons: [],
        suggestedActions: [],
      }
    }

    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    return this.calculateUserScoreFromData(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        entries: user.Entry,
        memberships: user.CohortMembership,
      },
      fourteenDaysAgo
    )
  }

  async calculateCoachScore(coachId: string): Promise<AttentionScore> {
    const coach = await db.user.findUnique({
      where: { id: coachId },
      include: {
        Cohort: {
          include: {
            memberships: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!coach || !coach.roles.includes(Role.COACH)) {
      return {
        entityType: "coach",
        entityId: coachId,
        priority: "green",
        score: 0,
        reasons: [],
        suggestedActions: [],
      }
    }

    // Get entry counts for this coach's clients
    const clientIds = coach.Cohort.flatMap((c: { memberships: { userId: string }[] }) => c.memberships.map((m: { userId: string }) => m.userId))
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const entries = await db.entry.findMany({
      where: {
        userId: { in: clientIds },
        date: { gte: fourteenDaysAgo },
      },
      select: {
        userId: true,
      },
    })

    const clientEntryCounts = new Map<string, number>()
    for (const entry of entries) {
      const count = clientEntryCounts.get(entry.userId) || 0
      clientEntryCounts.set(entry.userId, count + 1)
    }

    return this.calculateCoachScoreFromData(
      {
        id: coach.id,
        name: coach.name,
        email: coach.email,
        cohorts: coach.Cohort,
      },
      clientEntryCounts
    )
  }

  async calculateCohortScore(cohortId: string): Promise<AttentionScore> {
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        memberships: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!cohort) {
      return {
        entityType: "cohort",
        entityId: cohortId,
        priority: "green",
        score: 0,
        reasons: [],
        suggestedActions: [],
      }
    }

    const clientIds = cohort.memberships.map((m: { userId: string }) => m.userId)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const entries = await db.entry.findMany({
      where: {
        userId: { in: clientIds },
        date: { gte: fourteenDaysAgo },
      },
      select: {
        userId: true,
      },
    })

    const clientEntryCounts = new Map<string, number>()
    for (const entry of entries) {
      const count = clientEntryCounts.get(entry.userId) || 0
      clientEntryCounts.set(entry.userId, count + 1)
    }

    return this.calculateCohortScoreFromData(
      {
        id: cohort.id,
        name: cohort.name,
        coachId: cohort.coachId,
        memberships: cohort.memberships,
      },
      clientEntryCounts
    )
  }
}
