import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"

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

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Fetch user with all related data
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        isTestUser: true,
        createdAt: true,
        passwordHash: true,
        onboardingComplete: true,
        invitedByCoachId: true,
        Account: {
          select: {
            provider: true,
            type: true,
          },
        },
        CohortMembership: {
          select: {
            Cohort: {
              select: {
                id: true,
                name: true,
                createdAt: true,
              },
            },
          },
        },
        Cohort: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            memberships: {
              select: {
                userId: true,
              },
            },
          },
        },
        Entry: {
          select: {
            id: true,
            date: true,
            weightLbs: true,
            steps: true,
            calories: true,
            createdAt: true,
          },
          orderBy: {
            date: "desc",
          },
          take: 10, // Get last 10 entries
        },
          ClientPairingCodes: {
            where: {
              usedAt: { not: null },
            },
            select: {
              code: true,
              usedAt: true,
              expiresAt: true,
            },
            orderBy: {
              usedAt: "desc",
            },
            take: 1,
          },
          Workouts: {
            select: {
              id: true,
            },
          },
          SleepRecords: {
            select: {
              id: true,
            },
          },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Format the response
    const formattedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      isTestUser: user.isTestUser,
      createdAt: user.createdAt,
      onboardingComplete: user.onboardingComplete,
      hasPassword: !!user.passwordHash,
      authProviders: user.Account.map((a: { provider: string }) => a.provider),
      cohortsMemberOf: user.CohortMembership.map((m: { Cohort: { id: string; name: string; createdAt: Date } }) => ({
        id: m.Cohort.id,
        name: m.Cohort.name,
        createdAt: m.Cohort.createdAt,
      })),
      cohortsCoaching: user.Cohort.map((c: { id: string; name: string; createdAt: Date; memberships: { userId: string }[] }) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt,
        clientCount: c.memberships.length,
      })),
      recentEntries: user.Entry,
      invitedByCoachId: user.invitedByCoachId,
        healthKitPairing: user.ClientPairingCodes.length > 0 ? {
          paired: true,
          pairingCode: user.ClientPairingCodes[0].code,
          pairedAt: user.ClientPairingCodes[0].usedAt,
          deviceName: "iPhone",
          workoutCount: user.Workouts.length,
          sleepCount: user.SleepRecords.length,
        } : null,
    }

    return NextResponse.json(formattedUser, { status: 200 })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
