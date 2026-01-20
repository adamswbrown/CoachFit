import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"

// GET /api/coach/weekly-questionnaire-responses/[cohortId]/[weekNumber] - Return aggregated response data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string; weekNumber: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { cohortId, weekNumber } = await params
    const weekNum = parseInt(weekNumber)

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 5) {
      return NextResponse.json({ error: "Invalid week number. Must be 1-5" }, { status: 400 })
    }

    // Verify coach has access to this cohort
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, coachId: true, name: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Check ownership (only owner or admin can access)
    if (cohort.coachId !== session.user.id && !isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch all responses for this cohort and week
    const responses = await db.weeklyQuestionnaireResponse.findMany({
      where: {
        cohortId,
        weekNumber: weekNum,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    // Return aggregated data
    const aggregatedData = responses.map((response) => ({
      userId: response.userId,
      userName: response.user.name,
      userEmail: response.user.email,
      responseJson: response.responseJson,
      status: response.status,
      submittedAt: response.submittedAt,
      updatedAt: response.updatedAt,
    }))

    // Calculate completion stats
    const totalClients = responses.length
    const completedCount = responses.filter((r) => r.status === "completed").length
    const inProgressCount = responses.filter((r) => r.status === "in_progress").length

    return NextResponse.json({
      cohortId,
      cohortName: cohort.name,
      weekNumber: weekNum,
      responses: aggregatedData,
      stats: {
        total: totalClients,
        completed: completedCount,
        inProgress: inProgressCount,
        notStarted: 0, // We don't track "not started" in the database
      },
    })
  } catch (error) {
    console.error("Error fetching questionnaire responses:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
