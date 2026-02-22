import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { SessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { classTemplateUpdateSchema } from "@/lib/validations"
import { logAuditAction } from "@/lib/audit-log"
import { getCoachAccessibleTemplateWhere } from "@/lib/classes-service"

const updateTemplateSchema = classTemplateUpdateSchema.extend({
  ownerCoachId: z.string().uuid().optional(),
})

async function getAccessibleTemplate(id: string, user: { id: string; roles: any[] }) {
  if (isAdmin(user as any)) {
    return db.classTemplate.findUnique({
      where: { id },
      include: {
        ownerCoach: { select: { id: true, name: true, email: true } },
        cohort: { select: { id: true, name: true } },
      },
    })
  }

  return db.classTemplate.findFirst({
    where: {
      id,
      AND: [getCoachAccessibleTemplateWhere(user.id)],
    },
    include: {
      ownerCoach: { select: { id: true, name: true, email: true } },
      cohort: { select: { id: true, name: true } },
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

    const template = await getAccessibleTemplate(id, session.user)

    if (!template) {
      return NextResponse.json({ error: "Class template not found" }, { status: 404 })
    }

    const sessions = await db.classSession.findMany({
      where: {
        classTemplateId: id,
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  in: ["BOOKED", "WAITLISTED", "ATTENDED", "NO_SHOW"],
                },
              },
            },
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 120,
    })

    return NextResponse.json({ template, sessions }, { status: 200 })
  } catch (error) {
    console.error("Error fetching class template:", error)
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

    const existing = await getAccessibleTemplate(id, session.user)
    if (!existing) {
      return NextResponse.json({ error: "Class template not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateTemplateSchema.parse(body)

    if (parsed.ownerCoachId && !isAdmin(session.user)) {
      return NextResponse.json(
        { error: "Only admins can reassign template ownership" },
        { status: 403 },
      )
    }

    const updated = await db.classTemplate.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.classType !== undefined ? { classType: parsed.classType } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description ?? null } : {}),
        ...(parsed.scope !== undefined ? { scope: parsed.scope } : {}),
        ...(parsed.cohortId !== undefined
          ? { cohortId: parsed.scope === "FACILITY" ? null : parsed.cohortId }
          : {}),
        ...(parsed.locationLabel !== undefined ? { locationLabel: parsed.locationLabel } : {}),
        ...(parsed.roomLabel !== undefined ? { roomLabel: parsed.roomLabel ?? null } : {}),
        ...(parsed.capacity !== undefined ? { capacity: parsed.capacity } : {}),
        ...(parsed.waitlistEnabled !== undefined ? { waitlistEnabled: parsed.waitlistEnabled } : {}),
        ...(parsed.waitlistCapacity !== undefined
          ? { waitlistCapacity: parsed.waitlistCapacity }
          : {}),
        ...(parsed.bookingOpenHoursBefore !== undefined
          ? { bookingOpenHoursBefore: parsed.bookingOpenHoursBefore }
          : {}),
        ...(parsed.bookingCloseMinutesBefore !== undefined
          ? { bookingCloseMinutesBefore: parsed.bookingCloseMinutesBefore }
          : {}),
        ...(parsed.cancelCutoffMinutes !== undefined
          ? { cancelCutoffMinutes: parsed.cancelCutoffMinutes }
          : {}),
        ...(parsed.creditsRequired !== undefined ? { creditsRequired: parsed.creditsRequired } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
        ...(parsed.ownerCoachId && isAdmin(session.user)
          ? { ownerCoachId: parsed.ownerCoachId }
          : {}),
      },
      include: {
        ownerCoach: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_TEMPLATE_UPDATE",
      targetType: "class_template",
      targetId: updated.id,
      details: {
        changedFields: Object.keys(parsed),
      },
    })

    return NextResponse.json({ template: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    console.error("Error updating class template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
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

    const existing = await getAccessibleTemplate(id, session.user)
    if (!existing) {
      return NextResponse.json({ error: "Class template not found" }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const cancelFutureSessions = body?.cancelFutureSessions === true

    const updated = await db.$transaction(async (tx) => {
      const template = await tx.classTemplate.update({
        where: { id },
        data: {
          isActive: false,
        },
      })

      if (cancelFutureSessions) {
        await tx.classSession.updateMany({
          where: {
            classTemplateId: id,
            startsAt: { gte: new Date() },
            status: SessionStatus.SCHEDULED,
          },
          data: {
            status: SessionStatus.CANCELLED,
            cancelReason: "Template deactivated",
          },
        })
      }

      return template
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_TEMPLATE_DEACTIVATE",
      targetType: "class_template",
      targetId: updated.id,
      details: {
        cancelFutureSessions,
      },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting class template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
