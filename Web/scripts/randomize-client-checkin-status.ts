import { db } from "../lib/db"
import { Role } from "../lib/types"

/**
 * Randomize check-in status across all clients to create realistic test data
 * Distribution:
 * - 35% Active (checked in today or yesterday, 6-7 entries/week)
 * - 25% Good (checked in 2-3 days ago, 4-5 entries/week)
 * - 20% Moderate (checked in 4-5 days ago, 2-3 entries/week)
 * - 15% Needs Attention (checked in 6-10 days ago, 0-1 entries/week)
 * - 5% Offline (no check-ins in 10+ days)
 */

const DAYS_IN_PAST = 14 // Generate 2 weeks of data

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
    perceivedStress: Math.ceil(Math.random() * 10),
  }
}

// Create entries for a client based on their pattern
async function createEntriesForClient(userId: string, pattern: string) {
  const entries = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

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

async function main() {
  console.log("🔄 Randomizing client check-in status...")

  // Get all clients
  const clients = await db.user.findMany({
    where: { roles: { has: Role.CLIENT } },
  })

  console.log(`Found ${clients.length} clients`)

  // Shuffle clients
  const shuffled = clients.sort(() => Math.random() - 0.5)

  // Calculate distribution
  const activeCount = Math.floor(shuffled.length * 0.35)
  const goodCount = Math.floor(shuffled.length * 0.25)
  const moderateCount = Math.floor(shuffled.length * 0.2)
  const needsAttentionCount = Math.floor(shuffled.length * 0.15)
  const offlineCount = shuffled.length - activeCount - goodCount - moderateCount - needsAttentionCount

  console.log("\n📊 Distribution:")
  console.log(`  Active (6-7 days/week):       ${activeCount} clients`)
  console.log(`  Good (4-5 days/week):         ${goodCount} clients`)
  console.log(`  Moderate (2-3 days/week):     ${moderateCount} clients`)
  console.log(`  Needs Attention (0-1/week):   ${needsAttentionCount} clients`)
  console.log(`  Offline (10+ days):           ${offlineCount} clients`)

  let index = 0

  // Active clients
  console.log("\n✅ Creating entries for Active clients...")
  for (let i = 0; i < activeCount; i++) {
    await createEntriesForClient(shuffled[index].id, "active")
    index++
  }

  // Good clients
  console.log("👍 Creating entries for Good clients...")
  for (let i = 0; i < goodCount; i++) {
    await createEntriesForClient(shuffled[index].id, "good")
    index++
  }

  // Moderate clients
  console.log("⚠️  Creating entries for Moderate clients...")
  for (let i = 0; i < moderateCount; i++) {
    await createEntriesForClient(shuffled[index].id, "moderate")
    index++
  }

  // Needs Attention clients
  console.log("🔴 Creating entries for Needs Attention clients...")
  for (let i = 0; i < needsAttentionCount; i++) {
    await createEntriesForClient(shuffled[index].id, "needs-attention")
    index++
  }

  // Offline clients
  console.log("💀 Creating entries for Offline clients...")
  for (let i = 0; i < offlineCount; i++) {
    await createEntriesForClient(shuffled[index].id, "offline")
    index++
  }

  console.log("\n✅ Done! Check-in statuses randomized across all clients.")
  console.log("   The Weekly Review page should now show a realistic distribution.")

  await db.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
