import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"

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

    return NextResponse.json(cohort, { status: 200 })
  } catch (error) {
    console.error("Error fetching cohort:", error)
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
