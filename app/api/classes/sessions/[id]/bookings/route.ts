import { NextRequest, NextResponse } from "next/server"
import { BookingSource } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { coachCreateBookingSchema } from "@/lib/validations"
import { logAuditAction } from "@/lib/audit-log"
import { isInteractiveTransactionNotFoundError } from "@/lib/db-errors"
import {
  bookClientIntoSessionTx,
  getClassBookingDefaults,
  getCoachAccessibleSessionWhere,
  isClassBookingError,
  sendBookingNotifications,
} from "@/lib/classes-service"

async function getAccessibleSession(sessionId: string, user: { id: string; roles: any[] }) {
  if (isAdmin(user as any)) {
    return db.classSession.findUnique({ where: { id: sessionId }, select: { id: true } })
  }

  return db.classSession.findFirst({
    where: {
      id: sessionId,
      AND: [getCoachAccessibleSessionWhere(user.id)],
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

    const canAccess = await getAccessibleSession(id, session.user)
    if (!canAccess) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const bookings = await db.classBooking.findMany({
      where: {
        sessionId: id,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ bookings }, { status: 200 })
  } catch (error) {
    console.error("Error loading bookings:", error)
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

    const canAccess = await getAccessibleSession(id, session.user)
    if (!canAccess) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = coachCreateBookingSchema.parse(body)
    const defaults = await getClassBookingDefaults()

    const bookingInput = {
      sessionId: id,
      clientId: parsed.clientId,
      source: isAdmin(session.user) ? BookingSource.ADMIN : BookingSource.COACH,
      actorUserId: session.user.id,
      skipCreditValidation: parsed.skipCreditValidation,
      enforceBookingWindow: false,
      settingsDefaults: defaults,
    }

    let result
    try {
      result = await db.$transaction((tx) => bookClientIntoSessionTx(tx, bookingInput))
    } catch (txError) {
      if (!isInteractiveTransactionNotFoundError(txError)) {
        throw txError
      }
      result = await bookClientIntoSessionTx(db as any, bookingInput)
    }

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_BOOKING_CREATE",
      targetType: "class_session",
      targetId: id,
      details: {
        clientId: parsed.clientId,
        result: result.result,
      },
    })

    await sendBookingNotifications({
      actor: session.user,
      result: result,
      timezone: defaults.bookingTimezone,
    })

    const status = result.result === "booked" || result.result === "waitlisted" ? 201 : 200
    return NextResponse.json({ booking: result.booking, result: result.result }, { status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    if (isClassBookingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    console.error("Error creating booking:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
