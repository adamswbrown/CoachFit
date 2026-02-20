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

// Simple schema for iOS pairing request - only needs the code
const iosPairingSchema = pairingCodeSchema

export async function POST(req: NextRequest) {
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
      response.headers.set("Access-Control-Allow-Origin", "*")
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
      response.headers.set("Access-Control-Allow-Headers", "Content-Type")
      return response
    }

    const { clientId, coachId, pairingCode } = result

    // Update client's invitedByCoachId if not already set
    await db.user.update({
      where: { id: clientId },
      data: { invitedByCoachId: coachId },
    })

    const response = NextResponse.json({
      success: true,
      message: "Successfully paired with coach",
      client_id: clientId,
      coach: pairingCode.Coach,
      client: pairingCode.Client,
      paired_at: pairingCode.usedAt,
    }, { status: 200 })

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type")

    return response

  } catch (error: any) {
    console.error("Error in /api/pair:", error)

    if (error.name === "ZodError") {
      const response = NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
      response.headers.set("Access-Control-Allow-Origin", "*")
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
      response.headers.set("Access-Control-Allow-Headers", "Content-Type")
      return response
    }

    const response = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type")
    return response
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 })
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  return response
}
