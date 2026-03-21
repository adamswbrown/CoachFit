import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

// ─── Instructor Map (confirmed in DB) ────────────────────────────────────────

const INSTRUCTOR_MAP: Record<number, string> = {
  111554: "892d7443-2b1b-4b0b-83e5-a0a477862234", // Gav Cunningham
  139862: "866eed7d-91b5-4dbb-b7d4-1421de65bf4a", // Rory Stephens
  145825: "7f133cf9-316d-4e39-8c68-c9d2599ac5fe", // Clare Cuming
  158454: "7c6db9b1-192a-437a-9e47-a258e223a5c2", // Josh Bunting
}
const GAV_ID = "892d7443-2b1b-4b0b-83e5-a0a477862234"

const ALL_INSTRUCTOR_IDS = [
  "892d7443-2b1b-4b0b-83e5-a0a477862234", // Gav Cunningham
  "866eed7d-91b5-4dbb-b7d4-1421de65bf4a", // Rory Stephens
  "7f133cf9-316d-4e39-8c68-c9d2599ac5fe", // Clare Cuming
  "7c6db9b1-192a-437a-9e47-a258e223a5c2", // Josh Bunting
]

// ─── TeamUp Event Shape ──────────────────────────────────────────────────────

interface TeamUpEvent {
  id: number
  name: string
  starts_at: string
  ends_at: string
  max_occupancy: number
  instructors?: { staff: number; name: string }[]
  description?: string
}

// ─── Seed Function ───────────────────────────────────────────────────────────

export async function seedClasses() {
  console.log("Seeding ClassTemplates and ClassSessions from TeamUp data...\n")

  // ── Step 1: Seed ClassTemplates ──────────────────────────────────────────

  let hiitCreated = false
  let coreCreated = false

  let hiitTemplate = await prisma.classTemplate.findFirst({
    where: { classType: "HIIT", ownerCoachId: GAV_ID },
  })

  if (!hiitTemplate) {
    hiitTemplate = await prisma.classTemplate.create({
      data: {
        ownerCoachId: GAV_ID,
        name: "HIIT",
        classType: "HIIT",
        description: "25-minute coach led small group sessions",
        scope: "FACILITY",
        locationLabel: "Hitsona Bangor",
        capacity: 10,
        waitlistEnabled: true,
        waitlistCapacity: 5,
        bookingOpenHoursBefore: 336, // 14 days
        bookingCloseMinutesBefore: 0,
        cancelCutoffMinutes: 120, // 2 hours
        creditsRequired: 1,
        isActive: true,
      },
    })
    hiitCreated = true
    console.log("  Created HIIT template:", hiitTemplate.id)
  } else {
    // Update to ensure correct values
    hiitTemplate = await prisma.classTemplate.update({
      where: { id: hiitTemplate.id },
      data: {
        description: "25-minute coach led small group sessions",
        locationLabel: "Hitsona Bangor",
        capacity: 10,
        cancelCutoffMinutes: 120,
      },
    })
    console.log("  Updated HIIT template:", hiitTemplate.id)
  }

  let coreTemplate = await prisma.classTemplate.findFirst({
    where: { classType: "CORE", ownerCoachId: GAV_ID },
  })

  if (!coreTemplate) {
    coreTemplate = await prisma.classTemplate.create({
      data: {
        ownerCoachId: GAV_ID,
        name: "CORE",
        classType: "CORE",
        description: "25-minute coach led CORE session",
        scope: "FACILITY",
        locationLabel: "Hitsona Bangor",
        capacity: 15,
        waitlistEnabled: true,
        waitlistCapacity: 5,
        bookingOpenHoursBefore: 336,
        bookingCloseMinutesBefore: 0,
        cancelCutoffMinutes: 120,
        creditsRequired: 1,
        isActive: true,
      },
    })
    coreCreated = true
    console.log("  Created CORE template:", coreTemplate.id)
  } else {
    coreTemplate = await prisma.classTemplate.update({
      where: { id: coreTemplate.id },
      data: {
        description: "25-minute coach led CORE session",
        locationLabel: "Hitsona Bangor",
        capacity: 15,
        cancelCutoffMinutes: 120,
      },
    })
    console.log("  Updated CORE template:", coreTemplate.id)
  }

  let strengthCreated = false

  let strengthTemplate = await prisma.classTemplate.findFirst({
    where: { classType: "Strength", ownerCoachId: GAV_ID },
  })

  if (!strengthTemplate) {
    strengthTemplate = await prisma.classTemplate.create({
      data: {
        ownerCoachId: GAV_ID,
        name: "Strength",
        classType: "Strength",
        description: "45-minute strength and resistance training",
        scope: "FACILITY",
        locationLabel: "Hitsona Bangor",
        capacity: 12,
        waitlistEnabled: true,
        waitlistCapacity: 5,
        bookingOpenHoursBefore: 336,
        bookingCloseMinutesBefore: 0,
        cancelCutoffMinutes: 120,
        creditsRequired: 1,
        isActive: true,
      },
    })
    strengthCreated = true
    console.log("  Created Strength template:", strengthTemplate.id)
  } else {
    strengthTemplate = await prisma.classTemplate.update({
      where: { id: strengthTemplate.id },
      data: {
        description: "45-minute strength and resistance training",
        locationLabel: "Hitsona Bangor",
        capacity: 12,
        cancelCutoffMinutes: 120,
      },
    })
    console.log("  Updated Strength template:", strengthTemplate.id)
  }

  const templatesCreated = (hiitCreated ? 1 : 0) + (coreCreated ? 1 : 0) + (strengthCreated ? 1 : 0)
  const templatesUpdated = (!hiitCreated ? 1 : 0) + (!coreCreated ? 1 : 0) + (!strengthCreated ? 1 : 0)
  console.log(`\n  Templates: ${templatesCreated} created, ${templatesUpdated} updated`)

  // ── Seed window: 6 weeks from 2026-03-21 to 2026-05-01 ────────────────

  const SEED_START = new Date("2026-03-21T00:00:00Z")
  const SEED_END = new Date("2026-05-01T00:00:00Z")

  // ── Cleanup: delete sessions beyond the 6-week window ─────────────────

  const templateIds = [hiitTemplate.id, coreTemplate.id, strengthTemplate.id]
  const deleted = await prisma.classSession.deleteMany({
    where: {
      classTemplateId: { in: templateIds },
      startsAt: { gte: SEED_END },
    },
  })
  if (deleted.count > 0) {
    console.log(`\n  Cleanup: deleted ${deleted.count} sessions beyond ${SEED_END.toISOString().split("T")[0]}`)
  }

  // ── Step 2: Read TeamUp data ─────────────────────────────────────────────

  const dataPath = path.resolve(__dirname, "../../research/teamupdata.json")
  const raw = fs.readFileSync(dataPath, "utf8")
  const data: { results: TeamUpEvent[] } = JSON.parse(raw)

  const futureEvents = data.results.filter(
    (e) => {
      const d = new Date(e.starts_at)
      return d >= SEED_START && d < SEED_END
    }
  )

  console.log(`\n  TeamUp events: ${data.results.length} total, ${futureEvents.length} in 6-week window`)

  // ── Step 3: Seed ClassSessions ───────────────────────────────────────────

  let created = 0
  let skipped = 0
  let hiitCount = 0
  let coreCount = 0
  let earliestDate: Date | null = null
  let latestDate: Date | null = null

  const BATCH_SIZE = 50
  for (let i = 0; i < futureEvents.length; i += BATCH_SIZE) {
    const batch = futureEvents.slice(i, i + BATCH_SIZE)

    for (const event of batch) {
      const isHiit = event.name === "HIIT"
      const template = isHiit ? hiitTemplate : coreTemplate
      const startsAt = new Date(event.starts_at)
      const endsAt = new Date(event.ends_at)

      // Resolve instructor
      const staffId = event.instructors?.[0]?.staff
      const instructorId = staffId ? (INSTRUCTOR_MAP[staffId] ?? GAV_ID) : GAV_ID

      // Idempotent: check if session already exists for this template + start time
      const existing = await prisma.classSession.findFirst({
        where: {
          classTemplateId: template.id,
          startsAt,
        },
      })

      if (existing) {
        skipped++
        continue
      }

      // Create session — use capacityOverride only if different from template default
      const templateCapacity = isHiit ? 10 : 15
      const capacityOverride =
        event.max_occupancy !== templateCapacity ? event.max_occupancy : null

      await prisma.classSession.create({
        data: {
          classTemplateId: template.id,
          instructorId,
          startsAt,
          endsAt,
          capacityOverride,
          status: "SCHEDULED",
        },
      })

      created++
      if (isHiit) hiitCount++
      else coreCount++

      if (!earliestDate || startsAt < earliestDate) earliestDate = startsAt
      if (!latestDate || startsAt > latestDate) latestDate = startsAt
    }

    // Progress indicator every batch
    if (i + BATCH_SIZE < futureEvents.length) {
      process.stdout.write(`  Processing... ${Math.min(i + BATCH_SIZE, futureEvents.length)}/${futureEvents.length}\r`)
    }
  }

  // ── Step 4: Seed Strength Sessions (programmatic — no TeamUp data) ─────

  console.log(`\n\n  Generating Strength sessions...`)

  // Weekly pattern: Mon 18:00, Wed 18:00, Sat 11:15
  const STRENGTH_SCHEDULE: { dayOfWeek: number; hour: number; minute: number }[] = [
    { dayOfWeek: 1, hour: 18, minute: 0 },  // Monday
    { dayOfWeek: 3, hour: 18, minute: 0 },  // Wednesday
    { dayOfWeek: 6, hour: 11, minute: 15 }, // Saturday
  ]
  const STRENGTH_DURATION_MINUTES = 45

  const strengthStart = new Date(SEED_START)
  const strengthEnd = new Date(SEED_END)

  let strengthCreatedCount = 0
  let strengthSkipped = 0
  let instructorIndex = 0

  const cursor = new Date(strengthStart)
  while (cursor <= strengthEnd) {
    const dow = cursor.getUTCDay() // 0=Sun, 1=Mon, ...
    const match = STRENGTH_SCHEDULE.find((s) => s.dayOfWeek === dow)

    if (match) {
      const startsAt = new Date(cursor)
      startsAt.setUTCHours(match.hour, match.minute, 0, 0)

      const endsAt = new Date(startsAt)
      endsAt.setUTCMinutes(endsAt.getUTCMinutes() + STRENGTH_DURATION_MINUTES)

      // Idempotent: check if session already exists for this template + start time
      const existing = await prisma.classSession.findFirst({
        where: {
          classTemplateId: strengthTemplate.id,
          startsAt,
        },
      })

      if (existing) {
        strengthSkipped++
      } else {
        const instructorId = ALL_INSTRUCTOR_IDS[instructorIndex % ALL_INSTRUCTOR_IDS.length]
        instructorIndex++

        await prisma.classSession.create({
          data: {
            classTemplateId: strengthTemplate.id,
            instructorId,
            startsAt,
            endsAt,
            status: "SCHEDULED",
          },
        })

        strengthCreatedCount++

        if (!earliestDate || startsAt < earliestDate) earliestDate = startsAt
        if (!latestDate || startsAt > latestDate) latestDate = startsAt
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  created += strengthCreatedCount
  skipped += strengthSkipped

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log(`\n  Sessions: ${created} created, ${skipped} skipped (already exist)`)
  console.log(`    HIIT: ${hiitCount} sessions`)
  console.log(`    CORE: ${coreCount} sessions`)
  console.log(`    Strength: ${strengthCreatedCount} sessions`)
  if (earliestDate && latestDate) {
    console.log(
      `    Date range: ${earliestDate.toISOString().split("T")[0]} → ${latestDate.toISOString().split("T")[0]}`
    )
  }
  console.log("\n✅ Class seed complete!")
}

// ─── Run ─────────────────────────────────────────────────────────────────────

seedClasses()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error("Error seeding classes:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
