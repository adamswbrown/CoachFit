/**
 * Debug Wrapped Feature
 * Check test cohort and wrapped eligibility
 */

import { PrismaClient } from "@prisma/client"
import { isWrappedEligible, getCohortDateRange } from "../lib/wrapped-calculator"

const db = new PrismaClient()

async function main() {
  console.log("🔍 Debugging Fitness Wrapped Feature\n")

  // Find test client
  const client = await db.user.findUnique({
    where: { email: "wrapped@test.local" }
  })

  if (!client) {
    console.log("❌ Test client not found")
    return
  }

  console.log("✅ Test client found:", client.email)
  console.log("   User ID:", client.id)
  console.log()

  // Find membership
  const membership = await db.cohortMembership.findFirst({
    where: { userId: client.id },
    include: {
      Cohort: true
    }
  })

  if (!membership) {
    console.log("❌ No cohort membership found")
    return
  }

  console.log("✅ Cohort membership found")
  console.log("   Cohort ID:", membership.cohortId)
  console.log()

  const cohort = membership.Cohort
  console.log("📊 Cohort Details:")
  console.log("   Name:", cohort.name)
  console.log("   Type:", cohort.type)
  console.log("   Start Date:", cohort.cohortStartDate)
  console.log("   Duration:", cohort.durationWeeks, "weeks")
  console.log()

  // Check eligibility
  const eligible = isWrappedEligible(cohort)
  console.log("🎯 Wrapped Eligibility Check:")
  console.log("   Eligible:", eligible)
  console.log()

  if (cohort.cohortStartDate) {
    const { startDate, endDate } = getCohortDateRange({
      cohortStartDate: cohort.cohortStartDate,
      durationWeeks: cohort.durationWeeks || 6
    })
    console.log("📅 Date Range:")
    console.log("   Start:", startDate.toLocaleDateString())
    console.log("   End:", endDate.toLocaleDateString())
    console.log("   Today:", new Date().toLocaleDateString())
    console.log("   Challenge Complete:", new Date() >= endDate)
    console.log()
  }

  // Count entries
  const entryCount = await db.entry.count({
    where: { userId: client.id }
  })

  const workoutCount = await db.workout.count({
    where: { userId: client.id }
  })

  const sleepCount = await db.sleepRecord.count({
    where: { userId: client.id }
  })

  console.log("📈 Data Summary:")
  console.log("   Entries:", entryCount)
  console.log("   Workouts:", workoutCount)
  console.log("   Sleep Records:", sleepCount)
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
