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

    const membership = await db.cohortMembership.findFirst({
      where: { userId: session.user.id },
    })

    return NextResponse.json({ hasMembership: !!membership })
  } catch (error) {
    console.error("Error checking membership:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
