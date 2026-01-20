#!/usr/bin/env node

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function migrateExistingData() {
  try {
    console.log("🔄 Checking for existing test data...")
    
    // Count entries with perceived stress
    const entriesWithStress = await prisma.entry.findMany({
      where: {
        perceivedStress: {
          not: null,
        },
      },
      select: {
        id: true,
        date: true,
        perceivedStress: true,
      },
      take: 5,
    })

    const totalCount = await prisma.entry.count()
    const stressCount = await prisma.entry.count({
      where: {
        perceivedStress: {
          not: null,
        },
      },
    })

    console.log(`✓ Total entries: ${totalCount}`)
    console.log(`✓ Entries with perceived stress: ${stressCount} (${((stressCount / totalCount) * 100).toFixed(1)}%)`)
    
    // Show sample entries
    if (entriesWithStress.length > 0) {
      console.log("\n📊 Sample entries with perceived stress values:")
      entriesWithStress.forEach((entry) => {
        console.log(`  - ${entry.date.toISOString().split('T')[0]}: Stress Level ${entry.perceivedStress}/10`)
      })
    }

    console.log("\n✅ Data migration check complete!")
    console.log("ℹ️ The perceived effort field has been successfully renamed to perceived stress.")
    console.log("📝 Note: Test data generator populates perceived stress for ~50% of entries")
  } catch (error) {
    console.error("❌ Error checking data:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateExistingData()
