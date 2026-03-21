import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { creditAdjustmentSchema } from "@/lib/validations/credits"
import { adjustCredits } from "@/lib/credits"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = creditAdjustmentSchema.parse(body)

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id: validated.clientId },
      select: { id: true, name: true },
    })
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 })
    }

    await adjustCredits(
      validated.clientId,
      validated.amount,
      validated.reason,
      session.user.id
    )

    await logAuditAction({
      actor: session.user,
      actionType: "CREDIT_ADJUST",
      targetType: "client_credit_account",
      targetId: validated.clientId,
      details: {
        amount: validated.amount,
        reason: validated.reason,
      },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes("Insufficient credits")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error adjusting credits:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
