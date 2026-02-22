import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { clientCancelBookingSchema } from "@/lib/validations"
import {
  cancelBookingTx,
  getClassBookingDefaults,
  isClassBookingError,
  sendBookingNotifications,
} from "@/lib/classes-service"
import { logAuditAction } from "@/lib/audit-log"
import { isInteractiveTransactionNotFoundError } from "@/lib/db-errors"
import { z } from "zod"

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

    const booking = await db.classBooking.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
      },
    })

    if (!booking || booking.clientId !== session.user.id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = clientCancelBookingSchema.parse(body)

    const defaults = await getClassBookingDefaults()

    const cancelInput = {
      bookingId: id,
      actorUserId: session.user.id,
      settingsDefaults: defaults,
    }

    let result
    try {
      result = await db.$transaction((tx) => cancelBookingTx(tx, cancelInput))
    } catch (txError) {
      if (!isInteractiveTransactionNotFoundError(txError)) {
        throw txError
      }

      // Fallback for pooled/dev DBs where interactive transactions can drop mid-flow.
      result = await cancelBookingTx(db as any, cancelInput)
    }

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_CLIENT_CANCEL",
      targetType: "class_booking",
      targetId: id,
      details: {
        lateCancel: result.lateCancel,
        promotedCount: result.promoted.length,
        reason: parsed.reason || null,
      },
    })

    await sendBookingNotifications({
      actor: session.user,
      result: null,
      cancelledBooking: result.booking,
      promotedBookings: result.promoted,
      timezone: defaults.bookingTimezone,
    })

    return NextResponse.json(
      {
        booking: result.booking,
        promotedBookings: result.promoted,
        lateCancel: result.lateCancel,
      },
      { status: 200 },
    )
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

    console.error("Error cancelling class booking:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
