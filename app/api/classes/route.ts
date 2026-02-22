import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { classTemplateCreateSchema } from "@/lib/validations"
import { logAuditAction } from "@/lib/audit-log"
import { getCoachAccessibleTemplateWhere } from "@/lib/classes-service"

const createTemplateSchema = classTemplateCreateSchema.extend({
  ownerCoachId: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const includeInactive = searchParams.get("includeInactive") === "true"
    const classType = searchParams.get("classType")
    const cohortId = searchParams.get("cohortId")
    const ownerCoachId = searchParams.get("ownerCoachId")

    const where: any = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(classType ? { classType } : {}),
      ...(cohortId ? { cohortId } : {}),
    }

    if (isAdmin(session.user)) {
      if (ownerCoachId) {
        where.ownerCoachId = ownerCoachId
      }
    } else {
      where.AND = [getCoachAccessibleTemplateWhere(session.user.id)]
    }

    const templates = await db.classTemplate.findMany({
      where,
      include: {
        ownerCoach: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cohort: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            sessions: {
              where: {
                startsAt: { gte: new Date() },
              },
            },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    })

    return NextResponse.json({ templates }, { status: 200 })
  } catch (error) {
    console.error("Error listing class templates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createTemplateSchema.parse(body)

    const adminUser = isAdmin(session.user)
    const ownerCoachId = adminUser
      ? parsed.ownerCoachId || session.user.id
      : session.user.id

    if (parsed.scope === "COHORT" && parsed.cohortId) {
      const cohort = await db.cohort.findUnique({
        where: { id: parsed.cohortId },
        select: {
          id: true,
          coachId: true,
          coachMemberships: {
            where: {
              coachId: session.user.id,
            },
            select: { coachId: true },
          },
        },
      })

      if (!cohort) {
        return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
      }

      if (!adminUser && cohort.coachId !== session.user.id && cohort.coachMemberships.length === 0) {
        return NextResponse.json({ error: "Forbidden: cohort access denied" }, { status: 403 })
      }
    }

    const template = await db.classTemplate.create({
      data: {
        ownerCoachId,
        name: parsed.name,
        classType: parsed.classType,
        description: parsed.description ?? null,
        scope: parsed.scope,
        cohortId: parsed.scope === "COHORT" ? parsed.cohortId ?? null : null,
        locationLabel: parsed.locationLabel,
        roomLabel: parsed.roomLabel ?? null,
        capacity: parsed.capacity,
        waitlistEnabled: parsed.waitlistEnabled,
        waitlistCapacity: parsed.waitlistCapacity,
        bookingOpenHoursBefore: parsed.bookingOpenHoursBefore,
        bookingCloseMinutesBefore: parsed.bookingCloseMinutesBefore,
        cancelCutoffMinutes: parsed.cancelCutoffMinutes,
        creditsRequired: parsed.creditsRequired,
        isActive: parsed.isActive,
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
      actionType: "CLASS_TEMPLATE_CREATE",
      targetType: "class_template",
      targetId: template.id,
      details: {
        name: template.name,
        classType: template.classType,
        ownerCoachId: template.ownerCoachId,
        scope: template.scope,
      },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    console.error("Error creating class template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
