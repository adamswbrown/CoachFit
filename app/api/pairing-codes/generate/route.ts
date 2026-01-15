/**
 * POST /api/pairing-codes/generate
 *
 * Endpoint for coaches to generate pairing codes for specific clients.
 * Requires authentication and COACH role.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createPairingCode, regeneratePairingCode, getActiveCodesForCoach } from "@/lib/healthkit/pairing"
import { isCoach, isAdmin } from "@/lib/permissions"
import { generatePairingCodeSchema } from "@/lib/validations/healthkit"

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

    const body = await req.json()
    const validated = generatePairingCodeSchema.parse(body)

    const isAdminUser = isAdmin(session.user)

    // Generate or regenerate pairing code for the specified client
    const pairingCode = validated.regenerate
      ? await regeneratePairingCode(session.user.id, validated.client_id, isAdminUser)
      : await createPairingCode(session.user.id, validated.client_id, isAdminUser)

    return NextResponse.json({
      success: true,
      code: pairingCode.code,
      client_id: pairingCode.clientId,
      expires_at: pairingCode.expiresAt.toISOString(),
      created_at: pairingCode.createdAt.toISOString(),
      regenerated: validated.regenerate || false,
    }, { status: 201 })

  } catch (error: any) {
    console.error("Error in /api/pairing-codes/generate:", error)

    if (error.message?.includes("not found") || error.message?.includes("not associated")) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET - List active pairing codes for current coach, or get specific client's code
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

    const isAdminUser = isAdmin(session.user)

    // Check if client_id query parameter is provided
    const url = new URL(req.url)
    const clientId = url.searchParams.get("client_id")

    if (clientId) {
      // Get specific client's active pairing code
      const activeCodes = await getActiveCodesForCoach(session.user.id, isAdminUser)
      const clientCode = activeCodes.find(code => code.clientId === clientId)

      if (clientCode) {
        return NextResponse.json({
          code: clientCode.code,
          expiresAt: clientCode.expiresAt.toISOString(),
          createdAt: clientCode.createdAt.toISOString(),
        }, { status: 200 })
      }

      return NextResponse.json({
        code: null
      }, { status: 200 })
    }

    // List all active codes for coach
    const activeCodes = await getActiveCodesForCoach(session.user.id, isAdminUser)

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
