/**
 * POST /api/client/register-device
 *
 * Allows an authenticated Clerk user (iOS app) to register their device
 * and receive a long-lived device token for background HealthKit sync.
 *
 * If the user already has an active device token, it is returned.
 * Otherwise, a new PairingCode record is created with a generated token.
 */

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Look up the full user record (need invitedByCoachId and name)
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        invitedByCoachId: true,
        CohortMembership: {
          select: {
            Cohort: {
              select: {
                coachId: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if the user already has an active device token
    const existingPairingCode = await db.pairingCode.findFirst({
      where: {
        clientId: userId,
        deviceToken: { not: null },
      },
      orderBy: { createdAt: "desc" },
      include: {
        Coach: { select: { id: true, name: true } },
      },
    })

    if (existingPairingCode?.deviceToken) {
      return NextResponse.json({
        device_token: existingPairingCode.deviceToken,
        client_id: userId,
        client_name: user.name ?? null,
        coach_name: existingPairingCode.Coach?.name ?? null,
      })
    }

    // Determine the coach ID:
    // 1. Direct coach link (invitedByCoachId)
    // 2. Coach from cohort membership
    // 3. Fall back to the user's own ID (independent gym member)
    let coachId = user.invitedByCoachId

    if (!coachId && user.CohortMembership.length > 0) {
      coachId = user.CohortMembership[0].Cohort.coachId
    }

    if (!coachId) {
      coachId = userId
    }

    // Generate device token and a random code to satisfy the unique constraint
    const deviceToken = randomBytes(32).toString("hex") // 64-char hex
    const code = randomBytes(4).toString("hex") // 8-char hex

    const pairingCode = await db.pairingCode.create({
      data: {
        code,
        coachId,
        clientId: userId,
        deviceToken,
        expiresAt: new Date("2099-12-31T23:59:59.999Z"),
        usedAt: new Date(),
      },
      include: {
        Coach: { select: { name: true } },
      },
    })

    return NextResponse.json({
      device_token: deviceToken,
      client_id: userId,
      client_name: user.name ?? null,
      coach_name: pairingCode.Coach?.name ?? null,
    })
  } catch (error) {
    console.error("Error in /api/client/register-device:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
