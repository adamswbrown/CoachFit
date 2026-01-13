/**
 * POST /api/pair
 *
 * Endpoint for iOS app to pair with a coach using a pairing code.
 * This establishes the coach-client relationship for HealthKit data ingestion.
 */

import { NextRequest, NextResponse } from "next/server"
import { pairingCodeSchema } from "@/lib/validations"
import { validateAndUsePairingCode } from "@/lib/healthkit/pairing"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate request body
    const validated = pairingCodeSchema.parse(body)

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id: validated.client_id },
      select: { id: true, email: true, name: true, roles: true },
    })

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      )
    }

    // Validate and use the pairing code
    const result = await validateAndUsePairingCode(validated.code, validated.client_id)

    if (!result.success) {
      return NextResponse.json(
        { error: (result as { success: false; error: string }).error },
        { status: 400 }
      )
    }

    // Optionally: Add client to coach's default cohort or set up relationship
    // This depends on business logic - for now we just establish the pairing

    // Update client's invitedByCoachId if not already set
    if (!client) {
      // This won't happen due to earlier check, but TypeScript needs it
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    await db.user.update({
      where: { id: validated.client_id },
      data: { invitedByCoachId: result.coachId },
    })

    return NextResponse.json({
      success: true,
      message: "Successfully paired with coach",
      coach: result.pairingCode.Coach,
      paired_at: result.pairingCode.usedAt,
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
