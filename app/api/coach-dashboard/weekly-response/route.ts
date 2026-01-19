import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin, isCoach } from "@/lib/permissions"
import { z } from "zod"

/**
 * Get Monday of a given date (start of week)
 */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

const weeklyResponseSchema = z.object({
  clientId: z.string().uuid(),
  weekStart: z.string(),
  loomUrl: z.string().url().optional().nullable(),
  note: z.string().max(10000).optional().nullable(),
})

type WeeklyCoachResponseRow = {
  id: string
  coachId: string
  clientId: string
  weekStart: Date
  loomUrl: string | null
  note: string | null
  createdAt: Date
  updatedAt: Date
}

const getWeeklyCoachResponseModel = () => {
  return (db as unknown as { weeklyCoachResponse?: any }).weeklyCoachResponse
}

/**
 * GET /api/coach-dashboard/weekly-response
 * 
 * Get existing weekly response for a client and week.
 * Query params:
 *   - clientId: UUID
 *   - weekStart: YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Must be COACH or ADMIN
    const isCoachUser = isCoach(session.user)
    const isAdminUser = isAdmin(session.user)

    if (!isCoachUser && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const clientId = searchParams.get("clientId")
    const weekStartParam = searchParams.get("weekStart")

    if (!clientId || !weekStartParam) {
      return NextResponse.json(
        { error: "clientId and weekStart are required" },
        { status: 400 }
      )
    }

    // Verify client exists and is in coach's cohorts
    if (!isAdminUser) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: clientId,
          Cohort: {
            coachId: session.user.id,
          },
        },
      })
      if (!membership) {
        return NextResponse.json(
          { error: "Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    const weekStart = getMonday(new Date(weekStartParam))
    const weekStartStr = formatDate(weekStart)
    const weekStartDate = new Date(weekStartStr)

    const weeklyCoachResponse = getWeeklyCoachResponseModel()
    let response: WeeklyCoachResponseRow | null = null

    if (weeklyCoachResponse) {
      response = await weeklyCoachResponse.findUnique({
        where: {
          coachId_clientId_weekStart: {
            coachId: session.user.id,
            clientId: clientId,
            weekStart: weekStartDate,
          },
        },
      })
    } else {
      const rows = await db.$queryRaw<WeeklyCoachResponseRow[]>`
        SELECT
          "id",
          "coachId",
          "clientId",
          "weekStart",
          "loomUrl",
          "note",
          "createdAt",
          "updatedAt"
        FROM "WeeklyCoachResponse"
        WHERE "coachId" = ${session.user.id}
          AND "clientId" = ${clientId}
          AND "weekStart" = ${weekStart}
        LIMIT 1
      `
      response = rows[0] ?? null
    }

    return NextResponse.json(response || {}, { status: 200 })
  } catch (error) {
    console.error("Error fetching weekly response:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/coach-dashboard/weekly-response
 * 
 * Save or update weekly response for a client.
 * Body:
 *   - clientId: UUID
 *   - weekStart: YYYY-MM-DD
 *   - loomUrl: string (optional)
 *   - note: string (optional)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Must be COACH or ADMIN
    const isCoachUser = isCoach(session.user)
    const isAdminUser = isAdmin(session.user)

    if (!isCoachUser && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = weeklyResponseSchema.parse(body)

    // Verify client exists and is in coach's cohorts
    if (!isAdminUser) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: validated.clientId,
          Cohort: {
            coachId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    const weekStart = getMonday(new Date(validated.weekStart))
    const weekStartStr = formatDate(weekStart)
    const weekStartDate = new Date(weekStartStr)

    // Check if the WeeklyCoachResponse model exists in the Prisma client
    // This handles the case where the schema was updated but Prisma client hasn't been regenerated
    if (!db.weeklyCoachResponse) {
      console.warn("WeeklyCoachResponse model not found in Prisma client. Please run 'npx prisma generate'")
      return NextResponse.json(
        { error: "Feature not available. Please regenerate Prisma client." },
        { status: 503 }
      )
    }

    // Upsert the response
    const weeklyCoachResponse = getWeeklyCoachResponseModel()
    let response: WeeklyCoachResponseRow | null = null

    if (weeklyCoachResponse) {
      response = await weeklyCoachResponse.upsert({
        where: {
          coachId_clientId_weekStart: {
            coachId: session.user.id,
            clientId: validated.clientId,
            weekStart: weekStartDate,
          },
        },
        update: {
          loomUrl: validated.loomUrl,
          note: validated.note,
        },
        create: {
          coachId: session.user.id,
          clientId: validated.clientId,
          weekStart: weekStart,
          loomUrl: validated.loomUrl,
          note: validated.note,
        },
      })
    } else {
      const existing = await db.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "WeeklyCoachResponse"
        WHERE "coachId" = ${session.user.id}
          AND "clientId" = ${validated.clientId}
          AND "weekStart" = ${weekStartDate}
        LIMIT 1
      `

      if (existing.length > 0) {
        await db.$executeRaw`
          UPDATE "WeeklyCoachResponse"
          SET "loomUrl" = ${validated.loomUrl},
              "note" = ${validated.note},
              "updatedAt" = NOW()
          WHERE "id" = ${existing[0].id}
        `
      } else {
        const newId = crypto.randomUUID()
        await db.$executeRaw`
          INSERT INTO "WeeklyCoachResponse"
            ("id", "coachId", "clientId", "weekStart", "loomUrl", "note", "createdAt", "updatedAt")
          VALUES
            (${newId}, ${session.user.id}, ${validated.clientId}, ${weekStartDate}, ${validated.loomUrl}, ${validated.note}, NOW(), NOW())
        `
      }

      const rows = await db.$queryRaw<WeeklyCoachResponseRow[]>`
        SELECT
          "id",
          "coachId",
          "clientId",
          "weekStart",
          "loomUrl",
          "note",
          "createdAt",
          "updatedAt"
        FROM "WeeklyCoachResponse"
        WHERE "coachId" = ${session.user.id}
          AND "clientId" = ${validated.clientId}
          AND "weekStart" = ${weekStart}
        LIMIT 1
      `
      response = rows[0] ?? null
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error saving weekly response:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
