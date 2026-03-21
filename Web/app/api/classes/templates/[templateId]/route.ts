import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { db } from "@/lib/db"
import { updateTemplateSchema } from "@/lib/validations/booking"
import { ClassScope } from "@prisma/client"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { templateId } = await params

    const template = await db.classTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Ownership check: owner coach or admin
    if (template.ownerCoachId !== session.user.id && !isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error("Error fetching template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { templateId } = await params

    const template = await db.classTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, ownerCoachId: true },
    })

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    // Ownership check: owner coach or admin
    if (template.ownerCoachId !== session.user.id && !isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = updateTemplateSchema.parse(body)

    const updateData: Prisma.ClassTemplateUpdateInput = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.classType !== undefined) updateData.classType = validated.classType
    if (validated.description !== undefined) updateData.description = validated.description
    if (validated.locationLabel !== undefined) updateData.locationLabel = validated.locationLabel
    if (validated.roomLabel !== undefined) updateData.roomLabel = validated.roomLabel
    if (validated.capacity !== undefined) updateData.capacity = validated.capacity
    if (validated.waitlistEnabled !== undefined) updateData.waitlistEnabled = validated.waitlistEnabled
    if (validated.waitlistCapacity !== undefined) updateData.waitlistCapacity = validated.waitlistCapacity
    if (validated.bookingOpenHoursBefore !== undefined) updateData.bookingOpenHoursBefore = validated.bookingOpenHoursBefore
    if (validated.bookingCloseMinutesBefore !== undefined) updateData.bookingCloseMinutesBefore = validated.bookingCloseMinutesBefore
    if (validated.cancelCutoffMinutes !== undefined) updateData.cancelCutoffMinutes = validated.cancelCutoffMinutes
    if (validated.creditsRequired !== undefined) updateData.creditsRequired = validated.creditsRequired
    if (validated.scope !== undefined) updateData.scope = validated.scope as ClassScope
    if (validated.cohortId !== undefined) {
      updateData.cohort = validated.cohortId
        ? { connect: { id: validated.cohortId } }
        : { disconnect: true }
    }

    const updated = await db.classTemplate.update({
      where: { id: templateId },
      data: updateData,
    })

    await logAuditAction({
      actor: session.user,
      actionType: "TEMPLATE_UPDATE",
      targetType: "class_template",
      targetId: templateId,
      details: { changes: validated },
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error updating template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
