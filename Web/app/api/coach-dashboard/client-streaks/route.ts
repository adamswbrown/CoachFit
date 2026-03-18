/**
 * GET /api/coach-dashboard/client-streaks
 *
 * Returns streak and compliance data for all clients in the coach's cohorts.
 * Used by the coach dashboard to show at-risk clients.
 */

import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isCoach, isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { calculateStreak } from "@/lib/streak"

export async function GET() {
  const session = await getSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isCoach(session.user) && !isAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Get all clients in coach's cohorts
  const cohorts = await db.cohort.findMany({
    where: { coachId: session.user.id },
    select: {
      id: true,
      name: true,
      memberships: {
        select: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  })

  // Also get clients invited directly (not in cohort)
  const directClients = await db.user.findMany({
    where: { invitedByCoachId: session.user.id },
    select: { id: true, name: true, email: true },
  })

  // Deduplicate clients
  const clientMap = new Map<string, { id: string; name: string | null; email: string; cohortName?: string }>()
  for (const cohort of cohorts) {
    for (const m of cohort.memberships) {
      clientMap.set(m.user.id, { ...m.user, cohortName: cohort.name })
    }
  }
  for (const c of directClients) {
    if (!clientMap.has(c.id)) {
      clientMap.set(c.id, { ...c, cohortName: undefined })
    }
  }

  // Calculate streaks for all clients
  const results = await Promise.all(
    Array.from(clientMap.values()).map(async (client) => {
      const streak = await calculateStreak(client.id)
      return {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        cohortName: client.cohortName,
        ...streak,
        // Compliance status
        status:
          streak.daysSinceLastCheckIn === null
            ? "never"
            : streak.daysSinceLastCheckIn === 0
            ? "green"
            : streak.daysSinceLastCheckIn === 1
            ? "amber"
            : "red",
      }
    })
  )

  // Sort: red first, then amber, then green, then never
  const order = { red: 0, amber: 1, green: 2, never: 3 }
  results.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4))

  return NextResponse.json({ clients: results })
}
