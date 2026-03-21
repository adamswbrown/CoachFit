import { NextRequest, NextResponse } from "next/server"
import { getSessionWithMobile } from "@/lib/auth-mobile"
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

/**
 * Walk SurveyJS JSON model and extract question elements as a flat list.
 * Handles both { pages: [{ elements }] } and { elements: [] } shapes,
 * plus nested panels.
 */
function extractQuestions(
  template: any
): Array<{
  name: string
  type: string
  title: string | null
  description: string | null
  inputType: string | null
  isRequired: boolean
}> {
  const questions: Array<{
    name: string
    type: string
    title: string | null
    description: string | null
    inputType: string | null
    isRequired: boolean
  }> = []

  const walk = (elements: any[]) => {
    if (!Array.isArray(elements)) return
    for (const el of elements) {
      if (!el) continue
      // Panels contain nested elements
      if (el.type === "panel" && Array.isArray(el.elements)) {
        walk(el.elements)
        continue
      }
      if (el.name) {
        questions.push({
          name: el.name,
          type: el.type || "text",
          title: el.title || el.name,
          description: el.description || null,
          inputType: el.inputType || null,
          isRequired: el.isRequired ?? false,
        })
      }
    }
  }

  if (template?.pages && Array.isArray(template.pages)) {
    for (const page of template.pages) {
      if (Array.isArray(page?.elements)) {
        walk(page.elements)
      }
    }
  } else if (Array.isArray(template?.elements)) {
    walk(template.elements)
  }

  return questions
}

// GET /api/client/questionnaire/[cohortId]/[weekNumber]
// Mobile-aware: supports both Clerk session and X-Pairing-Token
// Returns flattened questions (no SurveyJS dependency needed on iOS)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string; weekNumber: string }> }
) {
  try {
    const session = await getSessionWithMobile()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { cohortId, weekNumber } = await params
    const weekNum = parseInt(weekNumber)

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 5) {
      return NextResponse.json(
        { error: "Invalid week number. Must be 1-5" },
        { status: 400 }
      )
    }

    // Verify user is a member of this cohort
    const membership = await db.cohortMembership.findFirst({
      where: {
        userId: session.user.id,
        cohortId,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this cohort" },
        { status: 403 }
      )
    }

    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { cohortStartDate: true },
    })

    if (!cohort?.cohortStartDate) {
      return NextResponse.json(
        { error: "Cohort start date not set" },
        { status: 400 }
      )
    }

    const currentWeek = getCurrentWeek(cohort.cohortStartDate)
    if (weekNum > currentWeek || currentWeek < 1) {
      return NextResponse.json(
        { error: "Questionnaire not available yet" },
        { status: 403 }
      )
    }

    const isPastWeek = weekNum < currentWeek

    // Fetch the questionnaire bundle
    const bundle = await db.questionnaireBundle.findUnique({
      where: { cohortId },
    })

    // Extract the week's template from the bundle
    let questions: ReturnType<typeof extractQuestions> = []
    if (bundle?.bundleJson && typeof bundle.bundleJson === "object") {
      const bundleObj = bundle.bundleJson as any
      const weekKey = `week${weekNum}`
      const weekTemplate = bundleObj[weekKey] || bundleObj
      questions = extractQuestions(weekTemplate)
    }

    // If no questions found from the bundle, provide defaults
    if (questions.length === 0) {
      questions = [
        {
          name: "went_well",
          type: "comment",
          title: "What went well this week?",
          description: null,
          inputType: null,
          isRequired: true,
        },
        {
          name: "biggest_challenge",
          type: "comment",
          title: "What was your biggest challenge?",
          description: null,
          inputType: null,
          isRequired: true,
        },
        {
          name: "days_trained",
          type: "text",
          title: "How many days did you train?",
          description: null,
          inputType: "number",
          isRequired: true,
        },
        {
          name: "days_steps",
          type: "text",
          title: "How many days did you hit your step target?",
          description: null,
          inputType: "number",
          isRequired: true,
        },
        {
          name: "days_calories",
          type: "text",
          title: "How many days were you within your calorie target?",
          description: null,
          inputType: "number",
          isRequired: true,
        },
        {
          name: "help_needed",
          type: "comment",
          title: "Is there anything you need help with?",
          description: null,
          inputType: null,
          isRequired: false,
        },
      ]
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

    const isLocked = isPastWeek || response?.status === "completed"

    return NextResponse.json({
      weekNumber: weekNum,
      status: response?.status || "not_started",
      locked: isLocked,
      submittedAt: response?.submittedAt || null,
      questions,
      existingResponses: response?.responseJson || null,
    })
  } catch (error) {
    console.error("Error fetching client questionnaire:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT /api/client/questionnaire/[cohortId]/[weekNumber]
// Mobile-aware: supports both Clerk session and X-Pairing-Token
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string; weekNumber: string }> }
) {
  try {
    const session = await getSessionWithMobile()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { cohortId, weekNumber } = await params
    const weekNum = parseInt(weekNumber)

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 5) {
      return NextResponse.json(
        { error: "Invalid week number. Must be 1-5" },
        { status: 400 }
      )
    }

    // Verify user is a member of this cohort
    const membership = await db.cohortMembership.findFirst({
      where: {
        userId: session.user.id,
        cohortId,
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this cohort" },
        { status: 403 }
      )
    }

    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { cohortStartDate: true },
    })

    if (!cohort?.cohortStartDate) {
      return NextResponse.json(
        { error: "Cohort start date not set" },
        { status: 400 }
      )
    }

    const currentWeek = getCurrentWeek(cohort.cohortStartDate)
    if (weekNum > currentWeek || currentWeek < 1) {
      return NextResponse.json(
        { error: "Questionnaire not available yet" },
        { status: 403 }
      )
    }

    if (weekNum < currentWeek) {
      return NextResponse.json(
        { error: "Questionnaire is locked for past weeks" },
        { status: 403 }
      )
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
      return NextResponse.json(
        { error: "Questionnaire is locked after completion" },
        { status: 403 }
      )
    }

    const nextStatus =
      validated.status === "completed" ? "completed" : "in_progress"
    const submittedAt =
      nextStatus === "completed"
        ? existing?.submittedAt || new Date()
        : null

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
        status: nextStatus,
        submittedAt,
      },
      update: {
        responseJson: validated.responseJson,
        status: nextStatus,
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
    console.error("Error saving client questionnaire response:", error)

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
