import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { weeklyQuestionnaireResponseSchema } from "@/lib/validations"
import { isClient } from "@/lib/permissions"

const getCurrentWeek = (startDate: Date) => {
  const start = new Date(startDate)
  const today = new Date()
  start.setUTCHours(0, 0, 0, 0)
  today.setUTCHours(0, 0, 0, 0)
  const diffMs = today.getTime() - start.getTime()
  if (diffMs < 0) return 0
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.min(5, Math.floor(diffDays / 7) + 1)
}

// GET /api/weekly-questionnaire/[cohortId]/[weekNumber] - Fetch questionnaire template + user's response
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string; weekNumber: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { cohortId, weekNumber } = await params
    const weekNum = parseInt(weekNumber)

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 5) {
      return NextResponse.json({ error: "Invalid week number. Must be 1-5" }, { status: 400 })
    }

    // Verify user is a member of this cohort
    const membership = await db.cohortMembership.findUnique({
      where: {
        userId_cohortId: {
          userId: session.user.id,
          cohortId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this cohort" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { cohortStartDate: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    if (!cohort.cohortStartDate) {
      return NextResponse.json({ error: "Cohort start date not set" }, { status: 400 })
    }

    const currentWeek = getCurrentWeek(cohort.cohortStartDate)
    if (currentWeek < 1) {
      return NextResponse.json({ error: "Questionnaire not available yet" }, { status: 403 })
    }

    if (weekNum > currentWeek) {
      return NextResponse.json({ error: "Questionnaire not available yet" }, { status: 403 })
    }

    const isPastWeek = weekNum < currentWeek

    // Fetch the questionnaire bundle
    const bundle = await db.questionnaireBundle.findUnique({
      where: { cohortId },
    })

    if (!bundle) {
      return NextResponse.json({ error: "No questionnaire bundle found for this cohort" }, { status: 404 })
    }

    // Fetch user's existing response (if any)
    const response = await db.weeklyQuestionnaireResponse.findUnique({
      where: {
        userId_cohortId_weekNumber: {
          userId: session.user.id,
          cohortId,
          weekNumber: weekNum,
        },
      },
    })

    return NextResponse.json({
      bundleJson: bundle.bundleJson,
      responseData: response?.responseJson || null,
      status: response?.status || "not_started",
      submittedAt: response?.submittedAt || null,
      weekNumber: weekNum,
      locked: isPastWeek || response?.status === "completed",
    })
  } catch (error) {
    console.error("Error fetching questionnaire:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/weekly-questionnaire/[cohortId]/[weekNumber] - Upsert response (auto-save)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string; weekNumber: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { cohortId, weekNumber } = await params
    const weekNum = parseInt(weekNumber)

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 5) {
      return NextResponse.json({ error: "Invalid week number. Must be 1-5" }, { status: 400 })
    }

    // Verify user is a member of this cohort
    const membership = await db.cohortMembership.findUnique({
      where: {
        userId_cohortId: {
          userId: session.user.id,
          cohortId,
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "You are not a member of this cohort" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { cohortStartDate: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    if (!cohort.cohortStartDate) {
      return NextResponse.json({ error: "Cohort start date not set" }, { status: 400 })
    }

    const currentWeek = getCurrentWeek(cohort.cohortStartDate)
    if (currentWeek < 1) {
      return NextResponse.json({ error: "Questionnaire not available yet" }, { status: 403 })
    }

    if (weekNum > currentWeek) {
      return NextResponse.json({ error: "Questionnaire not available yet" }, { status: 403 })
    }

    if (weekNum < currentWeek) {
      return NextResponse.json({ error: "Questionnaire is locked for past weeks" }, { status: 403 })
    }

    const body = await req.json()
    const validated = weeklyQuestionnaireResponseSchema.parse({
      weekNumber: weekNum,
      responseJson: body.responseJson,
      status: body.status,
    })

    const existing = await db.weeklyQuestionnaireResponse.findUnique({
      where: {
        userId_cohortId_weekNumber: {
          userId: session.user.id,
          cohortId,
          weekNumber: weekNum,
        },
      },
      select: { status: true, submittedAt: true },
    })

    if (existing?.status === "completed") {
      return NextResponse.json({ error: "Questionnaire is locked after completion" }, { status: 403 })
    }

    const isAlreadyCompleted = existing?.status === "completed"
    const nextStatus =
      validated.status === "completed" ? "completed" : isAlreadyCompleted ? "completed" : "in_progress"
    const submittedAt =
      nextStatus === "completed" ? existing?.submittedAt || new Date() : null

    // Upsert the response
    const response = await db.weeklyQuestionnaireResponse.upsert({
      where: {
        userId_cohortId_weekNumber: {
          userId: session.user.id,
          cohortId,
          weekNumber: weekNum,
        },
      },
      create: {
        userId: session.user.id,
        cohortId,
        weekNumber: weekNum,
        responseJson: validated.responseJson,
        status: validated.status || "in_progress",
        submittedAt,
      },
      update: {
        responseJson: validated.responseJson,
        status: validated.status || "in_progress",
        submittedAt,
      },
    })

    return NextResponse.json({
      id: response.id,
      weekNumber: response.weekNumber,
      status: response.status,
      submittedAt: response.submittedAt,
      updatedAt: response.updatedAt,
    })
  } catch (error: any) {
    console.error("Error saving questionnaire response:", error)

    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
