import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"

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

    const { id: clientId } = await params

    // Fetch client account settings
    const client = await db.user.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Verify the client belongs to this coach (or is admin)
    if (!session.user.roles.includes(Role.ADMIN)) {
      // Check if client is in any of the coach's cohorts
      const cohortMembership = await db.cohortMembership.findFirst({
        where: {
          userId: clientId,
          Cohort: {
            coachId: session.user.id,
          },
        },
      })

      if (!cohortMembership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error("Error fetching client settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
