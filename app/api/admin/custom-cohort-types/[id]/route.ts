import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { z } from "zod"

const updateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = updateSchema.parse(body)

    if (validated.label) {
      const existing = await db.customCohortType.findUnique({
        where: { label: validated.label.trim() },
        select: { id: true },
      })
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "A custom cohort type with that label already exists" },
          { status: 409 }
        )
      }
    }

    const updated = await db.customCohortType.update({
      where: { id },
      data: {
        label: validated.label?.trim(),
        description: validated.description === undefined ? undefined : validated.description?.trim() || null,
      },
    })

    await db.adminAction.create({
      data: {
        adminId: session.user.id,
        actionType: "custom_cohort_type_updated",
        targetType: "custom_cohort_type",
        targetId: updated.id,
        details: {
          label: updated.label,
          description: updated.description,
        },
      },
    })

    return NextResponse.json({ type: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten() },
        { status: 400 }
      )
    }
    console.error("Error updating custom cohort type:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const inUse = await db.cohort.count({
      where: { customCohortTypeId: id },
    })

    if (inUse > 0) {
      return NextResponse.json(
        { error: "Cannot delete custom cohort type while in use. Reassign cohorts first." },
        { status: 400 }
      )
    }

    const deleted = await db.customCohortType.delete({
      where: { id },
    })

    await db.adminAction.create({
      data: {
        adminId: session.user.id,
        actionType: "custom_cohort_type_deleted",
        targetType: "custom_cohort_type",
        targetId: deleted.id,
        details: {
          label: deleted.label,
          description: deleted.description,
        },
      },
    })

    return NextResponse.json({ message: "Deleted", type: deleted }, { status: 200 })
  } catch (error) {
    console.error("Error deleting custom cohort type:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
