import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"

// GET /api/client/cohorts - Fetch user's cohorts
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch all cohorts the user is a member of
    const memberships = await db.cohortMembership.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        Cohort: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const cohorts = memberships.map((membership) => ({
      id: membership.Cohort.id,
      name: membership.Cohort.name,
    }))

    return NextResponse.json({ cohorts })
  } catch (error) {
    console.error("Error fetching user cohorts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
