import { NextRequest, NextResponse } from "next/server"
import { BookingSource } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { getClassBookingDefaults, isClassBookingError, bookClientIntoSessionTx, sendBookingNotifications } from "@/lib/classes-service"
import { getSystemSettings } from "@/lib/system-settings"
import { logAuditAction } from "@/lib/audit-log"
import { isInteractiveTransactionNotFoundError } from "@/lib/db-errors"

async function findAccessibleSession(sessionId: string, clientId: string) {
  return db.classSession.findFirst({
    where: {
      id: sessionId,
      status: "SCHEDULED",
      classTemplate: {
        isActive: true,
        OR: [
          { scope: "FACILITY" },
          {
            scope: "COHORT",
            cohort: {
              memberships: {
                some: {
                  userId: clientId,
                },
              },
            },
          },
        ],
      },
    },
    select: {
      id: true,
    },
  })
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

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const systemSettings = await getSystemSettings()
    if (!systemSettings.classBookingEnabled) {
      return NextResponse.json(
        { error: "Class booking is currently disabled", code: "CLASS_BOOKING_DISABLED" },
        { status: 403 },
      )
    }

    const allowed = await findAccessibleSession(id, session.user.id)
    if (!allowed) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const defaults = await getClassBookingDefaults()

    const bookingInput = {
      sessionId: id,
      clientId: session.user.id,
      source: BookingSource.CLIENT,
      actorUserId: session.user.id,
      skipCreditValidation: false,
      enforceBookingWindow: true,
      settingsDefaults: defaults,
    }

    let bookingResult
    try {
      bookingResult = await db.$transaction((tx) => bookClientIntoSessionTx(tx, bookingInput))
    } catch (txError) {
      if (!isInteractiveTransactionNotFoundError(txError)) {
        throw txError
      }

      // Fallback for pooled/dev DBs where interactive transactions can drop mid-flow.
      bookingResult = await bookClientIntoSessionTx(db as any, bookingInput)
    }

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_CLIENT_BOOK",
      targetType: "class_session",
      targetId: id,
      details: {
        result: bookingResult.result,
      },
    })

    await sendBookingNotifications({
      actor: session.user,
      result: bookingResult,
      timezone: defaults.bookingTimezone,
    })

    const message =
      bookingResult.result === "booked"
        ? "Booked"
        : bookingResult.result === "waitlisted"
          ? "Added to waitlist"
          : "Booking already exists"

    return NextResponse.json(
      {
        booking: bookingResult.booking,
        result: bookingResult.result,
        message,
      },
      { status: bookingResult.result === "already_exists" ? 200 : 201 },
    )
  } catch (error) {
    if (isClassBookingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    console.error("Error booking class session:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
