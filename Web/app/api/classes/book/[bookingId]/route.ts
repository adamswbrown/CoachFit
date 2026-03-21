import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { cancelBooking } from "@/lib/booking"
import { db } from "@/lib/db"
import { z } from "zod"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { bookingId } = await params

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 })
    }

    // Verify ownership: booking must belong to current user, or user must be admin/coach
    const existing = await db.classBooking.findUnique({
      where: { id: bookingId },
      select: { clientId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const isOwner = existing.clientId === session.user.id
    const hasElevatedAccess = isAdminOrCoach(session.user)

    if (!isOwner && !hasElevatedAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await cancelBooking(bookingId, session.user.id)

    await logAuditAction({
      actor: session.user,
      actionType: "BOOKING_CANCEL",
      targetType: "class_booking",
      targetId: bookingId,
      details: {
        newStatus: result.booking.status,
        refunded: result.refunded,
        cancelledByUserId: session.user.id,
        clientId: existing.clientId,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    if (
      error instanceof Error &&
      (error.message.includes("Cannot cancel") ||
        error.message.includes("Booking not found"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error cancelling booking:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
