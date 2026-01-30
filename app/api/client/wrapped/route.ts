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
    console.log("🎯 Wrapped API called")
    const session = await auth()

    if (!session?.user?.id) {
      console.log("❌ No session")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("✅ Session found:", session.user.email)

    if (!isClient(session.user)) {
      console.log("❌ Not a client")
      return NextResponse.json({ error: "Forbidden: Clients only" }, { status: 403 })
    }

    console.log("✅ User is client")

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

    console.log("📊 Membership found:", membership ? "Yes" : "No")

    if (!membership?.Cohort) {
      return NextResponse.json(
        { error: "No cohort found" },
        { status: 404 }
      )
    }

    const cohort = membership.Cohort

    // Check if cohort is eligible for wrapped
    if (!isWrappedEligible(cohort)) {
      const weeks = cohort.durationWeeks || 6

      if (weeks !== 6 && weeks !== 8) {
        return NextResponse.json(
          { error: "Wrapped only available for 6-week and 8-week challenges" },
          { status: 400 }
        )
      }

      const { endDate } = getCohortDateRange({
        cohortStartDate: cohort.cohortStartDate!,
        durationWeeks: weeks
      })

      return NextResponse.json(
        {
          error: "Cohort not yet completed",
          completionDate: endDate.toISOString()
        },
        { status: 400 }
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
