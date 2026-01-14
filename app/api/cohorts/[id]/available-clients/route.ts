import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: cohortId } = await params

    // Verify the cohort exists (and ownership for coaches)
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { coachId: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    const isAdminUser = isAdmin(session.user)
    if (!isAdminUser && cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get unassigned clients (no cohort memberships)
    const clientWhere = isAdminUser
      ? {
          roles: { has: "CLIENT" },
          CohortMembership: { none: {} },
        }
      : {
          invitedByCoachId: session.user.id,
          roles: { has: "CLIENT" },
          CohortMembership: { none: {} },
        }

    const allClients = await db.user.findMany({
      where: clientWhere,
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    const availableClients = allClients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
    }))

    return NextResponse.json({ availableClients })
  } catch (error) {
    console.error("Error fetching available clients:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
