import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"

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

    // Defensive check: verify role is COACH
    if (!session.user.roles.includes(Role.COACH)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Authorization: Verify coach has access to this client (client is in at least one cohort owned by coach)
    const membership = await db.cohortMembership.findFirst({
      where: {
        userId: id,
        Cohort: {
          coachId: session.user.id,
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: Client not in your cohorts" },
        { status: 403 }
      )
    }

    return NextResponse.json(client, { status: 200 })
  } catch (error) {
    console.error("Error fetching client:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
