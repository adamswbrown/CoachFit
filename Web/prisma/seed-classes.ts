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

  console.log(`\n  Templates: ${(hiitCreated ? 1 : 0) + (coreCreated ? 1 : 0)} created, ${(!hiitCreated ? 1 : 0) + (!coreCreated ? 1 : 0)} updated`)

  // ── Step 2: Read TeamUp data ─────────────────────────────────────────────

  const dataPath = path.resolve(__dirname, "../../research/teamupdata.json")
  const raw = fs.readFileSync(dataPath, "utf8")
  const data: { results: TeamUpEvent[] } = JSON.parse(raw)

  const cutoff = new Date("2026-03-21T00:00:00Z")
  const futureEvents = data.results.filter(
    (e) => new Date(e.starts_at) >= cutoff
  )

  console.log(`\n  TeamUp events: ${data.results.length} total, ${futureEvents.length} future (>= 2026-03-21)`)

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

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log(`\n\n  Sessions: ${created} created, ${skipped} skipped (already exist)`)
  console.log(`    HIIT: ${hiitCount} sessions`)
  console.log(`    CORE: ${coreCount} sessions`)
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
