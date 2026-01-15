import { PrismaClient, Role } from "@prisma/client"
import { randomUUID } from "crypto"

const prisma = new PrismaClient()

// Client data with realistic names and emails
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

// Cohort names
const cohortNames = [
  "Spring 2024 Fitness Challenge",
  "Summer Transformation Program",
  "Fall Wellness Group",
  "Winter Bootcamp",
  "Year-Round Support",
]

// Generate realistic entry data
function generateEntryData(baseWeight: number, baseSteps: number, baseCalories: number, dayOffset: number) {
  // Weight varies by ±2 lbs
  const weightVariation = (Math.random() - 0.5) * 4
  const weight = Math.round((baseWeight + weightVariation) * 10) / 10

  // Steps vary by ±2000
  const stepsVariation = Math.floor((Math.random() - 0.5) * 4000)
  const steps = Math.max(3000, baseSteps + stepsVariation)

  // Calories vary by ±300
  const caloriesVariation = Math.floor((Math.random() - 0.5) * 600)
  const calories = Math.max(1200, baseCalories + caloriesVariation)

  return { weight, steps, calories }
}

async function main() {
  console.log("🌱 Generating test data for account testing...\n")

  // Find or create a coach user
  let coach = await prisma.user.findFirst({
    where: { roles: { has: Role.COACH } },
  })

  if (!coach) {
    console.log("Creating coach user...")
    coach = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: "coach@test.local",
        name: "Test Coach",
        roles: [Role.COACH],
        isTestUser: true,
      },
    })
  }

  console.log(`✅ Using coach: ${coach.email} (${coach.name})\n`)

  // Create cohorts
  console.log("Creating cohorts...")
  const cohorts = []
  for (const cohortName of cohortNames) {
    const existing = await prisma.cohort.findFirst({
      where: { name: cohortName, coachId: coach.id },
    })
    
    const cohort = existing || await prisma.cohort.create({
      data: {
        id: randomUUID(),
        name: cohortName,
        coachId: coach.id,
      },
    })
    cohorts.push(cohort)
    console.log(`  ✓ ${cohort.name}`)
  }
  console.log(`\n✅ Created ${cohorts.length} cohorts\n`)

  // Create clients
  console.log("Creating clients...")
  const clients = []
  for (const clientInfo of clientData) {
    const client = await prisma.user.upsert({
      where: { email: clientInfo.email },
      update: {},
      create: {
        id: randomUUID(),
        email: clientInfo.email,
        name: clientInfo.name,
        roles: [Role.CLIENT],
        isTestUser: true,
      },
    })
    clients.push(client)
  }
  console.log(`✅ Created ${clients.length} clients\n`)

  // Distribute clients across cohorts
  // 12 active clients (3 per cohort for first 4 cohorts, evenly distributed)
  // 3 pending invites (1 per cohort for first 3 cohorts)
  console.log("Distributing clients across cohorts...")
  
  const activeClients = clients.slice(0, 12)
  const pendingClients = clients.slice(12, 15)

  // Add active clients to cohorts (3 per cohort for first 4 cohorts)
  for (let i = 0; i < 4; i++) {
    const cohort = cohorts[i]
    const cohortClients = activeClients.slice(i * 3, (i + 1) * 3)
    
    for (const client of cohortClients) {
      await prisma.cohortMembership.upsert({
        where: {
          userId_cohortId: {
            userId: client.id,
            cohortId: cohort.id,
          },
        },
        update: {},
        create: {
          userId: client.id,
          cohortId: cohort.id,
        },
      })
    }
    console.log(`  ✓ ${cohort.name}: ${cohortClients.length} active clients`)
  }

  // Add pending invites (1 per cohort for first 3 cohorts)
  for (let i = 0; i < 3; i++) {
    const cohort = cohorts[i]
    const pendingClient = pendingClients[i]
    
    await prisma.cohortInvite.upsert({
      where: {
        email_cohortId: {
          email: pendingClient.email,
          cohortId: cohort.id,
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        email: pendingClient.email,
        cohortId: cohort.id,
      },
    })
    console.log(`  ✓ ${cohort.name}: 1 pending invite (${pendingClient.email})`)
  }

  console.log(`\n✅ Distributed clients across cohorts\n`)

  // Generate entries for active clients
  console.log("Generating entries for active clients...")
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let totalEntries = 0

  for (const client of activeClients) {
    // Each client gets 7-30 days of entries
    const daysOfData = Math.floor(Math.random() * 23) + 7 // 7-30 days
    
    // Base stats vary per client (realistic ranges)
    const baseWeight = Math.round((Math.random() * 60 + 120) * 10) / 10 // 120-180 lbs
    const baseSteps = Math.floor(Math.random() * 5000 + 8000) // 8000-13000 steps
    const baseCalories = Math.floor(Math.random() * 800 + 1800) // 1800-2600 calories

    const entryDates: Date[] = []
    
    for (let i = 0; i < daysOfData; i++) {
      const entryDate = new Date(today)
      entryDate.setDate(entryDate.getDate() - i)
      entryDates.push(entryDate)
    }

    // Sort dates (oldest first)
    entryDates.sort((a, b) => a.getTime() - b.getTime())

    for (const entryDate of entryDates) {
      const { weight, steps, calories } = generateEntryData(
        baseWeight,
        baseSteps,
        baseCalories,
        Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))
      )

      await prisma.entry.upsert({
        where: {
          userId_date: {
            userId: client.id,
            date: entryDate,
          },
        },
        update: {},
        create: {
          userId: client.id,
          date: entryDate,
          weightLbs: weight,
          steps: steps,
          calories: calories,
        },
      })
      totalEntries++
    }

    console.log(`  ✓ ${client.name}: ${daysOfData} entries`)
  }

  console.log(`\n✅ Generated ${totalEntries} total entries\n`)

  // Summary
  console.log("📊 Test Data Summary:")
  console.log(`   Coach: ${coach.name} (${coach.email})`)
  console.log(`   Cohorts: ${cohorts.length}`)
  console.log(`   Active Clients: ${activeClients.length}`)
  console.log(`   Pending Invites: ${pendingClients.length}`)
  console.log(`   Total Entries: ${totalEntries}`)
  console.log("\n✅ Test data generation complete!")
}

main()
  .catch((e) => {
    console.error("❌ Error generating test data:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
