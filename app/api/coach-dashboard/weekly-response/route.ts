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

const weeklyResponseSchema = z.object({
  clientId: z.string().uuid(),
  weekStart: z.string(),
  loomUrl: z.string().url().optional().nullable(),
  note: z.string().max(10000).optional().nullable(),
})

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
    weekStart.setHours(0, 0, 0, 0)

    const response = await db.weeklyCoachResponse.findUnique({
      where: {
        coachId_clientId_weekStart: {
          coachId: session.user.id,
          clientId: clientId,
          weekStart: weekStart,
        },
      },
    })

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
    weekStart.setHours(0, 0, 0, 0)

    // Upsert the response
    const response = await db.weeklyCoachResponse.upsert({
      where: {
        coachId_clientId_weekStart: {
          coachId: session.user.id,
          clientId: validated.clientId,
          weekStart: weekStart,
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
