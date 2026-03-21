import { NextRequest, NextResponse } from "next/server"
import { getSessionWithMobile } from "@/lib/auth-mobile"
import { logAuditAction } from "@/lib/audit-log"
import { createBooking } from "@/lib/booking"
import { bookClassSchema } from "@/lib/validations/booking"
import { z } from "zod"

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionWithMobile()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validated = bookClassSchema.parse(body)

    const booking = await createBooking(session.user.id, validated.sessionId)

    await logAuditAction({
      actor: session.user,
      actionType: "BOOKING_CREATE",
      targetType: "class_booking",
      targetId: booking.id,
      details: {
        sessionId: validated.sessionId,
        clientId: session.user.id,
      },
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    if (
      error instanceof Error &&
      (error.message.includes("Insufficient credits") ||
        error.message.includes("already booked") ||
        error.message.includes("already on the waitlist") ||
        error.message.includes("Class is full") ||
        error.message.includes("Booking window") ||
        error.message.includes("not available for booking"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error creating booking:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
