import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"
import { getSystemSetting } from "@/lib/system-settings"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    // Debug logging for auth issues
    console.log("[coach-dashboard/overview] Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userRoles: session?.user?.roles,
    })

    if (!session || !session.user) {
      console.log("[coach-dashboard/overview] No session or user - returning 401")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Allow COACH or ADMIN
    if (!isAdminOrCoach(session.user)) {
      console.log("[coach-dashboard/overview] User not admin or coach - returning 403", session.user.roles)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const isAdminUser = isAdmin(session.user)
    console.log("Coach dashboard overview - starting query for:", isAdminUser ? "admin" : "coach", session.user.id)

    // Admins can see all cohorts, coaches see only their own
    const whereClause = isAdminUser
      ? {}
      : { coachId: session.user.id }

    // Fetch all cohorts with memberships and cohort-specific invites
    // Use the same pattern as /api/cohorts/route.ts which works
    const cohorts = await db.cohort.findMany({
      where: whereClause,
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        invites: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
        customCohortType: {
          select: { id: true, label: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    console.log("Coach dashboard - fetched cohorts:", cohorts.length)

    // Fetch global pending invites (CoachInvite - not tied to a cohort)
    // Admins see all invites, coaches see only their own
    const globalInvitesWhere = isAdminUser
      ? {}
      : { coachId: session.user.id }

    const globalInvites = await db.coachInvite.findMany({
      where: globalInvitesWhere,
      orderBy: {
        createdAt: "desc",
      },
    })

    // Fetch unassigned clients (linked to this coach but not in any cohort)
    // Admins see all unassigned clients, coaches see only those they invited
    const unassignedClientsWhere = isAdminUser
      ? {
          roles: {
            has: Role.CLIENT,
          },
          CohortMembership: {
            none: {},
          },
        }
      : {
          roles: {
            has: Role.CLIENT,
          },
          invitedByCoachId: session.user.id,
          CohortMembership: {
            none: {},
          },
        }

    const unassignedClients = await db.user.findMany({
      where: unassignedClientsWhere,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Aggregate clients across all cohorts
    const clientMap = new Map<
      string,
      {
        id?: string
        name?: string | null
        email: string
        status: "active" | "invited" | "unassigned"
        cohorts: string[]
        cohortFrequencyDays?: number | null
        inviteId?: string
        inviteType?: "global" | "cohort"
        inviteCohortId?: string
        invitedAt?: string
        lastCheckInDate?: string | null
        checkInCount?: number
        adherenceRate?: number
        expectedCheckIns?: number
        checkInWindowDays?: number
        effectiveCheckInFrequencyDays?: number
        weightTrend?: "up" | "down" | "stable" | null
        latestWeight?: number | null
      }
    >()

    // Collect all active client IDs for batch fetching
    const activeClientIds: string[] = []
    for (const cohort of cohorts) {
      for (const membership of cohort.memberships) {
        const email = membership.user.email
        const existing = clientMap.get(email)

        if (existing) {
          // Client already exists, add cohort name
          if (!existing.cohorts.includes(cohort.name)) {
            existing.cohorts.push(cohort.name)
          }
          // If was invited/unassigned, upgrade to active
          if (existing.status !== "active") {
            existing.status = "active"
            existing.id = membership.user.id
            existing.name = membership.user.name
          }
          existing.cohortFrequencyDays = cohort.checkInFrequencyDays ?? existing.cohortFrequencyDays ?? null
        } else {
          // New client entry
          clientMap.set(email, {
            id: membership.user.id,
            name: membership.user.name,
            email: email,
            status: "active",
            cohorts: [cohort.name],
            cohortFrequencyDays: cohort.checkInFrequencyDays ?? null,
          })
        }
        if (membership.user.id) {
          activeClientIds.push(membership.user.id)
        }
      }
    }

    // Batch fetch entry stats for all active clients - OPTIMIZED
    if (activeClientIds.length > 0) {
      // Single optimized query to fetch all needed entries
      const allEntries = await db.entry.findMany({
        where: {
          userId: { in: activeClientIds },
        },
        select: {
          userId: true,
          date: true,
          weightLbs: true,
        },
        orderBy: {
          date: "desc",
        },
      })

      // Process all entries in a single pass
      const entriesByUserId = new Map<string, Array<{ date: Date; weightLbs: number | null }>>()
      
      // Group all entries by user and count week entries
      for (const entry of allEntries) {
        // Group by user for trend calculation
        if (!entriesByUserId.has(entry.userId)) {
          entriesByUserId.set(entry.userId, [])
        }
        entriesByUserId.get(entry.userId)!.push({ date: entry.date, weightLbs: entry.weightLbs })
      }

      const defaultFrequencyDays = await getSystemSetting("defaultCheckInFrequencyDays")
      const userFrequencyRows = await db.user.findMany({
        where: { id: { in: activeClientIds } },
        select: { id: true, checkInFrequencyDays: true },
      })
      const userFrequencyMap = new Map<string, number | null>()
      for (const row of userFrequencyRows) {
        userFrequencyMap.set(row.id, row.checkInFrequencyDays ?? null)
      }

      // Calculate weight trends and latest data for each user
      const previousEntriesMap = new Map<string, number | null>()
      const entriesByUser = new Map<string, { date: Date; weightLbs: number | null }[]>()

      for (const userId of entriesByUserId.keys()) {
        const userEntries = entriesByUserId.get(userId)!
        
        // Entries are already sorted by date desc
        if (userEntries.length > 0) {
          const latestEntry = userEntries[0]
          entriesByUser.set(userId, [latestEntry])

          // Find previous entry for weight trend (entry before latest)
          if (userEntries.length > 1) {
            const previousEntry = userEntries[1]
            if (previousEntry?.weightLbs != null) {
              previousEntriesMap.set(userId, previousEntry.weightLbs)
            }
          }
        }
      }

      // Update client map with stats
      for (const email of clientMap.keys()) {
        const client = clientMap.get(email)!
        if (client.status === "active" && client.id) {
          const lastEntry = entriesByUser.get(client.id)?.[0]
          const cohortFrequency = client.cohortFrequencyDays ?? null
          const userFrequency = userFrequencyMap.get(client.id) ?? null
          const effectiveFrequencyDays = cohortFrequency ?? userFrequency ?? defaultFrequencyDays
          const windowDays = Math.max(7, effectiveFrequencyDays)
          const windowStart = new Date()
          windowStart.setDate(windowStart.getDate() - windowDays)
          const entriesInWindow =
            entriesByUserId.get(client.id)?.filter((entry) => entry.date >= windowStart).length || 0
          const expectedCheckIns = Math.max(1, Math.ceil(windowDays / effectiveFrequencyDays))
          const adherenceRate = expectedCheckIns > 0 ? entriesInWindow / expectedCheckIns : 0

          // Calculate weight trend using previousEntriesMap from batch query
          let weightTrend: "up" | "down" | "stable" | null = null
          if (lastEntry?.weightLbs !== null && lastEntry?.weightLbs !== undefined) {
            const previousWeight = previousEntriesMap.get(client.id)
            if (previousWeight !== null && previousWeight !== undefined) {
              const diff = lastEntry.weightLbs - previousWeight
              if (Math.abs(diff) < 0.5) {
                weightTrend = "stable"
              } else if (diff > 0) {
                weightTrend = "up"
              } else {
                weightTrend = "down"
              }
            }
          }

          client.lastCheckInDate = lastEntry?.date.toISOString().split("T")[0] || null
          client.checkInCount = entriesInWindow
          client.adherenceRate = adherenceRate
          client.expectedCheckIns = expectedCheckIns
          client.checkInWindowDays = windowDays
          client.effectiveCheckInFrequencyDays = effectiveFrequencyDays
          client.weightTrend = weightTrend
          client.latestWeight = lastEntry?.weightLbs || null
        }
      }
    }

    // Process cohort-specific pending invites
    for (const cohort of cohorts) {
      for (const invite of cohort.invites) {
        const email = invite.email
        const existing = clientMap.get(email)

        if (existing) {
          // Client already exists (as active), just add cohort name if not present
          if (!existing.cohorts.includes(cohort.name)) {
            existing.cohorts.push(cohort.name)
          }
        } else {
          // New pending invite entry
          clientMap.set(email, {
            email: email,
            status: "invited",
            cohorts: [cohort.name],
            inviteId: invite.id,
            inviteType: "cohort",
            inviteCohortId: cohort.id,
            invitedAt: invite.createdAt.toISOString(),
          })
        }
      }
    }

    // Process unassigned clients (signed up but not in any cohort)
    for (const client of unassignedClients) {
      const existing = clientMap.get(client.email)
      if (!existing) {
        clientMap.set(client.email, {
          id: client.id,
          name: client.name,
          email: client.email,
          status: "unassigned",
          cohorts: [],
        })
      }
    }

    // Process global invites (not yet signed up, not tied to cohort)
    for (const invite of globalInvites) {
      const existing = clientMap.get(invite.email)
      if (!existing) {
        clientMap.set(invite.email, {
          email: invite.email,
          status: "invited",
          cohorts: [],
          inviteId: invite.id,
          inviteType: "global",
          invitedAt: invite.createdAt.toISOString(),
        })
      } else if (!existing.invitedAt || new Date(invite.createdAt) > new Date(existing.invitedAt)) {
        existing.inviteId = invite.id
        existing.inviteType = "global"
        existing.invitedAt = invite.createdAt.toISOString()
      }
    }

    // Convert map to array and sort cohort names alphabetically for each client
    type ClientMapValue = {
      id?: string
      name?: string | null
      email: string
      status: string
      cohorts: string[]
      inviteId?: string
      inviteType?: "global" | "cohort"
      inviteCohortId?: string
      invitedAt?: string
      lastCheckInDate?: string | null
      checkInCount?: number
      adherenceRate?: number
      expectedCheckIns?: number
      checkInWindowDays?: number
      effectiveCheckInFrequencyDays?: number
      weightTrend?: string | null
      latestWeight?: number | null
    }
    const clients = Array.from(clientMap.values()).map((client: ClientMapValue) => ({
      id: client.id,
      name: client.name ?? undefined,
      email: client.email,
      status: client.status,
      cohorts: [...client.cohorts].sort(),
      inviteId: client.inviteId,
      inviteType: client.inviteType,
      inviteCohortId: client.inviteCohortId,
      invitedAt: client.invitedAt,
      lastCheckInDate: client.lastCheckInDate ?? undefined,
      checkInCount: client.checkInCount,
      adherenceRate: client.adherenceRate,
      expectedCheckIns: client.expectedCheckIns,
      checkInWindowDays: client.checkInWindowDays,
      effectiveCheckInFrequencyDays: client.effectiveCheckInFrequencyDays,
      weightTrend: client.weightTrend ?? undefined,
      latestWeight: client.latestWeight ?? undefined,
    }))

    // Calculate stats
    const totalClients = clients.filter((c: ClientMapValue) => c.status === "active").length
    const pendingInvites = clients.filter((c: ClientMapValue) => c.status === "invited").length
    const unassignedCount = clients.filter((c: ClientMapValue) => c.status === "unassigned").length
    const totalCohorts = cohorts.length

    // Format cohorts with counts
    const cohortsWithCounts = cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      activeClients: cohort.memberships.length,
      pendingInvites: cohort.invites.length,
      createdAt: cohort.createdAt.toISOString(),
      type: cohort.type,
      customTypeLabel: cohort.customTypeLabel,
      customCohortType: cohort.customCohortType,
      checkInFrequencyDays: cohort.checkInFrequencyDays,
      requiresMigration: !cohort.type,
    }))

    return NextResponse.json(
      {
        stats: {
          totalClients,
          pendingInvites,
          unassignedCount,
          totalCohorts,
        },
        clients,
        cohorts: cohortsWithCounts,
        globalInvites: globalInvites.map((i: { id: string; email: string; createdAt: Date }) => ({
          id: i.id,
          email: i.email,
          createdAt: i.createdAt.toISOString(),
        })),
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error fetching coach dashboard overview:", error)
    console.error("Error details:", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: "Internal server error", message: error?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
