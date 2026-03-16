import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"

/**
 * GET /api/coach-dashboard/members
 *
 * Returns all users with CLIENT role — gym members list for coaches.
 * Includes latest entry date, entry count (7 days), and latest weight.
 */
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const clients = await db.user.findMany({
      where: {
        roles: { has: Role.CLIENT },
        isTestUser: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        onboardingComplete: true,
        CohortMembership: {
          select: {
            Cohort: {
              select: { id: true, name: true },
            },
          },
        },
        Entry: {
          orderBy: { date: "desc" },
          take: 1,
          select: {
            date: true,
            weightLbs: true,
          },
        },
        _count: {
          select: {
            Entry: {
              where: {
                date: { gte: sevenDaysAgo },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const members = clients.map((client) => ({
      id: client.id,
      email: client.email,
      name: client.name,
      joinedAt: client.createdAt,
      onboardingComplete: client.onboardingComplete,
      cohort: client.CohortMembership?.[0]?.Cohort ?? null,
      lastEntryDate: client.Entry[0]?.date ?? null,
      lastWeight: client.Entry[0]?.weightLbs ?? null,
      entriesLast7Days: (client._count as any)?.Entry ?? 0,
    }))

    return NextResponse.json({ members })
  } catch (error) {
    console.error("Error fetching gym members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
