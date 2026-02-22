import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { isHealthKitEnabled } from "@/lib/system-settings"

// GET /api/client/cohorts - Fetch user's cohorts
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch all cohorts the user is a member of
    const memberships = await db.cohortMembership.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        Cohort: {
          select: {
            id: true,
            name: true,
            cohortStartDate: true,
            type: true,
            customTypeLabel: true,
            customCohortType: {
              select: { id: true, label: true },
            },
            checkInFrequencyDays: true,
          },
        },
      },
    })

    const cohorts = memberships.map((membership) => ({
      id: membership.Cohort.id,
      name: membership.Cohort.name,
      cohortStartDate: membership.Cohort.cohortStartDate,
      type: membership.Cohort.type,
      customTypeLabel: membership.Cohort.customTypeLabel,
      customCohortType: membership.Cohort.customCohortType,
      checkInFrequencyDays: membership.Cohort.checkInFrequencyDays,
    }))

    const healthkitEnabled = await isHealthKitEnabled()

    return NextResponse.json({ cohorts, healthkitEnabled })
  } catch (error) {
    console.error("Error fetching user cohorts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
