import { execSync } from "child_process"
import { PrismaClient } from "@prisma/client"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "../lib/legal-content"

const db = new PrismaClient()
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "adamswbrown@gmail.com"

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

async function main() {
  console.log("\n════════════════════════════════════════════════════════════════")
  console.log("🧪 COACHFIT TEST ENVIRONMENT SETUP")
  console.log("════════════════════════════════════════════════════════════════\n")

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
    run("npx tsx scripts/setup-email-templates.ts")
  } else {
    console.log("\n5) Skipping Resend template setup (RESEND_API_KEY not set)")
  }

  console.log("\n6) Ensure system settings defaults")
  await ensureSystemSettings()

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
