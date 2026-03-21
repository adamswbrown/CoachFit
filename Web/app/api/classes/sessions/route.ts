import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { createClassSession } from "@/lib/class-schedule"
import { createSessionSchema } from "@/lib/validations/booking"
import { z } from "zod"

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
    const validated = createSessionSchema.parse(body)

    const classSession = await createClassSession(
      validated.templateId,
      new Date(validated.startsAt),
      validated.instructorId,
      validated.durationMinutes
    )

    await logAuditAction({
      actor: session.user,
      actionType: "SESSION_CREATE",
      targetType: "class_session",
      targetId: classSession.id,
      details: {
        templateId: validated.templateId,
        startsAt: validated.startsAt,
        instructorId: validated.instructorId ?? null,
      },
    })

    return NextResponse.json({ session: classSession }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("not active"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error creating session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
