/**
 * Cleanup script to remove all HealthKit data from demo users
 * This is useful after importing old test data that had HealthKit workouts/sleep
 * 
 * Usage:
 *   npm run ts scripts/cleanup-healthkit-demo-data.ts
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("\n🗑️  CLEANING UP HEALTHKIT DEMO DATA\n")

  try {
    // Get all test users
    const testUsers = await db.user.findMany({
      where: {
        isTestUser: true,
      },
      select: { id: true, email: true, name: true },
    })

    console.log(`Found ${testUsers.length} test users\n`)

    if (testUsers.length === 0) {
      console.log("No test users found. Nothing to clean up.\n")
      return
    }

    const userIds = testUsers.map(u => u.id)

    // Delete HealthKit data for test users
    console.log("Deleting HealthKit data for test users...")

    const [workoutDeleted, sleepDeleted] = await Promise.all([
      db.workout.deleteMany({
        where: { userId: { in: userIds } },
      }),
      db.sleepRecord.deleteMany({
        where: { userId: { in: userIds } },
      }),
    ])

    console.log(`  ✓ Deleted ${workoutDeleted.count} workouts`)
    console.log(`  ✓ Deleted ${sleepDeleted.count} sleep records`)

    // Update all entries to mark as manual instead of healthkit
    const entriesUpdated = await db.entry.updateMany({
      where: {
        userId: { in: userIds },
        dataSources: { array_contains: 'healthkit' }
      },
      data: {
        dataSources: ['manual']
      }
    })

    console.log(`  ✓ Updated ${entriesUpdated.count} entries from healthkit to manual\n`)

    // Mark pairing codes as unused (in case they had HealthKit synced)
    const pairingCodesReset = await db.pairingCode.updateMany({
      where: { clientId: { in: userIds } },
      data: { usedAt: null },
    })

    console.log(`  ✓ Reset ${pairingCodesReset.count} pairing codes\n`)

    console.log("✨ HealthKit demo data cleaned up!")
    console.log("\nNote: Manual entry data was preserved (only HealthKit data was removed)")
  } catch (error) {
    console.error("❌ Error cleaning up HealthKit data:", error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error("❌ Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
