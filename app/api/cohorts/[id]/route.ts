import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { z } from "zod"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdminUser = isAdmin(session.user)

    // Must be COACH or ADMIN
    if (!session.user.roles.includes(Role.COACH) && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        customCohortType: {
          select: {
            id: true,
            label: true,
            description: true,
          },
        },
      },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Authorization check for coaches (admins can view any cohort)
    if (!isAdminUser) {
      const isOwner = cohort.coachId === session.user.id
      
      // Check if user is a co-coach on this cohort
      const isCoCoach = await db.coachCohortMembership.findUnique({
        where: {
          coachId_cohortId: {
            coachId: session.user.id,
            cohortId: id
          }
        }
      })
      
      // If not owner and not co-coach, check if they have access to any members
      if (!isOwner && !isCoCoach) {
        const memberIds = cohort.memberships.map(m => m.userId)
        
        // Check if coach has access to any of these members via their cohorts
        const hasAccessToMembers = await db.cohortMembership.findFirst({
          where: {
            userId: { in: memberIds },
            Cohort: {
              OR: [
                { coachId: session.user.id },
                { 
                  coachMemberships: {
                    some: { coachId: session.user.id }
                  }
                }
              ]
            }
          }
        })

        if (!hasAccessToMembers) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
    }

    return NextResponse.json(
      {
        ...cohort,
        requiresMigration: !cohort.type,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching cohort:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

const updateCohortSchema = z.object({
  cohortStartDate: z.string().optional().nullable(),
  type: z.enum(["TIMED", "ONGOING", "CHALLENGE", "CUSTOM"]).optional().nullable(),
  customCohortTypeId: z.string().uuid().optional().nullable(),
  customTypeLabel: z.string().max(80).optional().nullable(),
  checkInFrequencyDays: z.number().int().min(1).max(365).optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdminUser = isAdmin(session.user)

    if (!session.user.roles.includes(Role.COACH) && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id },
      select: { id: true, coachId: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    if (!isAdminUser && cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = updateCohortSchema.parse(body)
    const startDateValue = validated.cohortStartDate ?? undefined
    let cohortStartDate: Date | null = null

    if (startDateValue) {
      const parsed = new Date(startDateValue)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid start date" }, { status: 400 })
      }
      cohortStartDate = parsed
    }

    const nextType = validated.type ?? undefined
    const customCohortType = validated.customCohortTypeId
      ? await db.customCohortType.findUnique({
          where: { id: validated.customCohortTypeId },
          select: { id: true, label: true },
        })
      : null

    if (validated.customCohortTypeId && !customCohortType) {
      return NextResponse.json({ error: "Custom cohort type not found" }, { status: 400 })
    }

    if (nextType && nextType !== "CUSTOM" && (validated.customCohortTypeId || validated.customTypeLabel)) {
      return NextResponse.json(
        { error: "Custom type is only allowed when cohort type is CUSTOM" },
        { status: 400 }
      )
    }

    if (nextType === "CUSTOM" && !(validated.customCohortTypeId || validated.customTypeLabel)) {
      return NextResponse.json(
        { error: "Custom cohorts must include a custom type" },
        { status: 400 }
      )
    }

    const updateData: Record<string, any> = {}
    if (startDateValue !== undefined) {
      updateData.cohortStartDate = cohortStartDate
    }
    if (nextType !== undefined) {
      updateData.type = nextType
      updateData.customCohortTypeId =
        nextType === "CUSTOM" ? customCohortType?.id || null : null
      updateData.customTypeLabel =
        nextType === "CUSTOM"
          ? validated.customTypeLabel?.trim() || customCohortType?.label || null
          : null
    }
    if (validated.checkInFrequencyDays !== undefined) {
      updateData.checkInFrequencyDays = validated.checkInFrequencyDays
    }

    const updated = await db.cohort.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        cohortStartDate: true,
        type: true,
        customTypeLabel: true,
        customCohortTypeId: true,
        checkInFrequencyDays: true,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_UPDATE",
      targetType: "cohort",
      targetId: updated.id,
      details: {
        updates: updateData,
      },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten() },
        { status: 400 }
      )
    }
    console.error("Error updating cohort:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdminUser = isAdmin(session.user)

    // Must be COACH or ADMIN
    if (!session.user.roles.includes(Role.COACH) && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id },
      include: {
        memberships: true,
      },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Ownership check: only owner can delete cohort (admins can also delete)
    if (!isAdminUser && cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden - Only the cohort owner can delete it" }, { status: 403 })
    }

    // Delete cohort and memberships in a transaction
    // This ensures atomic deletion even if cascade delete isn't working
    await db.$transaction(async (tx: any) => {
      // Delete memberships first
      await tx.cohortMembership.deleteMany({
        where: { cohortId: id },
      })
      
      // Then delete the cohort
      await tx.cohort.delete({
        where: { id },
      })
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_DELETE",
      targetType: "cohort",
      targetId: cohort.id,
      details: {
        name: cohort.name,
        coachId: cohort.coachId,
      },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting cohort:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error("Error details:", { message: errorMessage, stack: errorStack })
    return NextResponse.json(
      { error: "Internal server error", details: process.env.NODE_ENV === "development" ? errorMessage : undefined },
      { status: 500 }
    )
  }
}
