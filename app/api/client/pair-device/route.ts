import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { validateAndUsePairingCode } from "@/lib/healthkit/pairing"
import { pairingCodeSchema } from "@/lib/validations/healthkit"

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!isClient(session.user)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = pairingCodeSchema.safeParse({ code: body.pairingCode })

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid pairing code format" },
        { status: 400 }
      )
    }

    // Delegate to the shared validator so codes remain single-use and client-specific
    const result = await validateAndUsePairingCode(parsed.data.code)

    if (!result.success) {
      const message = "error" in result ? result.error : "Invalid pairing code"
      return NextResponse.json(
        { error: message },
        { status: 400 }
      )
    }

    const { clientId, coachId, pairingCode } = result

    // Ensure the pairing is for this authenticated client
    if (clientId !== session.user.id) {
      return NextResponse.json(
        { error: "Pairing code is not assigned to this client" },
        { status: 403 }
      )
    }

    // Preserve the invitedByCoachId for downstream permissions
    await db.user.update({
      where: { id: clientId },
      data: { invitedByCoachId: coachId },
    })

    return NextResponse.json({
      success: true,
      message: "Device paired successfully",
      paired_at: pairingCode.usedAt,
      coach: pairingCode.Coach,
      client: pairingCode.Client,
    })
  } catch (error) {
    console.error("Error pairing device:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
