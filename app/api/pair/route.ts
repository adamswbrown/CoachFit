/**
 * POST /api/pair
 *
 * Endpoint for iOS app to pair with a coach using a pairing code.
 * This establishes the coach-client relationship for HealthKit data ingestion.
 * The iOS app only sends the pairing code; the client ID is determined from the pairing code.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { validateAndUsePairingCode } from "@/lib/healthkit/pairing"
import { db } from "@/lib/db"

// Simple schema for iOS pairing request - only needs the code
const iosPairingSchema = z.object({
  code: z
    .string()
    .length(6, "Pairing code must be 6 characters")
    .regex(/^[A-Z0-9]+$/i, "Pairing code must be alphanumeric"),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body - only code is required
    const validated = iosPairingSchema.parse(body)

    // Validate and use the pairing code
    const result = await validateAndUsePairingCode(validated.code)

    if (!result.success) {
      return NextResponse.json(
        { error: (result as { success: false; error: string }).error },
        { status: 400 }
      )
    }

    const { clientId, coachId, pairingCode } = result

    // Update client's invitedByCoachId if not already set
    await db.user.update({
      where: { id: clientId },
      data: { invitedByCoachId: coachId },
    })

    return NextResponse.json({
      success: true,
      message: "Successfully paired with coach",
      client_id: clientId,
      coach: pairingCode.Coach,
      client: pairingCode.Client,
      paired_at: pairingCode.usedAt,
    }, { status: 200 })

  } catch (error: any) {
    console.error("Error in /api/pair:", error)

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

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}
