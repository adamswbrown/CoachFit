import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"

// GET /api/coach/weekly-questionnaire-status - Return completion status for all clients
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const cohortId = searchParams.get("cohortId")
    const weekNumberParam = searchParams.get("weekNumber")
    const userId = searchParams.get("userId")
    const weekNumber = weekNumberParam ? parseInt(weekNumberParam) : undefined

    if (weekNumber !== undefined && (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 5)) {
      return NextResponse.json({ error: "Invalid week number. Must be 1-5" }, { status: 400 })
    }

    // Build the WHERE clause
    let whereClause: any = {}

    if (cohortId) {
      // If cohortId provided, verify coach has access to this cohort
      const cohort = await db.cohort.findUnique({
        where: { id: cohortId },
        select: { id: true, coachId: true, coachMemberships: { select: { coachId: true } } },
      })

      if (!cohort) {
        return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
      }

      // Check ownership (owner, co-coach, or admin)
      const isCoCoach = cohort.coachMemberships.some(
        (membership) => membership.coachId === session.user.id
      )
      if (cohort.coachId !== session.user.id && !isCoCoach && !isAdmin(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      whereClause.cohortId = cohortId
    } else {
      // No cohortId - get all cohorts this coach owns (admins can see all)
      if (!isAdmin(session.user)) {
        whereClause.cohort = {
          OR: [
            { coachId: session.user.id },
            { coachMemberships: { some: { coachId: session.user.id } } },
          ],
        }
      }
    }

    if (weekNumber !== undefined) {
      whereClause.weekNumber = weekNumber
    }

    if (userId) {
      whereClause.userId = userId
    }

    // Fetch all responses matching the criteria
    const responses = await db.weeklyQuestionnaireResponse.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cohort: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { cohortId: "asc" },
        { weekNumber: "asc" },
        { updatedAt: "desc" },
      ],
    })

    // Group by cohort and week
    const statusData = responses.map((response) => ({
      userId: response.userId,
      userName: response.user.name,
      userEmail: response.user.email,
      cohortId: response.cohortId,
      cohortName: response.cohort.name,
      weekNumber: response.weekNumber,
      status: response.status,
      submittedAt: response.submittedAt,
      updatedAt: response.updatedAt,
    }))

    return NextResponse.json({
      responses: statusData,
      count: statusData.length,
    })
  } catch (error) {
    console.error("Error fetching questionnaire status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
