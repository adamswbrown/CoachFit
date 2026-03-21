import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { db } from "@/lib/db"
import { updateSessionSchema } from "@/lib/validations/booking"
import { z } from "zod"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const existing = await db.classSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const body = await req.json()
    const validated = updateSessionSchema.parse(body)

    const updated = await db.classSession.update({
      where: { id: sessionId },
      data: {
        ...(validated.status !== undefined ? { status: validated.status } : {}),
        ...(validated.instructorId !== undefined
          ? { instructorId: validated.instructorId }
          : {}),
        ...(validated.capacityOverride !== undefined
          ? { capacityOverride: validated.capacityOverride }
          : {}),
        ...(validated.cancelReason !== undefined
          ? { cancelReason: validated.cancelReason }
          : {}),
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "SESSION_UPDATE",
      targetType: "class_session",
      targetId: sessionId,
      details: { changes: validated },
    })

    return NextResponse.json({ session: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error updating session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
