import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!session.user.roles.includes(Role.COACH)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const coachId = session.user.id

    // Query 1: clients in cohorts owned by this coach
    const cohortClients = await db.cohortMembership.findMany({
      where: {
        Cohort: { coachId },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        Cohort: {
          select: { name: true },
        },
      },
    })

    // Query 2: clients invited by this coach (may not be in a cohort)
    const invitedClients = await db.user.findMany({
      where: {
        invitedByCoachId: coachId,
        roles: { has: Role.CLIENT },
      },
      select: {
        id: true,
        name: true,
        email: true,
        CohortMembership: {
          include: {
            Cohort: { select: { name: true } },
          },
        },
      },
    })

    // Merge and deduplicate
    const memberMap = new Map<string, {
      id: string
      name: string | null
      email: string
      cohortName: string | null
      lastEntryDate: string | null
      creditBalance: number
      daysSinceLastNote: number | null
    }>()

    for (const cm of cohortClients) {
      if (!memberMap.has(cm.user.id)) {
        memberMap.set(cm.user.id, {
          id: cm.user.id,
          name: cm.user.name,
          email: cm.user.email,
          cohortName: cm.Cohort.name,
          lastEntryDate: null,
          creditBalance: 0,
          daysSinceLastNote: null,
        })
      }
    }

    for (const client of invitedClients) {
      if (!memberMap.has(client.id)) {
        const cohortName = client.CohortMembership?.[0]?.Cohort?.name ?? null
        memberMap.set(client.id, {
          id: client.id,
          name: client.name,
          email: client.email,
          cohortName,
          lastEntryDate: null,
          creditBalance: 0,
          daysSinceLastNote: null,
        })
      }
    }

    const memberIds = Array.from(memberMap.keys())

    if (memberIds.length > 0) {
      // Batch fetch latest entries
      const latestEntries = await db.entry.findMany({
        where: { userId: { in: memberIds } },
        orderBy: { date: "desc" },
        distinct: ["userId"],
        select: { userId: true, date: true },
      })

      for (const entry of latestEntries) {
        const member = memberMap.get(entry.userId)
        if (member) {
          member.lastEntryDate = entry.date.toISOString().split("T")[0]
        }
      }

      // Batch fetch credit balances
      const creditAccounts = await db.clientCreditAccount.findMany({
        where: { clientId: { in: memberIds } },
        select: { clientId: true, balance: true },
      })

      for (const account of creditAccounts) {
        const member = memberMap.get(account.clientId)
        if (member) {
          member.creditBalance = account.balance
        }
      }

      // Batch fetch latest coach notes
      const latestNotes = await db.coachNote.findMany({
        where: {
          coachId,
          clientId: { in: memberIds },
        },
        orderBy: { noteDate: "desc" },
        distinct: ["clientId"],
        select: { clientId: true, noteDate: true },
      })

      const now = new Date()
      for (const note of latestNotes) {
        const member = memberMap.get(note.clientId)
        if (member) {
          const diffMs = now.getTime() - new Date(note.noteDate).getTime()
          member.daysSinceLastNote = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        }
      }
    }

    const members = Array.from(memberMap.values())

    return NextResponse.json({ members })
  } catch (error) {
    console.error("Error fetching my members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
