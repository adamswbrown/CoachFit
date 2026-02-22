import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isClient } from "@/lib/permissions"
import { db } from "@/lib/db"

/**
 * GET /api/onboarding/invite-context
 * Returns invite context for the signed-in client (cohort + coach details).
 *
 * NOTE: Invite records (CoachInvite / CohortInvite) are deleted during the
 * signIn callback in lib/auth.ts after they are processed. So for users who
 * have already signed in, we also check invitedByCoachId and CohortMembership
 * on the User model as a fallback.
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

    const [cohortInvites, coachInvites] = await Promise.all([
      db.cohortInvite.findMany({
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
      }),
      db.coachInvite.findMany({
        where: { email },
        include: {
          User: {
            select: { name: true, email: true },
          },
        },
      }),
    ])

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

    // Fallback: if invite records were already deleted (processed during
    // sign-in), look at the user's invitedByCoachId and CohortMembership.
    if (cohortInviteSummaries.length === 0 && coachInviteSummaries.length === 0) {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          invitedByCoachId: true,
          // Self-relation "UserToUser" for the coach who invited this user
          User: {
            select: { name: true, email: true },
          },
          CohortMembership: {
            select: {
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
            take: 1,
          },
        },
      })

      if (user?.invitedByCoachId && user.User) {
        coachInviteSummaries.push({
          coachName: user.User.name || null,
          coachEmail: user.User.email || null,
        })
      }

      if (user?.CohortMembership && user.CohortMembership.length > 0) {
        const membership = user.CohortMembership[0]
        cohortInviteSummaries.push({
          cohortId: membership.Cohort.id,
          cohortName: membership.Cohort.name,
          coachName: membership.Cohort.User?.name || null,
          coachEmail: membership.Cohort.User?.email || null,
        })
      }
    }

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
