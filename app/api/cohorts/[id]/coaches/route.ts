import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { z } from "zod"

const addCoachSchema = z.object({
  email: z.string().email(),
})

// GET /api/cohorts/[id]/coaches - List co-coaches
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
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        coachMemberships: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        }
      }
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Authorization check
    const isOwner = cohort.coachId === session.user.id
    const isCoCoach = cohort.coachMemberships.some(cm => cm.coachId === session.user.id)

    if (!isAdminUser && !isOwner && !isCoCoach) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      owner: cohort.User,
      coCoaches: cohort.coachMemberships.map(cm => ({
        ...cm.User,
        addedAt: cm.addedAt
      }))
    })
  } catch (error) {
    console.error("Error fetching cohort coaches:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/cohorts/[id]/coaches - Add a co-coach
export async function POST(
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
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Only owner or admin can add co-coaches
    if (!isAdminUser && cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden - Only cohort owner can add co-coaches" }, { status: 403 })
    }

    const body = await req.json()
    const validated = addCoachSchema.parse(body)

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: validated.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found with that email" },
        { status: 404 }
      )
    }

    // Verify user is a coach
    if (!user.roles.includes(Role.COACH)) {
      return NextResponse.json(
        { error: "User is not a coach" },
        { status: 400 }
      )
    }

    // Can't add the owner as a co-coach
    if (user.id === cohort.coachId) {
      return NextResponse.json(
        { error: "Cannot add cohort owner as co-coach" },
        { status: 400 }
      )
    }

    // Check if already a co-coach
    const existing = await db.coachCohortMembership.findUnique({
      where: {
        coachId_cohortId: {
          coachId: user.id,
          cohortId: id
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "User is already a co-coach on this cohort" },
        { status: 409 }
      )
    }

    // Add co-coach
    await db.coachCohortMembership.create({
      data: {
        coachId: user.id,
        cohortId: id,
      }
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_ADD_COACH",
      targetType: "cohort",
      targetId: id,
      details: {
        coachId: user.id,
        coachEmail: user.email,
      },
    })

    return NextResponse.json({
      success: true,
      coach: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Error adding co-coach:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/cohorts/[id]/coaches - Remove a co-coach
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
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Only owner or admin can remove co-coaches
    if (!isAdminUser && cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden - Only cohort owner can remove co-coaches" }, { status: 403 })
    }

    const url = new URL(req.url)
    const coachId = url.searchParams.get("coachId")

    if (!coachId) {
      return NextResponse.json(
        { error: "coachId query parameter required" },
        { status: 400 }
      )
    }

    // Remove co-coach
    const deleted = await db.coachCohortMembership.delete({
      where: {
        coachId_cohortId: {
          coachId,
          cohortId: id
        }
      }
    }).catch(() => null)

    if (!deleted) {
      return NextResponse.json(
        { error: "Co-coach not found" },
        { status: 404 }
      )
    }

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_REMOVE_COACH",
      targetType: "cohort",
      targetId: id,
      details: {
        coachId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing co-coach:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
