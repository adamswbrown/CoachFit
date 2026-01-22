import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { DEFAULT_TEMPLATES } from "../lib/default-questionnaire-templates"

const db = new PrismaClient()
const ADMIN_EMAIL = "adamswbrown@gmail.com"
const DEFAULT_PASSWORD = "TestPassword123!"

type Gender = "male" | "female" | "non-binary"

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

const coachNames = [
  { name: "Alex Thompson", email: "alex.thompson@test.local" },
  { name: "Jordan Martinez", email: "jordan.martinez@test.local" },
  { name: "Taylor Chen", email: "taylor.chen@test.local" },
  { name: "Casey Williams", email: "casey.williams@test.local" },
  { name: "Morgan Davis", email: "morgan.davis@test.local" },
]

const adminCoachEmails = new Set([
  "alex.thompson@test.local",
  "jordan.martinez@test.local",
  "taylor.chen@test.local",
])

const generateCohortNames = (): string[] => {
  const adjectives = [
    "Spring", "Summer", "Fall", "Winter", "Morning", "Evening", "Advanced", "Beginner",
    "Elite", "Community", "Premium", "Core", "Power", "Strength", "Wellness", "Transform",
    "Peak", "Focus", "Balance", "Dynamic", "Steady", "Momentum", "Ascend", "Rise", "Thrive"
  ]
  const programs = [
    "Fitness Challenge", "Transformation Program", "Wellness Group", "Bootcamp", "Support",
    "Coaching Circle", "Training Squad", "Workout Collective", "Fitness Crew", "Training Team",
    "Gym Masters", "Strength Society", "Athletic Alliance", "Cardio Crew", "Yoga Collective"
  ]

  const names: string[] = []
  for (let i = 0; i < adjectives.length; i++) {
    names.push(`${adjectives[i]} ${programs[i % programs.length]}`)
  }
  return names
}

const cohortNames = generateCohortNames()

type ActivityLevel = "low" | "moderate" | "high" | "very-high"
type ActivityProfile = {
  level: ActivityLevel
  baseWeight: number
  baseSteps: number
  baseCalories: number
  consistency: number
}

const activityProfiles: ActivityProfile[] = [
  { level: "low", baseWeight: 190, baseSteps: 6000, baseCalories: 2000, consistency: 0.6 },
  { level: "moderate", baseWeight: 175, baseSteps: 9000, baseCalories: 2200, consistency: 0.75 },
  { level: "high", baseWeight: 165, baseSteps: 11000, baseCalories: 2400, consistency: 0.85 },
  { level: "very-high", baseWeight: 155, baseSteps: 13000, baseCalories: 2600, consistency: 0.92 },
]

function generateEntryData(profile: ActivityProfile, _dayOffset: number, gender: Gender) {
  const weightVariation = (Math.random() - 0.5) * 6
  const weightTrend = gender === "female" ? -0.05 : gender === "male" ? -0.1 : -0.07
  const weight = Math.round((profile.baseWeight + weightVariation + weightTrend) * 10) / 10

  const stepsVariation = (Math.random() - 0.5) * 0.5
  const steps = Math.max(1000, Math.floor(profile.baseSteps * (1 + stepsVariation)))

  const caloriesVariation = (Math.random() - 0.5) * 0.4
  const calories = Math.max(1000, Math.floor(profile.baseCalories * (1 + caloriesVariation)))

  const heightInches = Math.random() > 0.3 ? Math.floor(Math.random() * 12 + 60) : undefined
  const sleepQuality = Math.random() > 0.4 ? Math.floor(Math.random() * 10) + 1 : undefined
  const perceivedStress = Math.random() > 0.5 ? Math.floor(Math.random() * 10) + 1 : undefined

  return { weight, steps, calories, heightInches, sleepQuality, perceivedStress }
}

const winsOptions = [
  "Hit my step goal most days and felt more consistent.",
  "Meal prep made the week much easier.",
  "Workouts felt stronger and more focused.",
  "I kept a steady routine even with a busy schedule.",
  "I tracked meals more accurately this week.",
]

const challengeOptions = [
  "Late nights made recovery harder than expected.",
  "A couple of social events threw off my calories.",
  "Stressful workdays led to lower energy.",
  "I struggled with hydration on two days.",
  "Sleep was inconsistent, which affected training.",
]

const nutritionHelpOptions = [
  "Ideas for quick high-protein breakfasts.",
  "Help with snacks that fit my calorie targets.",
  "Guidance on eating out without overdoing it.",
  "Simple meal prep routines for weekdays.",
  "How to manage late-night cravings.",
]

const behaviorGoals = [
  "Prepare lunch the night before at least 4 days.",
  "Hit 2L of water daily.",
  "Do a 10-minute stretch routine 3 times.",
  "Track every meal for the next 7 days.",
  "Aim for bedtime before 10:30pm on weekdays.",
]

const reflectionOptions = [
  "Staying consistent with tracking and training.",
  "Feeling more confident with my routine.",
  "Improved energy and fewer skipped workouts.",
  "Better nutrition choices and less snacking.",
  "More consistent steps even on busy days.",
]

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const getWeeklyNumbers = (profile: ActivityProfile) => {
  switch (profile.level) {
    case "very-high":
      return {
        daysTrained: randomInt(4, 6),
        daysSteps: randomInt(5, 7),
        daysCalories: randomInt(5, 7),
      }
    case "high":
      return {
        daysTrained: randomInt(3, 5),
        daysSteps: randomInt(4, 6),
        daysCalories: randomInt(4, 6),
      }
    case "moderate":
      return {
        daysTrained: randomInt(2, 4),
        daysSteps: randomInt(3, 5),
        daysCalories: randomInt(3, 5),
      }
    default:
      return {
        daysTrained: randomInt(2, 3),
        daysSteps: randomInt(2, 4),
        daysCalories: randomInt(2, 4),
      }
  }
}

const generateWeekResponse = (weekNumber: number, profile: ActivityProfile) => {
  const numbers = getWeeklyNumbers(profile)
  const goal = pick(behaviorGoals)
  const goalReview = `${goal} — I hit it on ${randomInt(2, 5)} days and feel more on track.`

  const base = {
    wins: pick(winsOptions),
    challenges: pick(challengeOptions),
    days_trained: numbers.daysTrained,
    days_hit_steps: numbers.daysSteps,
    days_on_calories: numbers.daysCalories,
    nutrition_help: pick(nutritionHelpOptions),
  }

  if (weekNumber === 1) {
    return {
      ...base,
      behavior_goal: goal,
    }
  }

  if (weekNumber === 4) {
    return {
      ...base,
      monthly_reflection: pick(reflectionOptions),
    }
  }

  return {
    ...base,
    behavior_goal_review: goalReview,
  }
}

const getMonday = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function generateClientData(index: number): { name: string; email: string; gender: Gender } {
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
  console.log("\n════════════════════════════════════════════════════════════════")
  console.log("🌱 COMPREHENSIVE TEST DATA GENERATION (MULTI-COACH AWARE)")
  console.log("════════════════════════════════════════════════════════════════\n")
  console.log("📊 Generation Plan:")
  console.log("   • 100 clients")
  console.log("   • 5 coaches")
  console.log("   • ~10 cohorts (~10 clients each)")
  console.log("   • ~70% multi-coach, ~30% single-coach")
  console.log("   • Multi-week questionnaires with varied responses")
  console.log("   • Keeping admin: " + ADMIN_EMAIL + "\n")

  const startTime = Date.now()
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  // Ensure admin+coach user
  console.log("🔍 Step 1: Ensuring admin user...")
  const admin = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Adam Brown",
      roles: [Role.ADMIN, Role.COACH],
      isTestUser: true,
      passwordHash,
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
  console.log(`✅ Admin ready: ${admin.name}\n`)

  // Cleanup
  console.log("🧹 Step 2: Cleaning database...")
  console.log("   Deleting: admin actions, notes, entries, pairing codes...")
  await db.adminAction.deleteMany({})
  await db.coachNote.deleteMany({})
  await db.entry.deleteMany({})
  await db.weeklyQuestionnaireResponse.deleteMany({})
  await db.questionnaireBundle.deleteMany({})
  await db.pairingCode.deleteMany({})
  console.log("   Deleting: sleep records, workouts, memberships, invites...")
  await db.sleepRecord.deleteMany({})
  await db.workout.deleteMany({})
  await db.coachCohortMembership.deleteMany({})
  await db.cohortMembership.deleteMany({})
  await db.cohortInvite.deleteMany({})
  console.log("   Deleting: cohorts, check-in configs, coach invites...")
  await db.cohortCheckInConfig.deleteMany({})
  await db.cohort.deleteMany({})
  await db.coachInvite.deleteMany({})
  console.log("   Deleting: all other users...")
  await db.user.deleteMany({ where: { email: { not: ADMIN_EMAIL } } })
  console.log("✅ Database cleaned\n")

  // Create coaches
  console.log("👥 Step 3: Creating coaches...")
  const coaches = []
  for (let i = 0; i < coachNames.length; i++) {
    const coachInfo = coachNames[i]
    const isAdminCoach = coachInfo.email === "alex.thompson@test.local" || adminCoachEmails.has(coachInfo.email)
    const roles = isAdminCoach
      ? [Role.COACH, Role.ADMIN]
      : [Role.COACH]
    const coach = await db.user.create({
      data: {
        id: randomUUID(),
        email: coachInfo.email,
        name: coachInfo.name,
        roles,
        isTestUser: true,
        passwordHash,
        onboardingComplete: true,
      },
    })
    coaches.push(coach)
    console.log(`   [${i + 1}/${coachNames.length}] ${coach.name}`)
  }
  console.log(`✅ Created ${coaches.length} coaches\n`)

  // Create cohorts
  console.log("📚 Step 4: Creating cohorts...")
  const cohorts = []
  let multiCoachCount = 0
  let singleCoachCount = 0
  const targetClients = 100
  const targetCohorts = Math.ceil(targetClients / 10)
  const selectedCohortNames = cohortNames.slice(0, targetCohorts)
  const baseStart = getMonday(new Date())
  baseStart.setDate(baseStart.getDate() - 35)

  for (let i = 0; i < selectedCohortNames.length; i++) {
    const owner = coaches[i % coaches.length]
    const isMultiCoach = Math.random() < 0.7
    const coCoach = isMultiCoach ? coaches[(i + 1) % coaches.length] : null

    const cohortStartDate = new Date(baseStart)

    const cohort = await db.cohort.create({
      data: {
        id: randomUUID(),
        name: selectedCohortNames[i],
        coachId: owner.id,
        cohortStartDate,
        durationConfig: "six-week",
        durationWeeks: 6,
      },
    })

    let coachType = "single"
    if (coCoach && coCoach.id !== owner.id) {
      await db.coachCohortMembership.create({
        data: {
          coachId: coCoach.id,
          cohortId: cohort.id,
        },
      })
      multiCoachCount++
      coachType = "multi"
    } else {
      singleCoachCount++
    }

    await db.cohortCheckInConfig.create({
      data: {
        cohortId: cohort.id,
        enabledPrompts: ["weightLbs", "steps", "calories", "sleepQuality", "perceivedStress", "notes"],
        customPrompt1: "How did your workouts feel?",
        customPrompt1Type: "text",
      },
    })

    await db.questionnaireBundle.create({
      data: {
        cohortId: cohort.id,
        bundleJson: {
          week1: DEFAULT_TEMPLATES.week1,
          week2: DEFAULT_TEMPLATES.week2,
          week3: DEFAULT_TEMPLATES.week3,
          week4: DEFAULT_TEMPLATES.week4,
          week5: DEFAULT_TEMPLATES.week5,
        } as any,
      },
    })

    cohorts.push(cohort)
    
    if ((i + 1) % 5 === 0 || i === selectedCohortNames.length - 1) {
      console.log(`   [${i + 1}/${selectedCohortNames.length}] Created (multi: ${multiCoachCount}, single: ${singleCoachCount})`)
    }
  }
  console.log(`✅ Created ${cohorts.length} cohorts (${multiCoachCount} multi-coach, ${singleCoachCount} single-coach)\n`)

  // Create clients
  console.log("👤 Step 5: Creating 100 clients...")
  const clients: Array<{ id: string; gender: Gender; activityProfile: ActivityProfile; cohortId?: string }> = []
  const activityDistribution = [0.1, 0.3, 0.35, 0.25]
  const activityCounts = [0, 0, 0, 0]

  for (let i = 0; i < targetClients; i++) {
    const clientInfo = generateClientData(i)

    const roll = Math.random()
    let profileIndex = 0
    let cumulative = 0
    for (let j = 0; j < activityDistribution.length; j++) {
      cumulative += activityDistribution[j]
      if (roll <= cumulative) {
        profileIndex = j
        break
      }
    }
    activityCounts[profileIndex]++
    const profile = activityProfiles[profileIndex]

    const client = await db.user.create({
      data: {
        id: randomUUID(),
        email: clientInfo.email,
        name: clientInfo.name,
        roles: [Role.CLIENT],
        isTestUser: true,
        passwordHash,
        onboardingComplete: true,
      },
    })

    clients.push({ id: client.id, gender: clientInfo.gender, activityProfile: profile })
    
    if ((i + 1) % 25 === 0 || i === targetClients - 1) {
      console.log(`   [${i + 1}/${targetClients}] Low:${activityCounts[0]} Mod:${activityCounts[1]} High:${activityCounts[2]} VH:${activityCounts[3]}`)
    }
  }
  console.log(`✅ Created ${clients.length} clients\n`)

  // Assign clients to cohorts
  console.log("📍 Step 6: Assigning clients to cohorts...")
  const clientsPerCohort = Math.floor(clients.length / cohorts.length)
  const remainder = clients.length % cohorts.length
  let idx = 0
  let totalAssigned = 0

  for (let i = 0; i < cohorts.length; i++) {
    const size = clientsPerCohort + (i < remainder ? 1 : 0)
    const cohortClients = clients.slice(idx, idx + size)
    
    for (const client of cohortClients) {
      await db.cohortMembership.create({
        data: {
          userId: client.id,
          cohortId: cohorts[i].id,
        },
      })
      client.cohortId = cohorts[i].id
      totalAssigned++
    }
    
    if ((i + 1) % 5 === 0 || i === cohorts.length - 1) {
      console.log(`   [${i + 1}/${cohorts.length}] Assigned ${totalAssigned} clients total`)
    }
    idx += size
  }
  console.log(`✅ All ${totalAssigned} clients assigned to ${cohorts.length} cohorts\n`)

  // Generate entries
  console.log("📝 Step 7: Generating health entries (batched)...")
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let entriesCreated = 0
  let clientsWithEntries = 0
  const entryStats: { [key: string]: number } = { 0: 0, 1: 0, 2: 0, 3: 0 }

  // Collect all entry upserts into a flat array
  const entryUpserts: Array<{ upsert: any; clientIndex: number }> = []
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]
    const profile = client.activityProfile
    const daysOfData = Math.floor(Math.random() * 60) + 30
    const entryDates: Date[] = []
    for (let j = 0; j < daysOfData; j++) {
      if (Math.random() <= profile.consistency) {
        const entryDate = new Date(today)
        entryDate.setDate(entryDate.getDate() - j)
        entryDates.push(entryDate)
      }
    }
    entryDates.sort((a, b) => a.getTime() - b.getTime())

    for (const entryDate of entryDates) {
      const entryData = generateEntryData(profile, 0, client.gender)
      entryUpserts.push({
        upsert: {
          where: {
            userId_date: {
              userId: client.id,
              date: entryDate,
            },
          },
          update: {
            weightLbs: entryData.weight,
            steps: entryData.steps,
            calories: entryData.calories,
            heightInches: entryData.heightInches,
            sleepQuality: entryData.sleepQuality,
            perceivedStress: entryData.perceivedStress,
            dataSources: ["manual"],
          },
          create: {
            userId: client.id,
            date: entryDate,
            weightLbs: entryData.weight,
            steps: entryData.steps,
            calories: entryData.calories,
            heightInches: entryData.heightInches,
            sleepQuality: entryData.sleepQuality,
            perceivedStress: entryData.perceivedStress,
            dataSources: ["manual"],
          },
        },
        clientIndex: i,
      })
    }

    if (entryDates.length > 0) {
      clientsWithEntries++
      const levelIndex = activityProfiles.indexOf(profile)
      entryStats[levelIndex]++
    }
  }

  // Batch upserts in chunks of 100
  // --- Best Practice Enhancements ---
  let BATCH_SIZE = 100
  const MIN_BATCH_SIZE = 10
  const MAX_RETRIES = 3
  const RETRY_BASE_DELAY = 200 // ms
  const failedBatches: Array<{ batchNum: number; error: any; batch: any[] }> = []
  let batchNum = 0
  let totalBatches = Math.ceil(entryUpserts.length / BATCH_SIZE)
  let startTimeStep7 = Date.now()

  for (let batchStart = 0; batchStart < entryUpserts.length; batchStart += BATCH_SIZE) {
    batchNum++
    const batch = entryUpserts.slice(batchStart, batchStart + BATCH_SIZE)
    let success = false
    let retries = 0
    let batchError = null
    let batchStartTime = Date.now()
    let currentBatchSize = BATCH_SIZE
    while (!success && retries <= MAX_RETRIES) {
      try {
        await Promise.allSettled(
          batch.map(({ upsert }) => db.entry.upsert(upsert))
        )
        entriesCreated += batch.length
        success = true
      } catch (err) {
        batchError = err
        retries++
        if (currentBatchSize > MIN_BATCH_SIZE) {
          // Reduce batch size for next attempt
          currentBatchSize = Math.max(MIN_BATCH_SIZE, Math.floor(currentBatchSize / 2))
          // Re-slice batch for next attempt
          // (If batch size shrinks, process in smaller sub-batches)
          for (let subStart = 0; subStart < batch.length; subStart += currentBatchSize) {
            const subBatch = batch.slice(subStart, subStart + currentBatchSize)
            try {
              await Promise.allSettled(
                subBatch.map(({ upsert }) => db.entry.upsert(upsert))
              )
              entriesCreated += subBatch.length
            } catch (subErr) {
              failedBatches.push({ batchNum: batchNum, error: subErr, batch: subBatch })
            }
          }
          success = true // Mark as handled (even if some sub-batches failed)
        } else {
          // If already at min batch size, just log and break
          failedBatches.push({ batchNum: batchNum, error: err, batch })
          break
        }
        // Exponential backoff
        const delay = RETRY_BASE_DELAY * Math.pow(2, retries)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2)
    if (batchNum % 5 === 0 || batchStart + BATCH_SIZE >= entryUpserts.length) {
      const percentComplete = Math.round((entriesCreated / entryUpserts.length) * 100)
      const elapsed = ((Date.now() - startTimeStep7) / 1000).toFixed(1)
      const estTotal = ((Number(elapsed) / batchNum) * totalBatches).toFixed(1)
      const estRemain = (Number(estTotal) - Number(elapsed)).toFixed(1)
      console.log(`   [${entriesCreated}/${entryUpserts.length}] entries (${percentComplete}%) | Batch ${batchNum}/${totalBatches} | Last batch: ${batchDuration}s | Elapsed: ${elapsed}s | Est. remain: ${estRemain}s`)
    }
    // Delay between batches
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (failedBatches.length > 0) {
    console.error(`\n❌ ${failedBatches.length} batch(es) failed during entry upserts. See details below:`)
    failedBatches.forEach((fb, idx) => {
      console.error(`  Batch #${fb.batchNum}:`, fb.error)
      // Optionally, print batch info: console.error(fb.batch)
    })
  }
  console.log(`✅ Generated ${entriesCreated} entries from ${clientsWithEntries} clients\n`)

  // Generate weekly questionnaire responses
  console.log("🧾 Step 8: Generating questionnaire responses (multiple weeks)...")
  const questionnaireWeeks = [1, 2, 3, 4, 5]
  let responsesCreated = 0

  for (const client of clients) {
    if (!client.cohortId) {
      continue
    }

    const completionRoll = Math.random()
    const completedWeeks =
      completionRoll < 0.7 ? 5 : completionRoll < 0.9 ? 4 : 3

    for (const weekNumber of questionnaireWeeks.slice(0, completedWeeks)) {
      const responseJson = generateWeekResponse(weekNumber, client.activityProfile)
      const isFinalWeek = weekNumber === completedWeeks && completedWeeks === 5
      const status = isFinalWeek && Math.random() < 0.15 ? "in_progress" : "completed"

      const submittedAt = new Date()
      submittedAt.setDate(submittedAt.getDate() - (5 - weekNumber) * 7 + randomInt(0, 2))

      await db.weeklyQuestionnaireResponse.upsert({
        where: {
          userId_cohortId_weekNumber: {
            userId: client.id,
            cohortId: client.cohortId,
            weekNumber,
          },
        },
        create: {
          userId: client.id,
          cohortId: client.cohortId,
          weekNumber,
          responseJson: responseJson as any,
          status,
          submittedAt: status === "completed" ? submittedAt : null,
        },
        update: {
          responseJson: responseJson as any,
          status,
          submittedAt: status === "completed" ? submittedAt : null,
        },
      })
      responsesCreated += 1
    }
  }

  console.log(`✅ Generated ${responsesCreated} questionnaire responses\n`)

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(1)

  console.log("════════════════════════════════════════════════════════════════")
  console.log("✨ SEED COMPLETE!")
  console.log("════════════════════════════════════════════════════════════════\n")
  console.log("📊 Final Summary:")
  console.log(`  • Coaches: ${coaches.length}`)
  console.log(`  • Cohorts: ${cohorts.length} (${multiCoachCount} multi, ${singleCoachCount} single)`)
  console.log(`  • Clients: ${clients.length}`)
  console.log(`  • Cohort assignments: ${totalAssigned}`)
  console.log(`  • Avg clients/cohort: ${(clients.length / cohorts.length).toFixed(1)}`)
  console.log(`  • Health entries: ${entriesCreated}`)
  console.log(`  • Clients with entries: ${clientsWithEntries}`)
  console.log(`  • Avg entries/active client: ${(entriesCreated / clientsWithEntries).toFixed(1)}`)
  console.log(`  • Questionnaire responses: ${responsesCreated}`)
  console.log(`  • Duration: ${duration}s\n`)
}

main().catch((e) => {
  console.error("❌ Error:", e)
  process.exit(1)
}).finally(async () => {
  await db.$disconnect()
})
