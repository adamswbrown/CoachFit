import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { getSystemSetting } from "@/lib/system-settings"
import { z } from "zod"

const migrationSchema = z.object({
  action: z.enum(["update", "skip", "cancel"]),
  type: z.enum(["TIMED", "ONGOING", "CHALLENGE", "CUSTOM"]).optional(),
  customCohortTypeId: z.string().uuid().optional(),
  customTypeLabel: z.string().max(80).optional(),
  checkInFrequencyDays: z.number().int().min(1).max(365).optional().nullable(),
})

export async function POST(
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
    const validated = migrationSchema.parse(body)

    const cohort = await db.cohort.findUnique({
      where: { id },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    if (validated.action === "cancel") {
      await db.adminAction.create({
        data: {
          adminId: session.user.id,
          actionType: "cohort_migration_cancelled",
          targetType: "cohort",
          targetId: cohort.id,
          details: {
            name: cohort.name,
          },
        },
      })
      return NextResponse.json({ message: "Migration cancelled" }, { status: 200 })
    }

    let updateData: Record<string, any> = {}

    if (validated.action === "skip") {
      updateData = {
        type: "TIMED",
        customCohortTypeId: null,
        customTypeLabel: null,
        checkInFrequencyDays: null,
      }
    }

    if (validated.action === "update") {
      if (!validated.type) {
        return NextResponse.json({ error: "Type is required for migration update" }, { status: 400 })
      }

      if (validated.type === "CUSTOM" && !(validated.customCohortTypeId || validated.customTypeLabel)) {
        return NextResponse.json({ error: "Custom cohorts must include a custom type" }, { status: 400 })
      }

      const customCohortType = validated.customCohortTypeId
        ? await db.customCohortType.findUnique({
            where: { id: validated.customCohortTypeId },
            select: { id: true, label: true },
          })
        : null

      if (validated.customCohortTypeId && !customCohortType) {
        return NextResponse.json({ error: "Custom cohort type not found" }, { status: 400 })
      }

      const defaultFrequency = await getSystemSetting("defaultCheckInFrequencyDays")

      updateData = {
        type: validated.type,
        customCohortTypeId: validated.type === "CUSTOM" ? customCohortType?.id || null : null,
        customTypeLabel:
          validated.type === "CUSTOM"
            ? validated.customTypeLabel?.trim() || customCohortType?.label || null
            : null,
        checkInFrequencyDays:
          validated.checkInFrequencyDays === undefined
            ? defaultFrequency
            : validated.checkInFrequencyDays,
      }
    }

    const updated = await db.cohort.update({
      where: { id: cohort.id },
      data: updateData,
    })

    await db.adminAction.create({
      data: {
        adminId: session.user.id,
        actionType:
          validated.action === "skip" ? "cohort_migration_skipped" : "cohort_migration_updated",
        targetType: "cohort",
        targetId: cohort.id,
        details: {
          name: cohort.name,
          previous: {
            type: cohort.type,
            customCohortTypeId: cohort.customCohortTypeId,
            customTypeLabel: cohort.customTypeLabel,
            checkInFrequencyDays: cohort.checkInFrequencyDays,
          },
          next: {
            type: updated.type,
            customCohortTypeId: updated.customCohortTypeId,
            customTypeLabel: updated.customTypeLabel,
            checkInFrequencyDays: updated.checkInFrequencyDays,
          },
        },
      },
    })

    return NextResponse.json({ cohort: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten() },
        { status: 400 }
      )
    }
    console.error("Error migrating cohort:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
