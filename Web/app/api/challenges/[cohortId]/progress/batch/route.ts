import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getChallengeProgress } from "@/lib/challenges"
import { isAdminOrCoach } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { cohortId } = await params

    // Get all members of this cohort
    const memberships = await db.cohortMembership.findMany({
      where: { cohortId },
      select: { userId: true },
    })

    // Fetch progress for each member in parallel
    const results = await Promise.all(
      memberships.map(async (m) => {
        try {
          const progress = await getChallengeProgress(m.userId, cohortId)
          return { clientId: m.userId, ...progress }
        } catch {
          return { clientId: m.userId, error: "Failed to fetch progress" }
        }
      })
    )

    return NextResponse.json(results, { status: 200 })
  } catch (error: any) {
    if (
      error.message === "Challenge not found" ||
      error.message === "Cohort is not a challenge"
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error("Error fetching batch challenge progress:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
