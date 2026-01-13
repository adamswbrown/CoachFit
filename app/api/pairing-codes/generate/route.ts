/**
 * POST /api/pairing-codes/generate
 *
 * Endpoint for coaches to generate pairing codes for iOS app integration.
 * Requires authentication and COACH role.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createPairingCode, getActiveCodesForCoach } from "@/lib/healthkit/pairing"
import { isCoach, isAdmin } from "@/lib/permissions"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Only coaches and admins can generate pairing codes
    if (!isCoach(session.user) && !isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden - Coach or Admin role required" },
        { status: 403 }
      )
    }

    // Generate a new pairing code for this coach
    const pairingCode = await createPairingCode(session.user.id)

    return NextResponse.json({
      success: true,
      code: pairingCode.code,
      expires_at: pairingCode.expiresAt.toISOString(),
      created_at: pairingCode.createdAt.toISOString(),
    }, { status: 201 })

  } catch (error: any) {
    console.error("Error in /api/pairing-codes/generate:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET - List active pairing codes for current coach
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!isCoach(session.user) && !isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Forbidden - Coach or Admin role required" },
        { status: 403 }
      )
    }

    const activeCodes = await getActiveCodesForCoach(session.user.id)

    return NextResponse.json({
      codes: activeCodes.map(code => ({
        code: code.code,
        expires_at: code.expiresAt.toISOString(),
        created_at: code.createdAt.toISOString(),
      })),
    }, { status: 200 })

  } catch (error: any) {
    console.error("Error in /api/pairing-codes/generate GET:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
