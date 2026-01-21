import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"

const getWeekNumber = (cohortStartDate: Date, weekStart: Date) => {
  const start = new Date(cohortStartDate)
  const week = new Date(weekStart)
  start.setUTCHours(0, 0, 0, 0)
  week.setUTCHours(0, 0, 0, 0)
  const diffMs = week.getTime() - start.getTime()
  if (diffMs < 0) return 0
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.min(5, Math.floor(diffDays / 7) + 1)
}

const collectQuestionTitles = (template: any) => {
  const titleMap = new Map<string, { title?: string; description?: string }>()

  const walkElements = (elements: any[]) => {
    elements.forEach((el) => {
      if (el?.name && (el?.title || el?.description)) {
        titleMap.set(el.name, {
          title: el.title,
          description: el.description,
        })
      }

      if (Array.isArray(el?.elements)) {
        walkElements(el.elements)
      }
    })
  }

  if (template?.pages && Array.isArray(template.pages)) {
    template.pages.forEach((page: any) => {
      if (Array.isArray(page?.elements)) {
        walkElements(page.elements)
      }
    })
  }

  return titleMap
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const clientId = searchParams.get("clientId")
    const weekStartParam = searchParams.get("weekStart")
    const weekNumberParam = searchParams.get("weekNumber")
    const cohortIdParam = searchParams.get("cohortId")

    if (!clientId || (!weekStartParam && !weekNumberParam)) {
      return NextResponse.json(
        { error: "clientId and weekStart or weekNumber are required" },
        { status: 400 }
      )
    }

    let cohortId = cohortIdParam || ""
    let weekNumber = weekNumberParam ? parseInt(weekNumberParam) : 0

    if (weekNumberParam && (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 5)) {
      return NextResponse.json({ error: "Invalid weekNumber" }, { status: 400 })
    }

    if (!weekNumberParam && weekStartParam) {
      const weekStart = new Date(weekStartParam)
      if (isNaN(weekStart.getTime())) {
        return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 })
      }

      const memberships = await db.cohortMembership.findMany({
        where: { userId: clientId },
        include: {
          Cohort: {
            select: {
              id: true,
              name: true,
              cohortStartDate: true,
              coachId: true,
            },
          },
        },
      })

      if (memberships.length === 0) {
        return NextResponse.json({ error: "Client not in any cohorts" }, { status: 404 })
      }

      const eligible = memberships
        .filter((m) => m.Cohort.cohortStartDate)
        .map((m) => ({
          cohortId: m.Cohort.id,
          cohortName: m.Cohort.name,
          cohortStartDate: m.Cohort.cohortStartDate as Date,
          coachId: m.Cohort.coachId,
        }))
        .filter((m) => new Date(m.cohortStartDate).getTime() <= weekStart.getTime())
        .sort(
          (a, b) =>
            new Date(b.cohortStartDate).getTime() - new Date(a.cohortStartDate).getTime()
        )

      if (eligible.length === 0) {
        return NextResponse.json({ error: "No cohort found for week" }, { status: 404 })
      }

      const cohort = eligible[0]
      cohortId = cohort.cohortId
      weekNumber = getWeekNumber(cohort.cohortStartDate, weekStart)

      if (weekNumber < 1 || weekNumber > 5) {
        return NextResponse.json({ error: "No questionnaire for this week" }, { status: 404 })
      }
    }

    if (!cohortId) {
      const latestResponse = await db.weeklyQuestionnaireResponse.findFirst({
        where: {
          userId: clientId,
          weekNumber,
        },
        orderBy: { updatedAt: "desc" },
        select: { cohortId: true },
      })

      if (!latestResponse) {
        return NextResponse.json({ error: "No response found" }, { status: 404 })
      }

      cohortId = latestResponse.cohortId
    }

    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, name: true, coachId: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    if (!isAdmin(session.user) && cohort.coachId !== session.user.id) {
      const isCoCoach = await db.coachCohortMembership.findUnique({
        where: {
          coachId_cohortId: {
            coachId: session.user.id,
            cohortId,
          },
        },
      })

      if (!isCoCoach) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const response = await db.weeklyQuestionnaireResponse.findUnique({
      where: {
        userId_cohortId_weekNumber: {
          userId: clientId,
          cohortId,
          weekNumber,
        },
      },
    })

    if (!response) {
      return NextResponse.json({ error: "No response found" }, { status: 404 })
    }

    const bundle = await db.questionnaireBundle.findUnique({
      where: { cohortId },
    })

    const weekKey = `week${weekNumber}`
    const template = bundle?.bundleJson && typeof bundle.bundleJson === "object"
      ? (bundle.bundleJson as any)[weekKey] || bundle.bundleJson
      : null

    const titleMap = template ? collectQuestionTitles(template) : new Map()
    const answers = Object.entries(response.responseJson || {}).map(([key, value]) => {
      const meta = titleMap.get(key)
      return {
        key,
        title: meta?.title || key,
        description: meta?.description || null,
        value,
      }
    })

    return NextResponse.json({
      cohortId,
      cohortName: cohort.name,
      weekNumber,
      status: response.status,
      submittedAt: response.submittedAt,
      updatedAt: response.updatedAt,
      answers,
    })
  } catch (error) {
    console.error("Error fetching questionnaire response:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
