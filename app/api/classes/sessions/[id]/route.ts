import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { SessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { getCoachAccessibleSessionWhere } from "@/lib/classes-service"

const updateSessionSchema = z.object({
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  instructorId: z.string().uuid().nullable().optional(),
  capacityOverride: z.number().int().min(1).max(200).nullable().optional(),
  status: z.enum(["SCHEDULED", "CANCELLED", "COMPLETED"]).optional(),
  cancelReason: z.string().max(500).nullable().optional(),
})

async function findAccessibleSession(sessionId: string, user: { id: string; roles: any[] }) {
  if (isAdmin(user as any)) {
    return db.classSession.findUnique({
      where: { id: sessionId },
      include: {
        classTemplate: true,
      },
    })
  }

  return db.classSession.findFirst({
    where: {
      id: sessionId,
      AND: [getCoachAccessibleSessionWhere(user.id)],
    },
    include: {
      classTemplate: true,
    },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const classSession = await findAccessibleSession(id, session.user)

    if (!classSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const bookings = await db.classBooking.findMany({
      where: {
        sessionId: id,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ session: classSession, bookings }, { status: 200 })
  } catch (error) {
    console.error("Error fetching class session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const existing = await findAccessibleSession(id, session.user)
    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateSessionSchema.parse(body)

    if (parsed.startsAt && parsed.endsAt) {
      const startsAt = new Date(parsed.startsAt)
      const endsAt = new Date(parsed.endsAt)
      if (endsAt.getTime() <= startsAt.getTime()) {
        return NextResponse.json(
          { error: "endsAt must be after startsAt" },
          { status: 400 },
        )
      }
    }

    const updated = await db.classSession.update({
      where: { id },
      data: {
        ...(parsed.startsAt ? { startsAt: new Date(parsed.startsAt) } : {}),
        ...(parsed.endsAt ? { endsAt: new Date(parsed.endsAt) } : {}),
        ...(parsed.instructorId !== undefined ? { instructorId: parsed.instructorId } : {}),
        ...(parsed.capacityOverride !== undefined ? { capacityOverride: parsed.capacityOverride } : {}),
        ...(parsed.status ? { status: parsed.status as SessionStatus } : {}),
        ...(parsed.cancelReason !== undefined ? { cancelReason: parsed.cancelReason } : {}),
      },
      include: {
        classTemplate: true,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_SESSION_UPDATE",
      targetType: "class_session",
      targetId: id,
      details: {
        changedFields: Object.keys(parsed),
      },
    })

    return NextResponse.json({ session: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    console.error("Error updating class session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
