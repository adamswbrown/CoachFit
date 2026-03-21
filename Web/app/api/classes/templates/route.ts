import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { db } from "@/lib/db"
import { createTemplateSchema } from "@/lib/validations/booking"
import { ClassScope } from "@prisma/client"
import { z } from "zod"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admins see all templates; coaches see only their own
    const whereClause = isAdmin(session.user)
      ? {}
      : { ownerCoachId: session.user.id }

    const templates = await db.classTemplate.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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
    const validated = createTemplateSchema.parse(body)

    const template = await db.classTemplate.create({
      data: {
        ownerCoachId: session.user.id,
        name: validated.name,
        classType: validated.classType,
        description: validated.description ?? null,
        locationLabel: validated.locationLabel,
        roomLabel: validated.roomLabel ?? null,
        capacity: validated.capacity,
        waitlistEnabled: validated.waitlistEnabled,
        waitlistCapacity: validated.waitlistCapacity,
        bookingOpenHoursBefore: validated.bookingOpenHoursBefore,
        bookingCloseMinutesBefore: validated.bookingCloseMinutesBefore,
        cancelCutoffMinutes: validated.cancelCutoffMinutes,
        creditsRequired: validated.creditsRequired,
        scope: validated.scope as ClassScope,
        cohortId: validated.cohortId ?? null,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "TEMPLATE_CREATE",
      targetType: "class_template",
      targetId: template.id,
      details: { name: template.name, classType: template.classType },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error creating template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
