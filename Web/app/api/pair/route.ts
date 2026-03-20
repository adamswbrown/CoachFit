/**
 * POST /api/pair
 *
 * Endpoint for iOS app to pair with a coach using a pairing code.
 * This establishes the coach-client relationship for HealthKit data ingestion.
 * The iOS app only sends the pairing code; the client ID is determined from the pairing code.
 */

import { NextRequest, NextResponse } from "next/server"
import { validateAndUsePairingCode } from "@/lib/healthkit/pairing"
import { db } from "@/lib/db"
import { pairingCodeSchema } from "@/lib/validations/healthkit"
import { randomBytes } from "crypto"
import { addCorsHeaders, createCorsPreflightResponse } from "@/lib/security/cors"

// Simple schema for iOS pairing request - only needs the code
const iosPairingSchema = pairingCodeSchema

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const body = await req.json()

    // Validate request body - only code is required
    const validated = iosPairingSchema.parse(body)

    // Validate and use the pairing code
    const result = await validateAndUsePairingCode(validated.code)

    if (!result.success) {
      const response = NextResponse.json(
        { error: (result as { success: false; error: string }).error },
        { status: 400 }
      )
      return addCorsHeaders(response, origin, { allowMobileOrigin: true })
    }

    const { clientId, coachId, pairingCode } = result

    // Generate a long-lived device token for the iOS app to use instead of the short-lived pairing code
    const deviceToken = randomBytes(32).toString("hex") // 64-char hex string

    // Store device token on the pairing code record and update client's coach link
    await Promise.all([
      db.pairingCode.update({
        where: { id: pairingCode.id },
        data: { deviceToken },
      }),
      db.user.update({
        where: { id: clientId },
        data: { invitedByCoachId: coachId },
      }),
    ])

    const response = NextResponse.json({
      success: true,
      message: "Successfully paired with coach",
      client_id: clientId,
      device_token: deviceToken,
      coach: pairingCode.Coach,
      client: pairingCode.Client,
      paired_at: pairingCode.usedAt,
    }, { status: 200 })

    return addCorsHeaders(response, origin, { allowMobileOrigin: true })

  } catch (error: unknown) {
    console.error("Error in /api/pair:", error)

    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      const response = NextResponse.json(
        { error: "Validation error" },
        { status: 400 }
      )
      return addCorsHeaders(response, origin, { allowMobileOrigin: true })
    }

    const response = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
    return addCorsHeaders(response, origin, { allowMobileOrigin: true })
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  return createCorsPreflightResponse(origin, {
    allowMobileOrigin: true,
    headers: ["Content-Type"],
  })
}
