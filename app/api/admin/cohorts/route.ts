import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Defensive check: verify role is ADMIN
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch all cohorts regardless of coach ownership
    const cohorts = await db.cohort.findMany({
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
      orderBy: {
        createdAt: "desc",
      },
    })

    // Fetch coaches for all cohorts
    const coachIds = [...new Set(cohorts.map(c => c.coachId))]
    const coaches = await db.user.findMany({
      where: { id: { in: coachIds } },
      select: { id: true, name: true, email: true },
    })
    const coachMap = new Map(coaches.map(c => [c.id, c]))

    const cohortsWithCounts = cohorts.map((cohort) => {
      const coach = coachMap.get(cohort.coachId)
      return {
        id: cohort.id,
        name: cohort.name,
        coach: coach ? {
          id: coach.id,
          name: coach.name,
          email: coach.email,
        } : null,
        activeClients: cohort.memberships.length,
        pendingInvites: cohort.invites.length,
        createdAt: cohort.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ cohorts: cohortsWithCounts }, { status: 200 })
  } catch (error) {
    console.error("Error fetching admin cohorts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
