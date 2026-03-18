/**
 * GET  /api/coach-dashboard/milestones — List milestones for coach's clients
 * POST /api/coach-dashboard/milestones — Create a custom milestone
 * PATCH /api/coach-dashboard/milestones — Add coach message to a milestone
 */

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isCoach, isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isCoach(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const milestones = await db.milestone.findMany({
    where: { coachId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true, email: true } },
      cohort: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ milestones })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isCoach(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { clientId, cohortId, title, description, type, targetValue } = body

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const milestone = await db.milestone.create({
    data: {
      coachId: session.user.id,
      clientId: clientId || null,
      cohortId: cohortId || null,
      title,
      description: description || null,
      type: type || "custom",
      targetValue: targetValue || null,
    },
  })

  return NextResponse.json({ milestone }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isCoach(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { milestoneId, message } = body

  if (!milestoneId) {
    return NextResponse.json({ error: "milestoneId is required" }, { status: 400 })
  }

  // Verify ownership
  const existing = await db.milestone.findUnique({
    where: { id: milestoneId },
  })

  if (!existing || existing.coachId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await db.milestone.update({
    where: { id: milestoneId },
    data: { message: message || null },
  })

  return NextResponse.json({ milestone: updated })
}
