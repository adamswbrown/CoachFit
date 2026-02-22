import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"

// GET /api/admin/email-events - List email events with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const to = searchParams.get("to")
    const status = searchParams.get("status")
    const resendEmailId = searchParams.get("resendEmailId")
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100)
    const offset = (page - 1) * limit

    // Build filter
    const where: Record<string, unknown> = {}
    if (to) where.to = to
    if (status) where.status = status
    if (resendEmailId) where.resendEmailId = resendEmailId

    const [events, total] = await Promise.all([
      db.emailEvent.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          CoachInvite: {
            select: { id: true, email: true, coachId: true },
          },
          CohortInvite: {
            select: { id: true, email: true, cohortId: true },
          },
        },
      }),
      db.emailEvent.count({ where }),
    ])

    return NextResponse.json({
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching email events:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
