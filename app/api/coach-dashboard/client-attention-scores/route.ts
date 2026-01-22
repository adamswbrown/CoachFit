import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isCoach } from "@/lib/permissions"
import { NextResponse } from "next/server"

interface ClientAttentionData {
  clientId: string
  name: string | null
  email: string
  attentionScore: {
    score: number
    priority: string // "red" | "amber" | "green"
    reasons: string[]
    calculatedAt: string
  } | null
  topInsights: Array<{
    id: string
    title: string
    description: string
    priority: string
    icon: string
  }>
}

/**
 * GET /api/coach-dashboard/client-attention-scores
 * Fetches attention scores and insights for a coach's clients
 * Returns data sorted by priority (red > amber > green)
 */
export async function GET(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isCoach(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    // Get all clients in the coach's cohorts
    const cohortMemberships = await db.cohortMembership.findMany({
      where: {
        Cohort: {
          coachId: session.user.id,
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const clientIds = cohortMemberships.map((m) => m.userId)

    if (clientIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Get attention scores for these clients
    const attentionScores = await db.attentionScore.findMany({
      where: {
        entityType: "user",
        entityId: {
          in: clientIds,
        },
      },
    })

    // Get insights for these clients
    const insights = await db.adminInsight.findMany({
      where: {
        entityType: "user",
        entityId: {
          in: clientIds,
        },
        actionable: true,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }], // red first, then newest
    })

    // Map insights by client ID
    const insightsByClient = new Map<string, typeof insights>()
    insights.forEach((insight) => {
      if (!insightsByClient.has(insight.entityId)) {
        insightsByClient.set(insight.entityId, [])
      }
      insightsByClient.get(insight.entityId)!.push(insight)
    })

    // Map attention scores by client ID
    const scoresByClient = new Map(
      attentionScores.map((s) => [s.entityId, s])
    )

    // Build response with all clients
    const priorityOrder: Record<string, number> = {
      red: 0,
      amber: 1,
      green: 2,
    }

    const clientData: ClientAttentionData[] = cohortMemberships
      .map((membership) => {
        const score = scoresByClient.get(membership.userId)
        const clientInsights = insightsByClient.get(membership.userId) || []

        return {
          clientId: membership.userId,
          name: membership.user.name,
          email: membership.user.email,
          attentionScore: score
            ? {
                score: score.score,
                priority: score.priority,
                reasons: score.reasons,
                calculatedAt: score.calculatedAt.toISOString(),
              }
            : null,
          topInsights: clientInsights.slice(0, 3).map((insight) => ({
            id: insight.id,
            title: insight.title,
            description: insight.description,
            priority: insight.priority,
            icon: getInsightIcon(insight.category),
          })),
        }
      })
      .sort((a, b) => {
        // Sort by priority (red > amber > green)
        const aPriority = a.attentionScore
          ? priorityOrder[a.attentionScore.priority] || 2
          : 2
        const bPriority = b.attentionScore
          ? priorityOrder[b.attentionScore.priority] || 2
          : 2

        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }

        // Then by score (higher score first)
        const aScore = a.attentionScore?.score || 0
        const bScore = b.attentionScore?.score || 0
        return bScore - aScore
      })

    return NextResponse.json({ data: clientData })
  } catch (error) {
    console.error("Error fetching client attention scores:", error)
    return NextResponse.json(
      { error: "Failed to fetch attention scores" },
      { status: 500 }
    )
  }
}

/**
 * Map insight categories to display icons
 */
function getInsightIcon(category: string): string {
  const iconMap: Record<string, string> = {
    engagement: "📊",
    trend: "📈",
    anomaly: "⚠️",
    opportunity: "🎯",
    milestone: "🎉",
    health: "❤️",
    default: "💡",
  }
  return iconMap[category] || iconMap.default
}
