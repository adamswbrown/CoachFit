import { execSync } from "child_process"
import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "../lib/legal-content"

const db = new PrismaClient()
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "adamswbrown@gmail.com"
const DEFAULT_PASSWORD = process.env.TEST_DEFAULT_PASSWORD || "TestPassword123!"
const MODE = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] || "full"

const COACHES = [
  { name: "Alex Thompson", email: "alex.thompson@test.local" },
  { name: "Jordan Martinez", email: "jordan.martinez@test.local" },
  { name: "Taylor Chen", email: "taylor.chen@test.local" },
  { name: "Casey Williams", email: "casey.williams@test.local" },
  { name: "Morgan Davis", email: "morgan.davis@test.local" },
]

const ADMIN_COACH_EMAILS = new Set([
  "alex.thompson@test.local",
  "jordan.martinez@test.local",
  "taylor.chen@test.local",
])

const DEFAULT_SYSTEM_SETTINGS = {
  maxClientsPerCoach: 50,
  minClientsPerCoach: 10,
  recentActivityDays: 14,
  lowEngagementEntries: 7,
  noActivityDays: 14,
  criticalNoActivityDays: 30,
  shortTermWindowDays: 7,
  longTermWindowDays: 30,
  adminOverrideEmail: ADMIN_EMAIL,
  healthkitEnabled: true,
  iosIntegrationEnabled: true,
  adherenceGreenMinimum: 6,
  adherenceAmberMinimum: 3,
  bodyFatLowPercent: 12.5,
  bodyFatMediumPercent: 20.0,
  bodyFatHighPercent: 30.0,
  bodyFatVeryHighPercent: 37.5,
  minDailyCalories: 1000,
  maxDailyCalories: 5000,
  minProteinPerLb: 0.4,
  maxProteinPerLb: 2.0,
  defaultCarbsPercent: 40,
  defaultProteinPercent: 30,
  defaultFatPercent: 30,
  stepsNotMuch: 5000,
  stepsLight: 7500,
  stepsModerate: 10000,
  stepsHeavy: 12500,
  workoutNotMuch: 75,
  workoutLight: 150,
  workoutModerate: 225,
  workoutHeavy: 300,
  showPersonalizedPlan: true,
  termsContentHtml: DEFAULT_TERMS_HTML,
  privacyContentHtml: DEFAULT_PRIVACY_HTML,
  dataProcessingContentHtml: DEFAULT_DATA_PROCESSING_HTML,
}

const run = (command: string) => {
  execSync(command, { stdio: "inherit" })
}

const runOptional = (label: string, command: string) => {
  try {
    run(command)
  } catch (error) {
    console.warn(`⚠️  Skipping ${label} due to error. Check your configuration.`)
  }
}

async function ensureSystemSettings() {
  const existing = await db.systemSettings.findFirst()
  if (existing) {
    await db.systemSettings.update({
      where: { id: existing.id },
      data: DEFAULT_SYSTEM_SETTINGS,
    })
  } else {
    await db.systemSettings.create({ data: DEFAULT_SYSTEM_SETTINGS })
  }
}

async function resetDatabase() {
  await db.adminAction.deleteMany({})
  await db.coachNote.deleteMany({})
  await db.entry.deleteMany({})
  await db.weeklyQuestionnaireResponse.deleteMany({})
  await db.questionnaireBundle.deleteMany({})
  await db.pairingCode.deleteMany({})
  await db.sleepRecord.deleteMany({})
  await db.workout.deleteMany({})
  await db.coachCohortMembership.deleteMany({})
  await db.cohortMembership.deleteMany({})
  await db.cohortInvite.deleteMany({})
  await db.cohortCheckInConfig.deleteMany({})
  await db.cohort.deleteMany({})
  await db.coachInvite.deleteMany({})
  await db.user.deleteMany({ where: { email: { not: ADMIN_EMAIL } } })
}

async function seedAdminAndCoaches() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Adam Brown",
      roles: [Role.ADMIN, Role.COACH],
      isTestUser: true,
      passwordHash,
      onboardingComplete: true,
    },
    create: {
      id: randomUUID(),
      email: ADMIN_EMAIL,
      name: "Adam Brown",
      roles: [Role.ADMIN, Role.COACH],
      isTestUser: true,
      passwordHash,
      onboardingComplete: true,
    },
  })

  for (const coach of COACHES) {
    const roles = ADMIN_COACH_EMAILS.has(coach.email)
      ? [Role.COACH, Role.ADMIN]
      : [Role.COACH]

    await db.user.upsert({
      where: { email: coach.email },
      update: {
        name: coach.name,
        roles,
        isTestUser: true,
        passwordHash,
        onboardingComplete: true,
      },
      create: {
        id: randomUUID(),
        email: coach.email,
        name: coach.name,
        roles,
        isTestUser: true,
        passwordHash,
        onboardingComplete: true,
      },
    })
  }
}

async function main() {
  console.log("\n════════════════════════════════════════════════════════════════")
  console.log("🧪 COACHFIT TEST ENVIRONMENT SETUP")
  console.log("════════════════════════════════════════════════════════════════\n")

  if (MODE === "minimal") {
    console.log("Mode: minimal (admins + coaches only)")

    console.log("1) Reset database")
    await resetDatabase()

    console.log("\n2) Seed admin + coaches")
    await seedAdminAndCoaches()

    console.log("\n3) Seed email templates (database)")
    run("npx tsx scripts/seed-email-templates.ts")

    console.log("\n4) Ensure weekly questionnaire reminder template")
    run("npx tsx scripts/setup-questionnaire-email-template.ts")

    if (process.env.RESEND_API_KEY) {
      console.log("\n5) Configure Resend templates (external)")
      runOptional("Resend template setup", "npx tsx scripts/setup-email-templates.ts")
    } else {
      console.log("\n5) Skipping Resend template setup (RESEND_API_KEY not set)")
    }

    console.log("\n6) Ensure system settings defaults")
    await ensureSystemSettings()
  } else {
    console.log("Mode: full (comprehensive dataset)")

    console.log("1) Reset + seed comprehensive multi-coach dataset")
    run("npx tsx scripts/reset-and-seed-comprehensive-multi-coach.ts")

    console.log("\n2) Seed email templates (database)")
    run("npx tsx scripts/seed-email-templates.ts")

    console.log("\n3) Seed questionnaire templates (template cohorts)")
    run("npx tsx scripts/seed-questionnaire-templates.ts")

    console.log("\n4) Ensure weekly questionnaire reminder template")
    run("npx tsx scripts/setup-questionnaire-email-template.ts")

    if (process.env.RESEND_API_KEY) {
      console.log("\n5) Configure Resend templates (external)")
      runOptional("Resend template setup", "npx tsx scripts/setup-email-templates.ts")
    } else {
      console.log("\n5) Skipping Resend template setup (RESEND_API_KEY not set)")
    }

    console.log("\n6) Ensure system settings defaults")
    await ensureSystemSettings()
  }

  console.log("\n✅ Test environment setup complete.\n")
}

main()
  .catch((error) => {
    console.error("❌ Setup failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
