import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"

/**
 * Combined dashboard endpoint that returns cohorts, coaches, and users in one request
 * This reduces the number of API calls from 3 to 1
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Batch load all data in parallel
    const [cohorts, coaches, users] = await Promise.all([
      // Cohorts
      db.cohort.findMany({
        include: {
          memberships: {
            select: {
              userId: true,
            },
          },
          invites: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      // Coaches
      db.user.findMany({
        where: {
          roles: { has: Role.COACH },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      // Users
      db.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          isTestUser: true,
          createdAt: true,
          passwordHash: true,
          Account: {
            select: {
              provider: true,
            },
          },
          CohortMembership: {
            select: {
              Cohort: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          Cohort: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    // Map coaches for cohort data
    const coachIds = [...new Set(cohorts.map((c: { coachId: string }) => c.coachId))]
    const cohortCoaches = await db.user.findMany({
      where: { id: { in: coachIds } },
      select: { id: true, name: true, email: true },
    })
    type Coach = { id: string; name: string; email: string }
    const coachMap = new Map<string, Coach>(cohortCoaches.map((c: Coach) => [c.id, c]))

    // Format cohorts
    const formattedCohorts = cohorts.map((cohort) => {
      const coach = coachMap.get(cohort.coachId)
      return {
        id: cohort.id,
        name: cohort.name,
        coach: coach ? {
          id: coach.id,
          name: coach.name,
          email: coach.email,
        } : null,
        activeClients: cohort.memberships.length,
        pendingInvites: cohort.invites.length,
        createdAt: cohort.createdAt.toISOString(),
      }
    })

    // Format users
    const formattedUsers = users.map((user: { id: string; email: string; name: string | null; roles: string[]; isTestUser: boolean; createdAt: Date; passwordHash: string | null; Account: { provider: string }[]; CohortMembership: { Cohort: { id: string; name: string } }[]; Cohort: { id: string; name: string }[] }) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      isTestUser: user.isTestUser,
      createdAt: user.createdAt,
      hasPassword: !!user.passwordHash,
      authProviders: user.Account.map((a) => a.provider),
      cohortsMemberOf: user.CohortMembership.map((m) => ({
        id: m.Cohort.id,
        name: m.Cohort.name,
      })),
      cohortsCoaching: user.Cohort.map((c) => ({
        id: c.id,
        name: c.name,
      })),
    }))

    return NextResponse.json(
      {
        cohorts: formattedCohorts,
        coaches,
        users: formattedUsers,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching admin dashboard:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
