import { NextRequest, NextResponse } from "next/server"
import { BookingSource, BookingStatus } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { bookingAttendanceUpdateSchema } from "@/lib/validations"
import { logAuditAction } from "@/lib/audit-log"
import { isInteractiveTransactionNotFoundError } from "@/lib/db-errors"
import {
  cancelBookingTx,
  getClassBookingDefaults,
  getCoachAccessibleSessionWhere,
  isClassBookingError,
  sendBookingNotifications,
} from "@/lib/classes-service"

const patchSchema = bookingAttendanceUpdateSchema
  .partial()
  .extend({
    action: z.enum(["CANCEL"]).optional(),
    reason: z.string().max(500).optional(),
  })

export async function PATCH(
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

    const booking = await db.classBooking.findUnique({
      where: { id },
      include: {
        session: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (!isAdmin(session.user)) {
      const accessible = await db.classSession.findFirst({
        where: {
          id: booking.sessionId,
          AND: [getCoachAccessibleSessionWhere(session.user.id)],
        },
        select: { id: true },
      })

      if (!accessible) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const body = await req.json()
    const parsed = patchSchema.parse(body)

    const defaults = await getClassBookingDefaults()

    const shouldCancel =
      parsed.action === "CANCEL" ||
      parsed.status === BookingStatus.CANCELLED ||
      parsed.status === BookingStatus.LATE_CANCEL

    if (shouldCancel) {
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
        result = await cancelBookingTx(db as any, cancelInput)
      }

      await logAuditAction({
        actor: session.user,
        actionType: "CLASS_BOOKING_CANCEL",
        targetType: "class_booking",
        targetId: id,
        details: {
          lateCancel: result.lateCancel,
          promotedCount: result.promoted.length,
          source: isAdmin(session.user) ? BookingSource.ADMIN : BookingSource.COACH,
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
    }

    if (!parsed.status) {
      return NextResponse.json(
        { error: "Either status or cancel action is required" },
        { status: 400 },
      )
    }

    const updated = await db.classBooking.update({
      where: { id },
      data: {
        status: parsed.status,
        attendanceMarkedAt: new Date(),
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
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_BOOKING_ATTENDANCE_UPDATE",
      targetType: "class_booking",
      targetId: id,
      details: {
        status: parsed.status,
      },
    })

    return NextResponse.json({ booking: updated }, { status: 200 })
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

    console.error("Error updating booking:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
