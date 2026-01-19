import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"

// Helper to get random date in range
function randomDateInRange(daysAgo: number, variance: number = 0): Date {
  const baseDate = new Date()
  const actualDaysAgo = daysAgo + Math.floor(Math.random() * (variance + 1))
  baseDate.setDate(baseDate.getDate() - actualDaysAgo)
  baseDate.setHours(0, 0, 0, 0)
  return baseDate
}

// Helper to generate realistic entry data
function generateEntryData() {
  return {
    weightLbs: 150 + Math.random() * 50,
    steps: Math.floor(5000 + Math.random() * 10000),
    calories: Math.floor(1800 + Math.random() * 800),
    sleepQuality: Math.ceil(Math.random() * 10),
    perceivedEffort: Math.ceil(Math.random() * 10),
  }
}

// Create entries for a client based on their pattern
async function createEntriesForClient(userId: string, pattern: string) {
  const entries = []

  switch (pattern) {
    case "active": {
      // 6-7 days per week, including today or yesterday
      const numEntries = 12 + Math.floor(Math.random() * 3) // 12-14 entries in 2 weeks
      for (let i = 0; i < numEntries; i++) {
        const date = randomDateInRange(i, 1)
        entries.push({ userId, date, ...generateEntryData() })
      }
      break
    }
    case "good": {
      // 4-5 days per week, last check-in 2-3 days ago
      const numEntries = 8 + Math.floor(Math.random() * 3) // 8-10 entries in 2 weeks
      for (let i = 2; i < 2 + numEntries; i++) {
        const date = randomDateInRange(i, 2)
        entries.push({ userId, date, ...generateEntryData() })
      }
      break
    }
    case "moderate": {
      // 2-3 days per week, last check-in 4-5 days ago
      const numEntries = 4 + Math.floor(Math.random() * 3) // 4-6 entries in 2 weeks
      for (let i = 4; i < 4 + numEntries; i++) {
        const date = randomDateInRange(i, 3)
        entries.push({ userId, date, ...generateEntryData() })
      }
      break
    }
    case "needs-attention": {
      // 0-1 days per week, last check-in 6-10 days ago
      const numEntries = Math.floor(Math.random() * 3) // 0-2 entries in 2 weeks
      for (let i = 6; i < 6 + numEntries; i++) {
        const date = randomDateInRange(i, 4)
        entries.push({ userId, date, ...generateEntryData() })
      }
      break
    }
    case "offline": {
      // No entries in past 10+ days
      const numEntries = Math.floor(Math.random() * 2) // 0-1 entries 10-14 days ago
      for (let i = 10; i < 10 + numEntries; i++) {
        const date = randomDateInRange(i, 3)
        entries.push({ userId, date, ...generateEntryData() })
      }
      break
    }
  }

  // Upsert all entries
  for (const entry of entries) {
    await db.entry.upsert({
      where: { userId_date: { userId: entry.userId, date: entry.date } },
      update: entry,
      create: entry,
    })
  }
}

/**
 * POST /api/admin/randomize-checkins
 * Randomize client check-in status for realistic test data
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all clients
    const clients = await db.user.findMany({
      where: { roles: { has: Role.CLIENT } },
    })

    // Shuffle clients
    const shuffled = clients.sort(() => Math.random() - 0.5)

    // Calculate distribution
    const activeCount = Math.floor(shuffled.length * 0.35)
    const goodCount = Math.floor(shuffled.length * 0.25)
    const moderateCount = Math.floor(shuffled.length * 0.2)
    const needsAttentionCount = Math.floor(shuffled.length * 0.15)
    const offlineCount = shuffled.length - activeCount - goodCount - moderateCount - needsAttentionCount

    const distribution = {
      active: activeCount,
      good: goodCount,
      moderate: moderateCount,
      needsAttention: needsAttentionCount,
      offline: offlineCount,
    }

    let index = 0

    // Active clients
    for (let i = 0; i < activeCount; i++) {
      await createEntriesForClient(shuffled[index].id, "active")
      index++
    }

    // Good clients
    for (let i = 0; i < goodCount; i++) {
      await createEntriesForClient(shuffled[index].id, "good")
      index++
    }

    // Moderate clients
    for (let i = 0; i < moderateCount; i++) {
      await createEntriesForClient(shuffled[index].id, "moderate")
      index++
    }

    // Needs Attention clients
    for (let i = 0; i < needsAttentionCount; i++) {
      await createEntriesForClient(shuffled[index].id, "needs-attention")
      index++
    }

    // Offline clients
    for (let i = 0; i < offlineCount; i++) {
      await createEntriesForClient(shuffled[index].id, "offline")
      index++
    }

    return NextResponse.json({
      success: true,
      totalClients: clients.length,
      distribution,
      message: "Check-in statuses randomized successfully",
    })
  } catch (error) {
    console.error("Error randomizing check-ins:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
