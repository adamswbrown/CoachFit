import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

// ─── Known Instructor Map (CoachFit DB UUID → used as instructorId) ─────────

const GAV_ID = "892d7443-2b1b-4b0b-83e5-a0a477862234"

// Maps appointment.json instructor names → CoachFit user IDs.
// New instructors not yet in the DB will be created.
const INSTRUCTOR_BY_NAME: Record<string, string> = {
  "Gav Cunningham": "892d7443-2b1b-4b0b-83e5-a0a477862234",
  "Rory Stephens": "866eed7d-91b5-4dbb-b7d4-1421de65bf4a",
  "Clare Cuming": "7f133cf9-316d-4e39-8c68-c9d2599ac5fe",
  "Josh Bunting": "7c6db9b1-192a-437a-9e47-a258e223a5c2",
}

// ─── Appointment Shape ──────────────────────────────────────────────────────

interface Appointment {
  id: number
  name: string
  starts_at: string
  ends_at: string
  max_occupancy: number
  description?: string
  instructors?: { id: number; name: string; staff: number }[]
  active_registration_status?: {
    late_cancels_after?: string
    registrations_open_at?: string
  }
}

// ─── Seed Function ──────────────────────────────────────────────────────────

export async function seedClasses() {
  console.log("Seeding classes from appointments.json...\n")

  // ── Step 1: Read appointment data ──────────────────────────────────────

  const dataPath = path.resolve(__dirname, "../../research/appointments.json")
  if (!fs.existsSync(dataPath)) {
    console.error(`  File not found: ${dataPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(dataPath, "utf8")
  const data: { results: Appointment[] } = JSON.parse(raw)
  const appointments = data.results

  console.log(`  Loaded ${appointments.length} appointments`)

  // ── Step 2: Ensure instructors exist ───────────────────────────────────

  const uniqueInstructors = new Map<string, number>()
  for (const appt of appointments) {
    for (const inst of appt.instructors ?? []) {
      if (!uniqueInstructors.has(inst.name)) {
        uniqueInstructors.set(inst.name, inst.staff)
      }
    }
  }

  for (const [name, staffId] of uniqueInstructors) {
    if (INSTRUCTOR_BY_NAME[name]) continue // Already mapped

    // Check if user exists by name
    const existing = await prisma.user.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    })

    if (existing) {
      INSTRUCTOR_BY_NAME[name] = existing.id
      console.log(`  Found instructor: ${name} → ${existing.id}`)
    } else {
      // Create a new user for this instructor
      const newUser = await prisma.user.create({
        data: {
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@hitsona.com`,
          name,
          roles: ["COACH"],
        },
      })
      INSTRUCTOR_BY_NAME[name] = newUser.id
      console.log(`  Created instructor: ${name} → ${newUser.id}`)
    }
  }

  // ── Step 3: Delete existing sessions and bookings ──────────────────────

  const deletedBookings = await prisma.classBooking.deleteMany({})
  const deletedSessions = await prisma.classSession.deleteMany({})
  const deletedTemplates = await prisma.classTemplate.deleteMany({})

  console.log(`\n  Cleared: ${deletedTemplates.count} templates, ${deletedSessions.count} sessions, ${deletedBookings.count} bookings`)

  // ── Step 4: Create templates from unique class types ───────────────────

  const classTypes = [...new Set(appointments.map((a) => a.name))]
  const templates: Record<string, { id: string; capacity: number }> = {}

  for (const classType of classTypes) {
    // Get typical values from first appointment of this type
    const sample = appointments.find((a) => a.name === classType)!
    const startsAt = new Date(sample.starts_at)
    const endsAt = new Date(sample.ends_at)
    const durationMinutes = Math.round(
      (endsAt.getTime() - startsAt.getTime()) / (1000 * 60)
    )

    // Strip HTML tags from description
    const rawDesc = sample.description ?? ""
    const description = rawDesc.replace(/<[^>]*>/g, "").trim()

    // Derive cancel cutoff from registration status
    let cancelCutoffMinutes = 60
    if (sample.active_registration_status?.late_cancels_after) {
      const lateCancelAt = new Date(
        sample.active_registration_status.late_cancels_after
      )
      cancelCutoffMinutes = Math.round(
        (startsAt.getTime() - lateCancelAt.getTime()) / (1000 * 60)
      )
    }

    const template = await prisma.classTemplate.create({
      data: {
        ownerCoachId: GAV_ID,
        name: classType,
        classType: classType.toUpperCase(),
        description: description || `${durationMinutes}-minute ${classType} session`,
        locationLabel: "Hitsona Bangor",
        capacity: sample.max_occupancy,
        scope: "FACILITY",
        waitlistEnabled: true,
        waitlistCapacity: 5,
        bookingOpenHoursBefore: 336, // 14 days
        bookingCloseMinutesBefore: 0,
        cancelCutoffMinutes,
        creditsRequired: 1,
        isActive: true,
      },
    })

    templates[classType] = { id: template.id, capacity: sample.max_occupancy }
    console.log(
      `  Template: ${classType} (${durationMinutes}min, capacity ${sample.max_occupancy}, cutoff ${cancelCutoffMinutes}min) → ${template.id}`
    )
  }

  // ── Step 5: Create sessions ────────────────────────────────────────────

  let created = 0
  const countByType: Record<string, number> = {}

  for (const appt of appointments) {
    const template = templates[appt.name]
    if (!template) continue

    const instructorName = appt.instructors?.[0]?.name
    const instructorId = instructorName
      ? INSTRUCTOR_BY_NAME[instructorName] ?? GAV_ID
      : GAV_ID

    const capacityOverride =
      appt.max_occupancy !== template.capacity ? appt.max_occupancy : null

    await prisma.classSession.create({
      data: {
        classTemplateId: template.id,
        instructorId,
        startsAt: new Date(appt.starts_at),
        endsAt: new Date(appt.ends_at),
        capacityOverride,
        status: "SCHEDULED",
      },
    })

    created++
    countByType[appt.name] = (countByType[appt.name] ?? 0) + 1
  }

  // ── Summary ────────────────────────────────────────────────────────────

  const dates = appointments.map((a) => a.starts_at).sort()
  console.log(`\n  Created ${created} sessions:`)
  for (const [type, count] of Object.entries(countByType)) {
    console.log(`    ${type}: ${count}`)
  }
  console.log(
    `  Date range: ${dates[0]?.split("T")[0]} → ${dates[dates.length - 1]?.split("T")[0]}`
  )
  console.log(`\n  Instructors used:`)
  for (const [name, id] of Object.entries(INSTRUCTOR_BY_NAME)) {
    if (uniqueInstructors.has(name)) {
      console.log(`    ${name} → ${id}`)
    }
  }
  console.log("\n✅ Class seed complete!")
}

// ─── Run ────────────────────────────────────────────────────────────────────

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
