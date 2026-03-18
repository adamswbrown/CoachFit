/**
 * Create Wrapped Test Data
 *
 * Creates a completed 6-week challenge cohort with test data for Fitness Wrapped testing
 *
 * Usage: npm run db:seed && npx tsx scripts/create-wrapped-test-data.ts
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("🎉 Creating Fitness Wrapped test data...")

  // Find or create test coach
  const coach = await db.user.upsert({
    where: { email: "coach@test.local" },
    update: {},
    create: {
      email: "coach@test.local",
      name: "Test Coach",
      roles: ["COACH"],
      isTestUser: true
    }
  })

  console.log("✓ Test coach found/created:", coach.email)

  // Find or create test client
  const client = await db.user.upsert({
    where: { email: "wrapped@test.local" },
    update: {},
    create: {
      email: "wrapped@test.local",
      name: "Wrapped Test Client",
      roles: ["CLIENT"],
      isTestUser: true,
      invitedByCoachId: coach.id
    }
  })

  console.log("✓ Test client found/created:", client.email)

  // Create completed 6-week cohort (started 7 weeks ago)
  const cohortStartDate = new Date()
  cohortStartDate.setDate(cohortStartDate.getDate() - (7 * 7)) // 7 weeks ago
  cohortStartDate.setHours(0, 0, 0, 0)

  const cohort = await db.cohort.create({
    data: {
      name: "Completed 6-Week Challenge (Test)",
      coachId: coach.id,
      cohortStartDate,
      durationWeeks: 6,
      type: "CHALLENGE"
    }
  })

  console.log("✓ Test cohort created:", cohort.name)
  console.log(`  Start Date: ${cohort.cohortStartDate?.toLocaleDateString()}`)
  console.log(`  Duration: ${cohort.durationWeeks} weeks`)

  // Add client to cohort
  await db.cohortMembership.create({
    data: {
      userId: client.id,
      cohortId: cohort.id
    }
  })

  console.log("✓ Client added to cohort")

  // Generate entries for 6 weeks (with some variety)
  const entries = []
  const startDate = new Date(cohortStartDate)
  const daysToGenerate = 42 // 6 weeks

  console.log("✓ Generating entries...")

  for (let i = 0; i < daysToGenerate; i++) {
    const entryDate = new Date(startDate)
    entryDate.setDate(entryDate.getDate() + i)

    // Skip some days randomly (70% completion rate)
    if (Math.random() > 0.7) continue

    const baseWeight = 180
    const weightChange = -(i / daysToGenerate) * 8 // Lose 8 lbs over 6 weeks

    entries.push({
      userId: client.id,
      date: entryDate,
      weightLbs: baseWeight + weightChange + (Math.random() * 2 - 1), // Add some variance
      steps: Math.floor(8000 + Math.random() * 6000), // 8k-14k steps
      calories: Math.floor(2000 + Math.random() * 500), // 2000-2500 calories
      sleepQuality: Math.floor(6 + Math.random() * 4), // 6-10
      perceivedStress: Math.floor(3 + Math.random() * 5), // 3-8
      notes: i % 7 === 0 ? "Feeling great this week!" : null,
      dataSources: ["manual"]
    })
  }

  await db.entry.createMany({ data: entries })
  console.log(`✓ Created ${entries.length} entries`)

  // Generate some workouts
  const workouts = []
  for (let i = 0; i < 20; i++) {
    const workoutDate = new Date(startDate)
    workoutDate.setDate(workoutDate.getDate() + Math.floor(Math.random() * daysToGenerate))
    workoutDate.setHours(Math.floor(6 + Math.random() * 12)) // 6am-6pm

    const durationMins = 30 + Math.random() * 60 // 30-90 minutes

    workouts.push({
      userId: client.id,
      workoutType: ["Running", "Cycling", "Weights", "Yoga"][Math.floor(Math.random() * 4)],
      startTime: workoutDate,
      endTime: new Date(workoutDate.getTime() + durationMins * 60 * 1000),
      durationSecs: Math.floor(durationMins * 60),
      caloriesActive: Math.floor(300 + Math.random() * 400),
      distanceMeters: Math.random() > 0.5 ? Math.floor(3000 + Math.random() * 7000) : null,
      avgHeartRate: Math.floor(120 + Math.random() * 40),
      maxHeartRate: Math.floor(160 + Math.random() * 30),
      sourceDevice: "Test Device"
    })
  }

  await db.workout.createMany({ data: workouts })
  console.log(`✓ Created ${workouts.length} workouts`)

  // Generate sleep records
  const sleepRecords = []
  for (let i = 0; i < daysToGenerate - 5; i++) {
    const sleepDate = new Date(startDate)
    sleepDate.setDate(sleepDate.getDate() + i)

    sleepRecords.push({
      userId: client.id,
      date: sleepDate,
      totalSleepMins: Math.floor(360 + Math.random() * 120), // 6-8 hours
      inBedMins: Math.floor(420 + Math.random() * 120),
      awakeMins: Math.floor(20 + Math.random() * 40),
      asleepCoreMins: Math.floor(200 + Math.random() * 100),
      asleepDeepMins: Math.floor(60 + Math.random() * 60),
      asleepREMMins: Math.floor(80 + Math.random() * 60),
      sourceDevices: ["Test Device"]
    })
  }

  await db.sleepRecord.createMany({ data: sleepRecords })
  console.log(`✓ Created ${sleepRecords.length} sleep records`)

  console.log("\n🎉 Fitness Wrapped test data created successfully!\n")
  console.log("=" .repeat(60))
  console.log("TEST CREDENTIALS")
  console.log("=" .repeat(60))
  console.log(`Email: ${client.email}`)
  console.log(`Password: (Set with: npm run password:set ${client.email} test123)`)
  console.log("\nTo test:")
  console.log(`1. Set password: npm run password:set ${client.email} test123`)
  console.log("2. Login to http://localhost:3000/login")
  console.log("3. You should see the 'Your Fitness Wrapped is Ready!' card")
  console.log("4. Click 'View Your Wrapped' to see the full experience")
  console.log("=" .repeat(60))
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
