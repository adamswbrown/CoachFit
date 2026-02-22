import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { classSessionGenerateSchema } from "@/lib/validations"
import { logAuditAction } from "@/lib/audit-log"
import { getCoachAccessibleTemplateWhere } from "@/lib/classes-service"
import { z } from "zod"

function combineDateAndTimeUtc(date: Date, hhmm: string): Date {
  const [hoursRaw, minutesRaw] = hhmm.split(":")
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      0,
      0,
    ),
  )
}

async function hasTemplateAccess(templateId: string, user: { id: string; roles: any[] }) {
  if (isAdmin(user as any)) {
    return db.classTemplate.findUnique({ where: { id: templateId }, select: { id: true } })
  }

  return db.classTemplate.findFirst({
    where: {
      id: templateId,
      AND: [getCoachAccessibleTemplateWhere(user.id)],
    },
    select: { id: true },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const canAccess = await hasTemplateAccess(id, session.user)
    if (!canAccess) {
      return NextResponse.json({ error: "Class template not found" }, { status: 404 })
    }

    const from = req.nextUrl.searchParams.get("from")
    const to = req.nextUrl.searchParams.get("to")

    const sessions = await db.classSession.findMany({
      where: {
        classTemplateId: id,
        ...(from || to
          ? {
              startsAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  in: ["BOOKED", "WAITLISTED", "ATTENDED", "NO_SHOW"],
                },
              },
            },
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
    })

    return NextResponse.json({ sessions }, { status: 200 })
  } catch (error) {
    console.error("Error fetching class sessions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const canAccess = await hasTemplateAccess(id, session.user)
    if (!canAccess) {
      return NextResponse.json({ error: "Class template not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = classSessionGenerateSchema.parse(body)

    const startDate = new Date(parsed.startDate)
    const endDate = new Date(parsed.endDate)

    const existing = await db.classSession.findMany({
      where: {
        classTemplateId: id,
        startsAt: {
          gte: new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0)),
          lte: new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999)),
        },
      },
      select: {
        startsAt: true,
      },
    })

    const existingStartsAt = new Set(existing.map((row) => row.startsAt.toISOString()))

    const weekdays = new Set(parsed.weekdays)
    const toCreate: Array<{
      classTemplateId: string
      instructorId: string | null
      startsAt: Date
      endsAt: Date
      capacityOverride: number | null
    }> = []

    const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 0, 0, 0, 0))
    const finalDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 0, 0, 0, 0))

    while (cursor.getTime() <= finalDate.getTime()) {
      if (weekdays.has(cursor.getUTCDay())) {
        const startsAt = combineDateAndTimeUtc(cursor, parsed.startTime)
        const endsAt = new Date(startsAt.getTime() + parsed.durationMinutes * 60 * 1000)

        if (!existingStartsAt.has(startsAt.toISOString())) {
          toCreate.push({
            classTemplateId: id,
            instructorId: parsed.instructorId ?? null,
            startsAt,
            endsAt,
            capacityOverride: parsed.capacityOverride ?? null,
          })
        }
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    if (toCreate.length > 0) {
      await db.classSession.createMany({
        data: toCreate,
      })
    }

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_SESSION_GENERATE",
      targetType: "class_template",
      targetId: id,
      details: {
        createdCount: toCreate.length,
        skippedCount: existingStartsAt.size,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      },
    })

    return NextResponse.json(
      {
        createdCount: toCreate.length,
        skippedCount: Math.max(0, existingStartsAt.size),
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    console.error("Error generating class sessions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
