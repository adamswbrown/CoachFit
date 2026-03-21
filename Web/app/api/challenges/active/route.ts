import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getActiveChallenges } from "@/lib/challenges"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const challenges = await getActiveChallenges(session.user.id)

    return NextResponse.json(challenges, { status: 200 })
  } catch (error) {
    console.error("Error fetching active challenges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
