import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isClient } from "@/lib/permissions"
import { db } from "@/lib/db"

/**
 * GET /api/onboarding/invite-context
 * Returns invite context for the signed-in client (cohort + coach details).
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isClient(session.user)) {
    return NextResponse.json({ error: "Only clients can view invite context" }, { status: 403 })
  }

  try {
    const email = session.user.email.toLowerCase()

    const cohortInvites = await db.cohortInvite.findMany({
      where: { email },
      include: {
        Cohort: {
          select: {
            id: true,
            name: true,
            coachId: true,
            User: {
              select: { name: true, email: true },
            },
          },
        },
      },
    })

    const coachInvites = await db.coachInvite.findMany({
      where: { email },
      include: {
        User: {
          select: { name: true, email: true },
        },
      },
    })

    const cohortInviteSummaries = cohortInvites.map((invite) => ({
      cohortId: invite.Cohort.id,
      cohortName: invite.Cohort.name,
      coachName: invite.Cohort.User?.name || null,
      coachEmail: invite.Cohort.User?.email || null,
    }))

    const coachInviteSummaries = coachInvites.map((invite) => ({
      coachName: invite.User?.name || null,
      coachEmail: invite.User?.email || null,
    }))

    return NextResponse.json(
      {
        data: {
          cohortInvites: cohortInviteSummaries,
          coachInvites: coachInviteSummaries,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching invite context:", error)
    return NextResponse.json(
      { error: "Failed to fetch invite context" },
      { status: 500 }
    )
  }
}
