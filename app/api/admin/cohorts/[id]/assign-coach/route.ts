import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"

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

    // Defensive check: verify role is ADMIN
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { coachId } = body

    if (!coachId || typeof coachId !== "string") {
      return NextResponse.json(
        { error: "Invalid coachId" },
        { status: 400 }
      )
    }

    // Verify cohort exists
    const cohort = await db.cohort.findUnique({
      where: { id },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Verify target user exists and has COACH role
    const coach = await db.user.findUnique({
      where: { id: coachId },
      select: {
        id: true,
        roles: true,
      },
    })

    if (!coach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 })
    }

    if (!isCoach({ roles: coach.roles as Role[] })) {
      return NextResponse.json(
        { error: "User does not have COACH role" },
        { status: 400 }
      )
    }

    // Update cohort coachId
    const updatedCohort = await db.cohort.update({
      where: { id },
      data: { coachId },
      include: {
        memberships: {
          select: {
            userId: true,
          },
        },
        invites: {
          select: {
            id: true,
          },
        },
      },
    })

    // Fetch coach separately to avoid relation name issues
    const coachUser = await db.user.findUnique({
      where: { id: coachId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return NextResponse.json(
      {
        id: updatedCohort.id,
        name: updatedCohort.name,
        coach: coachUser ? {
          id: coachUser.id,
          name: coachUser.name,
          email: coachUser.email,
        } : null,
        activeClients: updatedCohort.memberships.length,
        pendingInvites: updatedCohort.invites.length,
        createdAt: updatedCohort.createdAt.toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error assigning coach to cohort:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
