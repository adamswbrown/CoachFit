/**
 * Business logic for managing class templates and sessions (coach/admin).
 */

import { db } from "@/lib/db"

export type ClassSessionResult = {
  id: string
  classTemplateId: string
  instructorId: string | null
  startsAt: Date
  endsAt: Date
  status: string
  capacityOverride: number | null
  cancelReason: string | null
  createdAt: Date
}

/**
 * Create a single class session from a template.
 * Duration defaults to 25 minutes (Hitsona standard) unless overridden.
 */
export async function createClassSession(
  templateId: string,
  startsAt: Date,
  instructorId?: string,
  durationMinutes: number = 25
): Promise<ClassSessionResult> {
  // Verify template exists and is active
  const template = await db.classTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, isActive: true },
  })

  if (!template) {
    throw new Error("Class template not found")
  }

  if (!template.isActive) {
    throw new Error("Class template is not active")
  }

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000)

  const session = await db.classSession.create({
    data: {
      classTemplateId: templateId,
      instructorId: instructorId ?? null,
      startsAt,
      endsAt,
      status: "SCHEDULED",
    },
  })

  return session
}

export type BulkCreateResult = {
  created: number
  skipped: number
}

/**
 * Bulk-create recurring class sessions between two dates.
 *
 * For each day in [startDate, endDate], checks if the day of week matches any
 * pattern entry and creates a session for that time. Skips if a session already
 * exists for the same template and startsAt timestamp.
 */
export async function bulkCreateSessions(
  templateId: string,
  startDate: Date,
  endDate: Date,
  recurrencePattern: {
    dayOfWeek: number // 0 = Sunday, 6 = Saturday
    startTime: string // "HH:mm"
    instructorId?: string
  }[],
  durationMinutes: number = 25
): Promise<BulkCreateResult> {
  // Verify template
  const template = await db.classTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, isActive: true },
  })

  if (!template) {
    throw new Error("Class template not found")
  }

  let created = 0
  let skipped = 0

  // Iterate each day in the range
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  while (current <= end) {
    const dayOfWeek = current.getDay()

    for (const pattern of recurrencePattern) {
      if (pattern.dayOfWeek !== dayOfWeek) continue

      // Parse "HH:mm"
      const [hours, minutes] = pattern.startTime.split(":").map(Number)
      const startsAt = new Date(current)
      startsAt.setHours(hours, minutes, 0, 0)

      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000)

      // Check for existing session at this exact template + startsAt
      const existing = await db.classSession.findFirst({
        where: {
          classTemplateId: templateId,
          startsAt,
        },
        select: { id: true },
      })

      if (existing) {
        skipped++
        continue
      }

      await db.classSession.create({
        data: {
          classTemplateId: templateId,
          instructorId: pattern.instructorId ?? null,
          startsAt,
          endsAt,
          status: "SCHEDULED",
        },
      })
      created++
    }

    // Advance by one day
    current.setDate(current.getDate() + 1)
  }

  return { created, skipped }
}

export type ScheduleSession = {
  id: string
  startsAt: Date
  endsAt: Date
  status: string
  capacityOverride: number | null
  cancelReason: string | null
  classTemplate: {
    id: string
    name: string
    classType: string
    capacity: number
    creditsRequired: number
  }
  instructor: {
    id: string
    name: string | null
    image: string | null
  } | null
  _count: { bookings: number }
}

/**
 * Fetch all sessions in a date range for schedule views (coach/admin).
 */
export async function getSchedule(
  startDate: Date,
  endDate: Date
): Promise<ScheduleSession[]> {
  const sessions = await db.classSession.findMany({
    where: {
      startsAt: { gte: startDate, lte: endDate },
    },
    include: {
      classTemplate: {
        select: {
          id: true,
          name: true,
          classType: true,
          capacity: true,
          creditsRequired: true,
        },
      },
      instructor: {
        select: { id: true, name: true, image: true },
      },
      _count: {
        select: { bookings: true },
      },
    },
    orderBy: { startsAt: "asc" },
  })

  return sessions.map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    status: s.status,
    capacityOverride: s.capacityOverride,
    cancelReason: s.cancelReason,
    classTemplate: {
      id: s.classTemplate.id,
      name: s.classTemplate.name,
      classType: s.classTemplate.classType,
      capacity: s.classTemplate.capacity,
      creditsRequired: s.classTemplate.creditsRequired,
    },
    instructor: s.instructor
      ? { id: s.instructor.id, name: s.instructor.name, image: s.instructor.image }
      : null,
    _count: { bookings: s._count.bookings },
  }))
}
