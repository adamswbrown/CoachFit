import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isStaff = isAdminOrCoach(session.user)

    // All challenge cohorts
    const cohorts = await db.cohort.findMany({
      where: { type: "CHALLENGE" },
      include: {
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    if (isStaff) {
      // Coaches/admins see all challenges with member counts
      const result = cohorts.map((c) => ({
        id: c.id,
        name: c.name,
        coachId: c.coachId,
        cohortStartDate: c.cohortStartDate,
        durationWeeks: c.durationWeeks,
        durationConfig: c.durationConfig,
        checkInFrequencyDays: c.checkInFrequencyDays,
        memberCount: c._count.memberships,
      }))
      return NextResponse.json(result, { status: 200 })
    }

    // Clients: show challenges they are NOT yet enrolled in
    const enrolledMemberships = await db.cohortMembership.findMany({
      where: { userId: session.user.id },
      select: { cohortId: true },
    })
    const enrolledIds = new Set(enrolledMemberships.map((m) => m.cohortId))

    const available = cohorts
      .filter((c) => !enrolledIds.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        coachId: c.coachId,
        cohortStartDate: c.cohortStartDate,
        durationWeeks: c.durationWeeks,
        durationConfig: c.durationConfig,
        checkInFrequencyDays: c.checkInFrequencyDays,
        memberCount: c._count.memberships,
      }))

    return NextResponse.json(available, { status: 200 })
  } catch (error) {
    console.error("Error fetching challenges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
