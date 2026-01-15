import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GDPR Data Export Endpoint
 * Returns all user data in JSON format
 * Must respond within 30 days per GDPR requirements
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all user data with basic includes only
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        Account: true,
        Entry: true,
        Workouts: true,
        SleepRecords: true,
        CohortMembership: true,
        CoachNotes: true,
        ClientPairingCodes: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Build GDPR-compliant export data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        createdAt: user.createdAt,
      },
      accounts: user.Account || [],
      entries: user.Entry || [],
      workouts: user.Workouts || [],
      sleepRecords: user.SleepRecords || [],
      cohortMemberships: user.CohortMembership || [],
      coachNotes: user.CoachNotes || [],
      pairingCodes: user.ClientPairingCodes || [],
    }

    // Return as JSON
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="coachfit-data-export-${user.id}-${Date.now()}.json"`,
      },
    })
  } catch (error) {
    console.error("Error exporting user data:", error)
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    )
  }
}
