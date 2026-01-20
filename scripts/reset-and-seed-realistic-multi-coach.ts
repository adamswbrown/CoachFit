import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"

const db = new PrismaClient()
const ADMIN_EMAIL = "adamswbrown@gmail.com"

// Realistic client data (from existing seed)
const clientData = [
  { name: "Sarah Johnson", email: "sarah.johnson@test.local" },
  { name: "Michael Chen", email: "michael.chen@test.local" },
  { name: "Emily Rodriguez", email: "emily.rodriguez@test.local" },
  { name: "David Thompson", email: "david.thompson@test.local" },
  { name: "Jessica Martinez", email: "jessica.martinez@test.local" },
  { name: "James Wilson", email: "james.wilson@test.local" },
  { name: "Amanda Davis", email: "amanda.davis@test.local" },
  { name: "Robert Taylor", email: "robert.taylor@test.local" },
  { name: "Lisa Anderson", email: "lisa.anderson@test.local" },
  { name: "Christopher Brown", email: "christopher.brown@test.local" },
  { name: "Michelle Garcia", email: "michelle.garcia@test.local" },
  { name: "Daniel Lee", email: "daniel.lee@test.local" },
  { name: "Jennifer White", email: "jennifer.white@test.local" },
  { name: "Matthew Harris", email: "matthew.harris@test.local" },
  { name: "Nicole Clark", email: "nicole.clark@test.local" },
]

// Cohort names (from existing seed)
const cohortNames = [
  "Spring 2024 Fitness Challenge",
  "Summer Transformation Program",
  "Fall Wellness Group",
  "Winter Bootcamp",
  "Year-Round Support",
]

// Coaches (realistic names)
const coachData = [
  { name: "Coach Alexis", email: "coach.alexis@test.local" },
  { name: "Coach Blake", email: "coach.blake@test.local" },
  { name: "Coach Casey", email: "coach.casey@test.local" },
  { name: "Coach Devon", email: "coach.devon@test.local" },
  { name: "Coach Emery", email: "coach.emery@test.local" },
]

function generateEntryData(baseWeight: number, baseSteps: number, baseCalories: number) {
  const weightVariation = (Math.random() - 0.5) * 4
  const weight = Math.round((baseWeight + weightVariation) * 10) / 10

  const stepsVariation = Math.floor((Math.random() - 0.5) * 4000)
  const steps = Math.max(3000, baseSteps + stepsVariation)

  const caloriesVariation = Math.floor((Math.random() - 0.5) * 600)
  const calories = Math.max(1200, baseCalories + caloriesVariation)

  return { weight, steps, calories }
}

async function cleanup() {
  console.log("🧹 Cleaning up database (keeping admin only)...")

  const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    console.error("❌ Admin user not found. Please create it first.")
    process.exit(1)
  }

  await db.adminAction.deleteMany({})
  await db.coachNote.deleteMany({})
  await db.entry.deleteMany({})
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

  console.log("✅ Cleanup complete")
}

async function seed() {
  console.log("🚀 Seeding realistic test data (multi-coach aware)...")

  // Ensure admin exists
  const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) {
    throw new Error("Admin user missing; run scripts/create-admin.ts first")
  }

  // Create coaches
  const coaches = []
  for (let i = 0; i < coachData.length; i++) {
    const coachInfo = coachData[i]
    const coach = await db.user.create({
      data: {
        id: randomUUID(),
        email: coachInfo.email,
        name: coachInfo.name,
        roles: [Role.COACH],
        passwordHash: await bcrypt.hash(`coachpass${i + 1}`, 10),
        onboardingComplete: true,
        isTestUser: true,
      },
    })
    coaches.push(coach)
  }
  console.log(`✅ Created ${coaches.length} coaches`)

  // Create clients with realistic names
  const clients = []
  for (let i = 0; i < clientData.length; i++) {
    const c = clientData[i]
    const client = await db.user.create({
      data: {
        id: randomUUID(),
        email: c.email,
        name: c.name,
        roles: [Role.CLIENT],
        passwordHash: await bcrypt.hash(`clientpass${i + 1}`, 10),
        onboardingComplete: true,
        isTestUser: true,
      },
    })
    clients.push(client)
  }
  console.log(`✅ Created ${clients.length} clients`)

  // Create cohorts with co-coaches
  const cohorts = []
  for (let i = 0; i < cohortNames.length; i++) {
    const owner = coaches[i % coaches.length]
    const coCoach = coaches[(i + 1) % coaches.length]

    const cohort = await db.cohort.create({
      data: {
        id: randomUUID(),
        name: cohortNames[i],
        coachId: owner.id,
      },
    })

    await db.coachCohortMembership.create({
      data: {
        coachId: coCoach.id,
        cohortId: cohort.id,
      },
    })

    await db.cohortCheckInConfig.create({
      data: {
        cohortId: cohort.id,
        enabledPrompts: ["weightLbs", "steps", "calories", "sleepQuality", "perceivedStress", "notes"],
        customPrompt1: "How did your workouts feel?",
        customPrompt1Type: "text",
      },
    })

    cohorts.push(cohort)
  }
  console.log(`✅ Created ${cohorts.length} cohorts with co-coaches`)

  // Distribute clients across cohorts (mirror original seed logic)
  const activeClients = clients.slice(0, 12)
  const pendingClients = clients.slice(12, 15)

  for (let i = 0; i < 4; i++) {
    const cohort = cohorts[i]
    const cohortClients = activeClients.slice(i * 3, (i + 1) * 3)

    for (const client of cohortClients) {
      await db.cohortMembership.create({
        data: {
          userId: client.id,
          cohortId: cohort.id,
        },
      })
    }
  }

  for (let i = 0; i < 3; i++) {
    const cohort = cohorts[i]
    const pending = pendingClients[i]

    await db.cohortInvite.create({
      data: {
        id: randomUUID(),
        email: pending.email,
        cohortId: cohort.id,
      },
    })
  }

  console.log("✅ Distributed clients and invites across cohorts")

  // Generate entries for active clients
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const client of activeClients) {
    const daysOfData = Math.floor(Math.random() * 23) + 7 // 7-30 days
    const baseWeight = Math.round((Math.random() * 60 + 120) * 10) / 10
    const baseSteps = Math.floor(Math.random() * 5000 + 8000)
    const baseCalories = Math.floor(Math.random() * 800 + 1800)

    for (let i = 0; i < daysOfData; i++) {
      const entryDate = new Date(today)
      entryDate.setDate(entryDate.getDate() - i)
      const { weight, steps, calories } = generateEntryData(baseWeight, baseSteps, baseCalories)

      await db.entry.create({
        data: {
          userId: client.id,
          date: entryDate,
          weightLbs: weight,
          steps,
          calories,
          sleepQuality: Math.floor(1 + Math.random() * 10),
          perceivedStress: Math.floor(1 + Math.random() * 10),
          notes: `Entry for ${entryDate.toLocaleDateString()}`,
          dataSources: ["manual"],
        },
      })
    }
  }

  console.log("✅ Generated entries for active clients")
  console.log("✨ Seeding complete")
}

async function main() {
  try {
    await cleanup()
    await seed()
  } catch (err) {
    console.error(err)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

main()
