import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!session.user.roles.includes(Role.CLIENT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [membership, user] = await Promise.all([
      db.cohortMembership.findFirst({
        where: { userId: session.user.id },
      }),
      db.user.findUnique({
        where: { id: session.user.id },
        select: { invitedByCoachId: true },
      }),
    ])

    // User has a coach if they're in a cohort OR were invited by a coach
    const hasMembership = !!membership || !!user?.invitedByCoachId

    return NextResponse.json({ hasMembership })
  } catch (error) {
    console.error("Error checking membership:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
