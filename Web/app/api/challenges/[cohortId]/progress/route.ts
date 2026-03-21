import { NextRequest, NextResponse } from "next/server"
import { getSessionWithMobile } from "@/lib/auth-mobile"
import { getChallengeProgress } from "@/lib/challenges"
import { isAdminOrCoach } from "@/lib/permissions"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const session = await getSessionWithMobile()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { cohortId } = await params

    // Coaches/admins may query a specific clientId; clients can only view their own
    const searchParams = req.nextUrl.searchParams
    const queryClientId = searchParams.get("clientId")

    let clientId = session.user.id

    if (queryClientId) {
      if (!isAdminOrCoach(session.user)) {
        return NextResponse.json(
          { error: "Forbidden: only coaches and admins can view other clients' progress" },
          { status: 403 }
        )
      }
      clientId = queryClientId
    }

    const progress = await getChallengeProgress(clientId, cohortId)

    return NextResponse.json(progress, { status: 200 })
  } catch (error: any) {
    if (
      error.message === "Challenge not found" ||
      error.message === "Cohort is not a challenge"
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error("Error fetching challenge progress:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
