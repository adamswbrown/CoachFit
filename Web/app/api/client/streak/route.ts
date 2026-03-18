/**
 * GET /api/client/streak
 *
 * Returns the authenticated client's current streak, longest streak,
 * and any achieved milestones with coach messages.
 *
 * Auth: X-Pairing-Token (device token) or Clerk session.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { calculateStreak } from "@/lib/streak"
import { validateIngestAuth, handleIngestPreflight } from "@/lib/security/ingest-auth"
import { getSession } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  let userId: string | null = null

  // Try device token auth first
  const token = req.headers.get("X-Pairing-Token")
  if (token) {
    const pairingCode = await db.pairingCode.findFirst({
      where: {
        OR: [
          { deviceToken: { equals: token, mode: "insensitive" } },
          { code: { equals: token, mode: "insensitive" } },
        ],
      },
    })
    userId = pairingCode?.clientId ?? null
  }

  // Fall back to Clerk session
  if (!userId) {
    const session = await getSession()
    userId = session?.user?.id ?? null
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const streak = await calculateStreak(userId)

  // Fetch achieved milestones
  const milestones = await db.milestone.findMany({
    where: {
      clientId: userId,
      achievedAt: { not: null },
    },
    orderBy: { achievedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      targetValue: true,
      achievedAt: true,
      message: true,
      coach: { select: { name: true } },
    },
  })

  const response = NextResponse.json({
    ...streak,
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      type: m.type,
      targetValue: m.targetValue,
      achievedAt: m.achievedAt?.toISOString(),
      coachMessage: m.message,
      coachName: m.coach.name,
    })),
  })

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
  }

  return response
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  return handleIngestPreflight(origin)
}
