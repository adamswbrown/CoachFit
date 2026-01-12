import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  try {
    console.log("🧹 Cleaning up all test data...\n")

  // Get all test user IDs first
  const testUsers = await prisma.user.findMany({
    where: { isTestUser: true },
    select: { id: true },
  })
  const testUserIds = testUsers.map(u => u.id)

  if (testUserIds.length === 0) {
    console.log("No test users found. Nothing to clean up.")
    return
  }

  // Delete in order to respect foreign key constraints
  console.log("Deleting entries...")
  const deletedEntries = await prisma.entry.deleteMany({
    where: {
      userId: { in: testUserIds },
    },
  })
  console.log(`  ✓ Deleted ${deletedEntries.count} entries`)

  console.log("Deleting coach notes...")
  const deletedNotes = await prisma.coachNote.deleteMany({
    where: {
      OR: [
        { coachId: { in: testUserIds } },
        { clientId: { in: testUserIds } },
      ],
    },
  })
  console.log(`  ✓ Deleted ${deletedNotes.count} coach notes`)

  console.log("Deleting cohort memberships...")
  const deletedMemberships = await prisma.cohortMembership.deleteMany({
    where: {
      userId: { in: testUserIds },
    },
  })
  console.log(`  ✓ Deleted ${deletedMemberships.count} cohort memberships`)

  // Get all test cohort IDs
  const testCohorts = await prisma.cohort.findMany({
    where: {
      coachId: { in: testUserIds },
    },
    select: { id: true },
  })
  const testCohortIds = testCohorts.map(c => c.id)

  console.log("Deleting cohort invites...")
  const deletedCohortInvites = await prisma.cohortInvite.deleteMany({
    where: {
      cohortId: { in: testCohortIds },
    },
  })
  console.log(`  ✓ Deleted ${deletedCohortInvites.count} cohort invites`)

  console.log("Deleting coach invites...")
  const deletedCoachInvites = await prisma.coachInvite.deleteMany({
    where: {
      coachId: { in: testUserIds },
    },
  })
  console.log(`  ✓ Deleted ${deletedCoachInvites.count} coach invites`)

  console.log("Deleting cohorts...")
  const deletedCohorts = await prisma.cohort.deleteMany({
    where: {
      coachId: { in: testUserIds },
    },
  })
  console.log(`  ✓ Deleted ${deletedCohorts.count} cohorts`)

  console.log("Deleting accounts (OAuth)...")
  const deletedAccounts = await prisma.account.deleteMany({
    where: {
      userId: { in: testUserIds },
    },
  })
  console.log(`  ✓ Deleted ${deletedAccounts.count} accounts`)

  console.log("Deleting sessions...")
  const deletedSessions = await prisma.session.deleteMany({
    where: {
      userId: { in: testUserIds },
    },
  })
  console.log(`  ✓ Deleted ${deletedSessions.count} sessions`)

  console.log("Deleting admin actions...")
  const deletedAdminActions = await prisma.adminAction.deleteMany({
    where: {
      adminId: { in: testUserIds },
    },
  })
  console.log(`  ✓ Deleted ${deletedAdminActions.count} admin actions`)

  console.log("Deleting test users...")
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      isTestUser: true,
    },
  })
  console.log(`  ✓ Deleted ${deletedUsers.count} test users`)

    console.log("\n✅ Test data cleanup complete!")
    console.log(`   Total users deleted: ${deletedUsers.count}`)
    console.log(`   Total entries deleted: ${deletedEntries.count}`)
    console.log(`   Total cohorts deleted: ${deletedCohorts.count}`)
  } catch (error) {
    console.error("Error during cleanup:", error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error("❌ Error cleaning up test data:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
