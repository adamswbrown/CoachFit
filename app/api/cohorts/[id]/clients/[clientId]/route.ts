import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clientId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: cohortId, clientId } = await params

    // Verify the coach owns this cohort
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { coachId: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    const isAdminUser = isAdmin(session.user)
    if (!isAdminUser && cohort.coachId !== session.user.id) {
      const isCoCoach = await db.coachCohortMembership.findUnique({
        where: {
          coachId_cohortId: {
            coachId: session.user.id,
            cohortId,
          },
        },
      })

      if (!isCoCoach) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Remove the client from the cohort
    await db.cohortMembership.delete({
      where: {
        userId_cohortId: {
          userId: clientId,
          cohortId,
        },
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_REMOVE_CLIENT",
      targetType: "client",
      targetId: clientId,
      details: {
        cohortId,
      },
    })

    return NextResponse.json({ message: "Client removed from cohort successfully" })
  } catch (error) {
    console.error("Error removing client from cohort:", error)

    // Handle case where membership doesn't exist
    if ((error as any).code === "P2025") {
      return NextResponse.json(
        { error: "Client is not a member of this cohort" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
