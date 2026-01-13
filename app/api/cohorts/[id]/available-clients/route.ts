import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"

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

    // Verify the coach owns this cohort
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { coachId: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    if (cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all clients belonging to this coach
    const allClients = await db.user.findMany({
      where: {
        invitedByCoachId: session.user.id,
        roles: { has: "CLIENT" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        cohortMemberships: {
          where: { cohortId },
          select: { cohortId: true },
        },
      },
    })

    // Filter out clients already in this cohort
    const availableClients = allClients
      .filter((client) => client.cohortMemberships.length === 0)
      .map((client) => ({
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
