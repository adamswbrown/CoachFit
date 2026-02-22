import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { calculateWrappedStats, getCohortDateRange, isWrappedEligible } from "@/lib/wrapped-calculator"

/**
 * GET /api/client/wrapped
 * Fetch Fitness Wrapped data for authenticated client
 *
 * Returns wrapped statistics if:
 * - User is authenticated as CLIENT
 * - User is in a cohort
 * - Cohort is a 6-week or 8-week challenge
 * - Cohort has completed (end date has passed)
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden: Clients only" }, { status: 403 })
    }

    // Find user's cohort
    const membership = await db.cohortMembership.findUnique({
      where: { userId: session.user.id },
      include: {
        Cohort: {
          select: {
            id: true,
            name: true,
            cohortStartDate: true,
            durationWeeks: true
          }
        }
      }
    })

    if (!membership?.Cohort) {
      return NextResponse.json(
        {
          available: false,
          reason: "NO_COHORT",
          message: "Join a cohort to unlock Fitness Wrapped.",
        },
        { status: 200 }
      )
    }

    const cohort = membership.Cohort

    // Check if cohort is eligible for wrapped
    if (!isWrappedEligible(cohort)) {
      const weeks = cohort.durationWeeks || 6

      if (weeks !== 6 && weeks !== 8) {
        return NextResponse.json(
          {
            available: false,
            reason: "UNSUPPORTED_DURATION",
            message: "Fitness Wrapped is available for 6-week and 8-week challenges only.",
          },
          { status: 200 }
        )
      }

      const { endDate } = getCohortDateRange({
        cohortStartDate: cohort.cohortStartDate!,
        durationWeeks: weeks
      })

      return NextResponse.json(
        {
          available: false,
          reason: "COHORT_IN_PROGRESS",
          message: "Fitness Wrapped unlocks when your cohort is complete.",
          completionDate: endDate.toISOString()
        },
        { status: 200 }
      )
    }

    // Calculate wrapped stats
    const { startDate, endDate } = getCohortDateRange({
      cohortStartDate: cohort.cohortStartDate!,
      durationWeeks: cohort.durationWeeks || 6
    })

    const wrappedStats = await calculateWrappedStats(
      session.user.id,
      startDate,
      endDate
    )

    return NextResponse.json({
      available: true,
      cohortName: cohort.name,
      ...wrappedStats
    })

  } catch (error) {
    console.error("Error fetching wrapped stats:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
