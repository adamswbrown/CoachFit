import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getBatchChallengeProgress } from "@/lib/challenges"
import { isAdminOrCoach } from "@/lib/permissions"

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

    const result = await getBatchChallengeProgress(cohortId)

    return NextResponse.json(result, { status: 200 })
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
