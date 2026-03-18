import { PrismaClient, Role } from "@prisma/client"
import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// Gender distribution for realistic data
type Gender = "male" | "female" | "non-binary"

// Comprehensive client data with names, emails, and gender
const firstNames = {
  male: [
    "James", "Michael", "David", "Robert", "Christopher", "Daniel", "Matthew", "William",
    "Joseph", "Andrew", "Ryan", "Joshua", "John", "Mark", "Thomas", "Steven", "Paul",
    "Kevin", "Brian", "Edward", "Jason", "Jeffrey", "Timothy", "Ronald", "Anthony",
    "Eric", "Stephen", "Kenneth", "Donald", "Gary", "Larry", "Frank", "Scott", "Raymond",
    "Gregory", "Benjamin", "Patrick", "Jack", "Dennis", "Jerry", "Tyler", "Aaron",
    "Jose", "Adam", "Nathan", "Henry", "Douglas", "Zachary", "Peter", "Kyle"
  ],
  female: [
    "Sarah", "Emily", "Jessica", "Amanda", "Ashley", "Jennifer", "Michelle", "Melissa",
    "Nicole", "Stephanie", "Elizabeth", "Lauren", "Megan", "Rachel", "Samantha", "Amy",
    "Angela", "Lisa", "Kimberly", "Christina", "Kelly", "Mary", "Patricia", "Linda",
    "Barbara", "Susan", "Karen", "Nancy", "Betty", "Helen", "Sandra", "Donna", "Carol",
    "Ruth", "Sharon", "Michelle", "Laura", "Sarah", "Kimberly", "Deborah", "Jessica",
    "Shirley", "Cynthia", "Angela", "Melissa", "Brenda", "Amy", "Anna", "Rebecca",
    "Virginia", "Kathleen", "Pamela", "Martha", "Debra", "Amanda", "Stephanie", "Carolyn"
  ],
  nonBinary: [
    "Alex", "Jordan", "Taylor", "Casey", "Morgan", "Riley", "Avery", "Quinn", "Sage",
    "River", "Phoenix", "Rowan", "Skylar", "Cameron", "Dakota", "Jamie", "Blake",
    "Hayden", "Reese", "Finley", "Emery", "Parker", "Drew", "Kai", "Sam"
  ]
}

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor",
  "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Sanchez",
  "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright",
  "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker",
  "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts", "Gomez", "Phillips",
  "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart",
  "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan",
  "Cooper", "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox",
  "Ward", "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray",
  "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel",
  "Myers", "Long", "Ross", "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell",
  "Sullivan", "Bell", "Coleman", "Butler", "Henderson", "Barnes", "Gonzales", "Fisher",
  "Vasquez", "Simmons", "Romero", "Jordan", "Patterson", "Alexander", "Hamilton", "Graham",
  "Reynolds", "Griffin", "Wallace", "Moreno", "West", "Cole", "Hayes", "Bryant", "Herrera",
  "Gibson", "Ellis", "Tran", "Medina", "Aguilar", "Stevens", "Murray", "Ford", "Castro",
  "Marshall", "Owens", "Harrison", "Fernandez", "Mcdonald", "Woods", "Washington", "Kennedy"
]

// Coach names
const coachNames = [
  { name: "Alex Thompson", email: "alex.thompson@test.local" },
  { name: "Jordan Martinez", email: "jordan.martinez@test.local" },
  { name: "Taylor Chen", email: "taylor.chen@test.local" },
  { name: "Casey Williams", email: "casey.williams@test.local" },
  { name: "Morgan Davis", email: "morgan.davis@test.local" },
]

// Cohort names
const cohortNames = [
  "Spring 2024 Fitness Challenge",
  "Summer Transformation Program",
  "Fall Wellness Group",
  "Winter Bootcamp",
  "Year-Round Support",
  "New Year Reset",
  "Spring Renewal",
  "Summer Strength",
  "Autumn Accountability",
  "Holiday Health",
  "2024 Kickstart",
  "Wellness Warriors",
  "Fit for Life",
  "Transformation Tribe",
  "Health Heroes",
]

// Activity level types for varied health data
type ActivityLevel = "low" | "moderate" | "high" | "very-high"

interface ActivityProfile {
  level: ActivityLevel
  baseSteps: number
  baseCalories: number
  weightRange: { min: number; max: number }
  consistency: number // 0-1, probability of daily check-ins
}

const activityProfiles: ActivityProfile[] = [
  { level: "low", baseSteps: 3000, baseCalories: 1500, weightRange: { min: 140, max: 220 }, consistency: 0.3 },
  { level: "moderate", baseSteps: 7000, baseCalories: 2000, weightRange: { min: 120, max: 200 }, consistency: 0.6 },
  { level: "high", baseSteps: 12000, baseCalories: 2500, weightRange: { min: 110, max: 180 }, consistency: 0.8 },
  { level: "very-high", baseSteps: 15000, baseCalories: 3000, weightRange: { min: 100, max: 170 }, consistency: 0.9 },
]

// Generate realistic entry data based on activity profile
function generateEntryData(
  profile: ActivityProfile,
  dayOffset: number,
  gender: Gender
): { weight: number; steps: number; calories: number; heightInches?: number; sleepQuality?: number; perceivedStress?: number } {
  // Weight varies by ±3 lbs with slight trend over time
  const weightTrend = dayOffset * 0.01 // Slight weight loss trend
  const weightVariation = (Math.random() - 0.5) * 6
  const baseWeight = (profile.weightRange.min + profile.weightRange.max) / 2
  const weight = Math.round((baseWeight + weightTrend + weightVariation) * 10) / 10

  // Steps vary by ±25% of base
  const stepsVariation = (Math.random() - 0.5) * 0.5
  const steps = Math.max(1000, Math.floor(profile.baseSteps * (1 + stepsVariation)))

  // Calories vary by ±20% of base
  const caloriesVariation = (Math.random() - 0.5) * 0.4
  const calories = Math.max(1000, Math.floor(profile.baseCalories * (1 + caloriesVariation)))

  // Height (only set for some entries to simulate partial data)
  const heightInches = Math.random() > 0.3 
    ? Math.floor(Math.random() * 12 + 60) // 60-72 inches (5'0" to 6'0")
    : undefined

  // Sleep quality (1-10 scale, only set for some entries)
  const sleepQuality = Math.random() > 0.4
    ? Math.floor(Math.random() * 10) + 1
    : undefined

  // Perceived stress (1-10 scale, only set for some entries)
  const perceivedStress = Math.random() > 0.5
    ? Math.floor(Math.random() * 10) + 1
    : undefined

  return { weight, steps, calories, heightInches, sleepQuality, perceivedStress }
}

// Generate random client name and email
function generateClientData(index: number): { name: string; email: string; gender: Gender } {
  // Distribute genders: 45% female, 45% male, 10% non-binary
  const genderRoll = Math.random()
  let gender: Gender
  let namePool: string[]
  
  if (genderRoll < 0.45) {
    gender = "female"
    namePool = firstNames.female
  } else if (genderRoll < 0.9) {
    gender = "male"
    namePool = firstNames.male
  } else {
    gender = "non-binary"
    namePool = firstNames.nonBinary
  }

  const firstName = namePool[Math.floor(Math.random() * namePool.length)]
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
  const name = `${firstName} ${lastName}`
  const email = `client${index.toString().padStart(3, "0")}@test.local`

  return { name, email, gender }
}

async function main() {
  console.log("🌱 Generating comprehensive test data...\n")
  console.log("   - 100 clients")
  console.log("   - 5 coaches")
  console.log("   - 1 admin+coach user")
  console.log("   - 3 coaches with admin role")
  console.log("   - Varied health data (activity levels, genders)")
  console.log("   - All users with passwords set\n")

  const DEFAULT_PASSWORD = "TestPassword123!"
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  const adminCoachEmails = new Set([
    "alex.thompson@test.local",
    "jordan.martinez@test.local",
    "taylor.chen@test.local",
  ])

  // Create coaches
  console.log("Creating coaches...")
  const coaches = []
  for (const coachInfo of coachNames) {
    const roles = adminCoachEmails.has(coachInfo.email)
      ? [Role.COACH, Role.ADMIN]
      : [Role.COACH]
    const coach = await prisma.user.upsert({
      where: { email: coachInfo.email },
      update: {
        roles,
        isTestUser: true,
        passwordHash,
      },
      create: {
        id: randomUUID(),
        email: coachInfo.email,
        name: coachInfo.name,
        roles,
        isTestUser: true,
        passwordHash,
      },
    })
    coaches.push(coach)
    console.log(`  ✓ ${coach.name} (${coach.email})`)
  }
  console.log(`\n✅ Created ${coaches.length} coaches\n`)

  // Create admin+coach user
  console.log("Creating admin+coach user...")
  const admin = await prisma.user.upsert({
    where: { email: "adamswbrown@gmail.com" },
    update: {
      name: "Adam Brown",
      roles: [Role.ADMIN, Role.COACH],
      isTestUser: true,
      passwordHash,
    },
    create: {
      id: randomUUID(),
      email: "adamswbrown@gmail.com",
      name: "Adam Brown",
      roles: [Role.ADMIN, Role.COACH],
      isTestUser: true,
      passwordHash,
    },
  })
  console.log(`  ✓ ${admin.name} (${admin.email})\n`)

  // Create cohorts (distributed across coaches)
  console.log("Creating cohorts...")
  const cohorts = []
  const targetClients = 100
  const targetCohorts = Math.ceil(targetClients / 8)
  const selectedCohortNames = cohortNames.slice(0, targetCohorts)
  const cohortsPerCoach = Math.ceil(selectedCohortNames.length / coaches.length)
  
  for (let i = 0; i < selectedCohortNames.length; i++) {
    const coachIndex = Math.floor(i / cohortsPerCoach)
    const coach = coaches[coachIndex % coaches.length]
    
    const cohort = await prisma.cohort.upsert({
      where: {
        coachId_name: {
          coachId: coach.id,
          name: selectedCohortNames[i],
        },
      },
      update: {},
      create: {
        id: randomUUID(),
        name: selectedCohortNames[i],
        coachId: coach.id,
      },
    })
    cohorts.push(cohort)
    console.log(`  ✓ ${cohort.name} (Coach: ${coach.name})`)
  }
  console.log(`\n✅ Created ${cohorts.length} cohorts\n`)

  // Create 100 clients
  console.log("Creating 100 clients...")
  const clients = []
  const activityDistribution = [0.2, 0.3, 0.3, 0.2] // 20% low, 30% moderate, 30% high, 20% very-high

  for (let i = 0; i < targetClients; i++) {
    const clientData = generateClientData(i)
    
    // Assign activity profile based on distribution
    const activityRoll = Math.random()
    let profileIndex = 0
    let cumulative = 0
    for (let j = 0; j < activityDistribution.length; j++) {
      cumulative += activityDistribution[j]
      if (activityRoll <= cumulative) {
        profileIndex = j
        break
      }
    }
    const profile = activityProfiles[profileIndex]

    const client = await prisma.user.upsert({
      where: { email: clientData.email },
      update: {
        name: clientData.name,
        roles: [Role.CLIENT],
        isTestUser: true,
        passwordHash,
      },
      create: {
        id: randomUUID(),
        email: clientData.email,
        name: clientData.name,
        roles: [Role.CLIENT],
        isTestUser: true,
        passwordHash,
      },
    })
    
    clients.push({ ...client, gender: clientData.gender, activityProfile: profile })
    
    if ((i + 1) % 25 === 0) {
      console.log(`  ✓ Created ${i + 1} clients...`)
    }
  }
  console.log(`\n✅ Created ${clients.length} clients\n`)

  // Distribute clients across cohorts
  console.log("Distributing clients across cohorts...")
  const clientsPerCohort = Math.floor(clients.length / cohorts.length)
  const remainder = clients.length % cohorts.length

  let clientIndex = 0
  for (let i = 0; i < cohorts.length; i++) {
    const cohort = cohorts[i]
    const cohortSize = clientsPerCohort + (i < remainder ? 1 : 0)
    const cohortClients = clients.slice(clientIndex, clientIndex + cohortSize)

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

    console.log(`  ✓ ${cohort.name}: ${cohortClients.length} clients`)
    clientIndex += cohortSize
  }
  console.log(`\n✅ Distributed clients across cohorts\n`)

  // Generate entries for clients with varied activity levels
  console.log("Generating entries for clients (4 weeks)...")
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let totalEntries = 0
  const entriesByActivityLevel: Record<ActivityLevel, number> = {
    low: 0,
    moderate: 0,
    high: 0,
    "very-high": 0,
  }

  for (let clientIdx = 0; clientIdx < clients.length; clientIdx++) {
    const client = clients[clientIdx]
    const profile = client.activityProfile
    const daysOfData = 28

    const entryDates: Date[] = []
    
    // Generate dates based on consistency
    for (let i = 0; i < daysOfData; i++) {
      if (Math.random() <= profile.consistency) {
        const entryDate = new Date(today)
        entryDate.setDate(entryDate.getDate() - i)
        entryDates.push(entryDate)
      }
    }

    // Sort dates (oldest first)
    entryDates.sort((a, b) => a.getTime() - b.getTime())

    const entriesToCreate: Array<{
      userId: string
      date: Date
      weightLbs?: number
      steps?: number
      calories?: number
      heightInches?: number
      sleepQuality?: number
      perceivedStress?: number
      dataSources: string[]
    }> = []

    for (const entryDate of entryDates) {
      const dayOffset = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))
      const entryData = generateEntryData(profile, dayOffset, client.gender)

      entriesToCreate.push({
        userId: client.id,
        date: entryDate,
        weightLbs: entryData.weight,
        steps: entryData.steps,
        calories: entryData.calories,
        heightInches: entryData.heightInches,
        sleepQuality: entryData.sleepQuality,
        perceivedStress: entryData.perceivedStress,
        dataSources: ["manual"],
      })
    }

    const batchSize = 250
    for (let i = 0; i < entriesToCreate.length; i += batchSize) {
      const batch = entriesToCreate.slice(i, i + batchSize)
      if (batch.length === 0) {
        continue
      }
      await prisma.entry.createMany({
        data: batch,
        skipDuplicates: true,
      })
    }

    totalEntries += entriesToCreate.length
    entriesByActivityLevel[profile.level] += entriesToCreate.length

    if (clientIdx > 0 && (clientIdx + 1) % 50 === 0) {
      console.log(`  ✓ Generated entries for ${clientIdx + 1} clients...`)
    }
  }

  console.log(`\n✅ Generated ${totalEntries} total entries`)
  console.log(`   Low activity: ${entriesByActivityLevel.low}`)
  console.log(`   Moderate activity: ${entriesByActivityLevel.moderate}`)
  console.log(`   High activity: ${entriesByActivityLevel.high}`)
  console.log(`   Very high activity: ${entriesByActivityLevel["very-high"]}\n`)

  // Summary
  console.log("📊 Test Data Summary:")
  console.log(`   Coaches: ${coaches.length}`)
  console.log(`   Admins: 1 admin+coach (${admin.email}) + 3 coaches with admin role`)
  console.log(`   Clients: ${clients.length}`)
  console.log(`   Cohorts: ${cohorts.length}`)
  console.log(`   Total Entries: ${totalEntries}`)
  
  // Gender distribution
  const genderCounts = clients.reduce((acc, c) => {
    const gender = (c as any).gender as Gender
    acc[gender] = (acc[gender] || 0) + 1
    return acc
  }, {} as Record<Gender, number>)
  console.log(`   Gender Distribution:`)
  console.log(`     Female: ${genderCounts.female || 0}`)
  console.log(`     Male: ${genderCounts.male || 0}`)
  console.log(`     Non-binary: ${genderCounts["non-binary"] || 0}`)

  console.log(`\n🔐 All users have password set to: ${DEFAULT_PASSWORD}`)
  console.log("\n✅ Comprehensive test data generation complete!")
}

main()
  .catch((e) => {
    console.error("❌ Error generating test data:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
