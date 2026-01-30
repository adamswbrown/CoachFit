import { PrismaClient, Role } from "@prisma/client"

const prisma = new PrismaClient()

// Production administrators to preserve (by email)
// Only these specific users will be kept - all others will be removed
const PRODUCTION_ADMIN_EMAILS = [
  "adamswbrown@gmail.com",
  "coachgav@gcgyms.com",
  "victoria.denstedt@gmail.com",
]

async function main() {
  console.log("=".repeat(60))
  console.log("  PRODUCTION CLEANUP SCRIPT")
  console.log("  Removes all test users and data, preserves administrators")
  console.log("=".repeat(60))
  console.log("")

  // Step 1: Identify administrators to keep (by specific email addresses)
  console.log("Step 1: Identifying administrators to preserve...")
  const admins = await prisma.user.findMany({
    where: {
      email: { in: PRODUCTION_ADMIN_EMAILS },
    },
    select: { id: true, email: true, name: true, roles: true, isTestUser: true },
  })

  if (admins.length === 0) {
    console.log("  WARNING: No administrators found in the system!")
    console.log("  Expected emails:", PRODUCTION_ADMIN_EMAILS.join(", "))
    console.log("  Aborting to prevent accidental deletion of all users.")
    console.log("  Please create the admin users first.")
    process.exit(1)
  }

  if (admins.length < PRODUCTION_ADMIN_EMAILS.length) {
    const foundEmails = admins.map((a) => a.email)
    const missingEmails = PRODUCTION_ADMIN_EMAILS.filter((e) => !foundEmails.includes(e))
    console.log("  WARNING: Some expected admins not found:")
    missingEmails.forEach((e) => console.log(`    - ${e} (MISSING)`))
  }

  console.log(`  Found ${admins.length} administrator(s) to preserve:`)
  admins.forEach((admin) => {
    console.log(`    - ${admin.email} (${admin.name || "No name"}) [${admin.roles.join(", ")}]`)
  })

  const adminIds = admins.map((a) => a.id)

  // Step 2: Count users to be removed
  const usersToRemove = await prisma.user.count({
    where: { id: { notIn: adminIds } },
  })
  console.log(`\nStep 2: Found ${usersToRemove} non-admin user(s) to remove`)

  if (usersToRemove === 0) {
    console.log("  No non-admin users to remove.")
  }

  // Step 3: Get IDs of users to remove for cleaning related data
  const nonAdminUsers = await prisma.user.findMany({
    where: { id: { notIn: adminIds } },
    select: { id: true },
  })
  const nonAdminIds = nonAdminUsers.map((u) => u.id)

  // Step 4: Clean up related data in proper order (respecting foreign keys)
  console.log("\nStep 3: Cleaning up related data...")

  // Weekly questionnaire responses
  const deletedQuestionnaireResponses = await prisma.weeklyQuestionnaireResponse.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedQuestionnaireResponses.count} weekly questionnaire responses`)

  // Weekly coach responses
  const deletedWeeklyCoachResponses = await prisma.weeklyCoachResponse.deleteMany({
    where: {
      OR: [{ coachId: { in: nonAdminIds } }, { clientId: { in: nonAdminIds } }],
    },
  })
  console.log(`  - Deleted ${deletedWeeklyCoachResponses.count} weekly coach responses`)

  // Entries
  const deletedEntries = await prisma.entry.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedEntries.count} entries`)

  // Workouts
  const deletedWorkouts = await prisma.workout.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedWorkouts.count} workouts`)

  // Sleep records
  const deletedSleepRecords = await prisma.sleepRecord.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedSleepRecords.count} sleep records`)

  // Coach notes
  const deletedNotes = await prisma.coachNote.deleteMany({
    where: {
      OR: [{ coachId: { in: nonAdminIds } }, { clientId: { in: nonAdminIds } }],
    },
  })
  console.log(`  - Deleted ${deletedNotes.count} coach notes`)

  // Cohort memberships
  const deletedMemberships = await prisma.cohortMembership.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedMemberships.count} cohort memberships`)

  // Coach-cohort memberships
  const deletedCoachCohortMemberships = await prisma.coachCohortMembership.deleteMany({
    where: { coachId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedCoachCohortMemberships.count} coach-cohort memberships`)

  // Get cohorts owned by non-admin users
  const nonAdminCohorts = await prisma.cohort.findMany({
    where: { coachId: { in: nonAdminIds } },
    select: { id: true },
  })
  const nonAdminCohortIds = nonAdminCohorts.map((c) => c.id)

  // Questionnaire bundles for non-admin cohorts
  const deletedBundles = await prisma.questionnaireBundle.deleteMany({
    where: { cohortId: { in: nonAdminCohortIds } },
  })
  console.log(`  - Deleted ${deletedBundles.count} questionnaire bundles`)

  // Cohort check-in configs
  const deletedCheckInConfigs = await prisma.cohortCheckInConfig.deleteMany({
    where: { cohortId: { in: nonAdminCohortIds } },
  })
  console.log(`  - Deleted ${deletedCheckInConfigs.count} cohort check-in configs`)

  // Cohort invites for non-admin cohorts
  const deletedCohortInvites = await prisma.cohortInvite.deleteMany({
    where: { cohortId: { in: nonAdminCohortIds } },
  })
  console.log(`  - Deleted ${deletedCohortInvites.count} cohort invites`)

  // Coach invites
  const deletedCoachInvites = await prisma.coachInvite.deleteMany({
    where: { coachId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedCoachInvites.count} coach invites`)

  // Pairing codes
  const deletedPairingCodes = await prisma.pairingCode.deleteMany({
    where: {
      OR: [{ coachId: { in: nonAdminIds } }, { clientId: { in: nonAdminIds } }],
    },
  })
  console.log(`  - Deleted ${deletedPairingCodes.count} pairing codes`)

  // User goals
  const deletedGoals = await prisma.userGoals.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedGoals.count} user goals`)

  // User preferences
  const deletedPreferences = await prisma.userPreference.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedPreferences.count} user preferences`)

  // User consents
  const deletedConsents = await prisma.userConsent.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedConsents.count} user consents`)

  // OAuth accounts
  const deletedAccounts = await prisma.account.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedAccounts.count} OAuth accounts`)

  // Sessions
  const deletedSessions = await prisma.session.deleteMany({
    where: { userId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedSessions.count} sessions`)

  // Admin actions (by non-admin users - shouldn't exist but clean anyway)
  const deletedAdminActions = await prisma.adminAction.deleteMany({
    where: { adminId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedAdminActions.count} admin actions`)

  // Custom cohort types created by non-admins (only if no cohorts reference them)
  // Note: This uses onDelete: Restrict, so we need to be careful
  const customTypesToDelete = await prisma.customCohortType.findMany({
    where: {
      createdBy: { in: nonAdminIds },
      Cohort: { none: {} }, // Only delete if no cohorts reference them
    },
  })
  if (customTypesToDelete.length > 0) {
    const deletedCustomTypes = await prisma.customCohortType.deleteMany({
      where: { id: { in: customTypesToDelete.map((ct) => ct.id) } },
    })
    console.log(`  - Deleted ${deletedCustomTypes.count} custom cohort types`)
  }

  // Cohorts owned by non-admin users
  const deletedCohorts = await prisma.cohort.deleteMany({
    where: { coachId: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedCohorts.count} cohorts`)

  // Step 5: Delete non-admin users
  console.log("\nStep 4: Removing non-admin users...")
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { in: nonAdminIds } },
  })
  console.log(`  - Deleted ${deletedUsers.count} users`)

  // Step 6: Clean up system tables
  console.log("\nStep 5: Cleaning up system tables...")

  // AdminInsight - clear all insights (they reference users that may no longer exist)
  const deletedInsights = await prisma.adminInsight.deleteMany({})
  console.log(`  - Deleted ${deletedInsights.count} admin insights`)

  // AttentionScore - clear all scores
  const deletedScores = await prisma.attentionScore.deleteMany({})
  console.log(`  - Deleted ${deletedScores.count} attention scores`)

  // VerificationToken - clear any pending tokens
  const deletedTokens = await prisma.verificationToken.deleteMany({})
  console.log(`  - Deleted ${deletedTokens.count} verification tokens`)

  // Step 7: Update administrators for production
  console.log("\nStep 6: Preparing administrators for production...")
  const updatedAdmins = await prisma.user.updateMany({
    where: { id: { in: adminIds } },
    data: {
      isTestUser: false, // Mark as real users (enables email sending)
    },
  })
  console.log(`  - Updated ${updatedAdmins.count} admin(s) with isTestUser=false`)

  // Final summary
  console.log("\n" + "=".repeat(60))
  console.log("  CLEANUP COMPLETE")
  console.log("=".repeat(60))
  console.log("")
  console.log("Summary:")
  console.log(`  - Users removed: ${deletedUsers.count}`)
  console.log(`  - Entries removed: ${deletedEntries.count}`)
  console.log(`  - Cohorts removed: ${deletedCohorts.count}`)
  console.log(`  - Administrators preserved: ${admins.length}`)
  console.log("")
  console.log("Preserved administrators:")
  admins.forEach((admin) => {
    console.log(`  - ${admin.email}`)
  })
  console.log("")
  console.log("The platform is now ready for production use.")
  console.log("")
  console.log("Next steps:")
  console.log("  1. Verify admin accounts can log in")
  console.log("  2. Set strong passwords: npm run password:set <email> <password>")
  console.log("  3. Configure environment variables for production")
  console.log("  4. Review SystemSettings in the admin panel")
  console.log("")
}

main()
  .catch((e) => {
    console.error("ERROR during cleanup:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
