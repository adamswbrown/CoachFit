import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function cleanup() {
  console.log("🧹 Cleaning up database...")

  // Get admin user
  const adminUser = await db.user.findUnique({
    where: { email: "adamswbrown@gmail.com" },
  })

  if (!adminUser) {
    console.error("❌ Admin user not found!")
    await db.$disconnect()
    process.exit(1)
  }

  console.log(`✅ Found admin user: ${adminUser.email}`)

  // Delete all data except admin user
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
  
  // Delete all users except admin
  await db.user.deleteMany({
    where: {
      email: { not: "adamswbrown@gmail.com" }
    }
  })

  console.log("✅ Cleanup complete!")
}

async function generateTestData() {
  console.log("🚀 Generating test data...")

  // Get admin user
  const admin = await db.user.findUnique({
    where: { email: "adamswbrown@gmail.com" },
  })

  if (!admin) {
    console.error("❌ Admin user not found!")
    await db.$disconnect()
    process.exit(1)
  }

  // Create coaches
  const coaches = []
  for (let i = 1; i <= 5; i++) {
    const coach = await db.user.create({
      data: {
        email: `coach${i}@example.com`,
        name: `Coach ${i}`,
        roles: ["COACH"],
        passwordHash: await bcrypt.hash(`password${i}`, 10),
        onboardingComplete: true,
      },
    })
    coaches.push(coach)
    console.log(`✅ Created Coach ${i}`)
  }

  // Create clients
  const clients = []
  for (let i = 1; i <= 15; i++) {
    const client = await db.user.create({
      data: {
        email: `client${i}@example.com`,
        name: `Client ${i}`,
        roles: ["CLIENT"],
        passwordHash: await bcrypt.hash(`password${i}`, 10),
        onboardingComplete: true,
      },
    })
    clients.push(client)
    console.log(`✅ Created Client ${i}`)
  }

  // Create 5 co-managed cohorts
  const cohortNames = [
    "Winter Bootcamp",
    "Spring Fitness",
    "Summer Challenge",
    "Fall Transformation",
    "Holiday Health"
  ]

  for (let i = 0; i < 5; i++) {
    // Each cohort is owned by coaches[i] and co-managed by coaches[(i+1) % 5]
    const ownerCoach = coaches[i]
    const coCoach = coaches[(i + 1) % 5]

    const cohort = await db.cohort.create({
      data: {
        name: cohortNames[i],
        coachId: ownerCoach.id,
      },
    })

    // Add co-coach
    await db.coachCohortMembership.create({
      data: {
        coachId: coCoach.id,
        cohortId: cohort.id,
      },
    })

    // Create check-in config
    await db.cohortCheckInConfig.create({
      data: {
        cohortId: cohort.id,
        enabledPrompts: ["weightLbs", "steps", "calories", "sleepQuality", "perceivedStress", "notes"],
        customPrompt1: "How did your workouts feel?",
        customPrompt1Type: "text",
      },
    })

    // Add 3 clients to this cohort
    const cohortClients = clients.slice(i * 3, (i + 1) * 3)
    for (const client of cohortClients) {
      await db.cohortMembership.create({
        data: {
          userId: client.id,
          cohortId: cohort.id,
        },
      })
    }

    console.log(`✅ Created Cohort "${cohortNames[i]}" (Owner: ${ownerCoach.name}, Co-Coach: ${coCoach.name}, Clients: ${cohortClients.map(c => c.name).join(", ")})`)
  }

  // Create some entries for clients
  const today = new Date()
  for (const client of clients) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(today)
      date.setDate(date.getDate() - day)
      
      await db.entry.create({
        data: {
          userId: client.id,
          date,
          weightLbs: 180 + Math.random() * 20,
          steps: 5000 + Math.random() * 15000,
          calories: 1800 + Math.random() * 800,
          sleepQuality: Math.floor(1 + Math.random() * 10),
          perceivedStress: Math.floor(1 + Math.random() * 10),
          notes: `Entry for ${date.toLocaleDateString()}`,
          dataSources: ["manual"],
        },
      })
    }
  }

  console.log(`✅ Created entries for all clients`)

  console.log("\n✨ Test data generation complete!")
  console.log("\nSummary:")
  console.log(`- 1 Admin: adamswbrown@gmail.com`)
  console.log(`- 5 Coaches`)
  console.log(`- 15 Clients`)
  console.log(`- 5 Co-Managed Cohorts`)
}

async function main() {
  try {
    await cleanup()
    await generateTestData()
  } catch (error) {
    console.error("Error:", error)
    throw error
  } finally {
    await db.$disconnect()
  }
}

main()
