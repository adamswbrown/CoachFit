import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { db } from "@/lib/db"

// GET /api/invites/[id]/email-status - Get email delivery status for an invite
// Supports both CoachInvite and CohortInvite via ?type=coach|cohort (defaults to coach)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden: Coach or Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const inviteType = searchParams.get("type") || "coach"

    // Verify the invite exists and the user owns it
    if (inviteType === "cohort") {
      const invite = await db.cohortInvite.findUnique({
        where: { id },
        include: { Cohort: { select: { coachId: true } } },
      })

      if (!invite) {
        return NextResponse.json({ error: "Invite not found" }, { status: 404 })
      }

      if (!isAdmin(session.user) && invite.Cohort.coachId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Get all email events for this cohort invite
      const events = await db.emailEvent.findMany({
        where: { cohortInviteId: id },
        orderBy: { occurredAt: "desc" },
      })

      const latestEvent = events[0] || null

      return NextResponse.json({
        inviteId: id,
        inviteType: "cohort",
        email: invite.email,
        latestStatus: latestEvent?.status || null,
        latestEvent,
        allEvents: events,
      })
    } else {
      // Coach invite (default)
      const invite = await db.coachInvite.findUnique({
        where: { id },
      })

      if (!invite) {
        return NextResponse.json({ error: "Invite not found" }, { status: 404 })
      }

      if (!isAdmin(session.user) && invite.coachId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Get all email events for this coach invite
      const events = await db.emailEvent.findMany({
        where: { coachInviteId: id },
        orderBy: { occurredAt: "desc" },
      })

      const latestEvent = events[0] || null

      return NextResponse.json({
        inviteId: id,
        inviteType: "coach",
        email: invite.email,
        latestStatus: latestEvent?.status || null,
        latestEvent,
        allEvents: events,
      })
    }
  } catch (error) {
    console.error("Error fetching email status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
