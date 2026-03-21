import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { db } from "@/lib/db"
import { z } from "zod"

const attendanceSchema = z.object({
  bookingId: z.string(),
  status: z.enum(["ATTENDED", "NO_SHOW", "BOOKED"]),
})

// GET - list bookings for a session (for attendance view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { sessionId } = await params

    const classSession = await db.classSession.findUnique({
      where: { id: sessionId },
      include: {
        bookings: {
          where: { status: { in: ["BOOKED", "ATTENDED", "NO_SHOW"] } },
          include: {
            client: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        classTemplate: { select: { name: true } },
      },
    })

    if (!classSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({
      sessionId,
      className: classSession.classTemplate.name,
      startsAt: classSession.startsAt,
      status: classSession.status,
      bookings: classSession.bookings.map((b) => ({
        id: b.id,
        clientId: b.clientId,
        clientName: b.client.name,
        clientEmail: b.client.email,
        status: b.status,
        attendanceMarkedAt: b.attendanceMarkedAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching attendance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - mark attendance for a booking
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { sessionId } = await params
    const body = await req.json()
    const validated = attendanceSchema.parse(body)

    const booking = await db.classBooking.findFirst({
      where: { id: validated.bookingId, sessionId },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const updated = await db.classBooking.update({
      where: { id: validated.bookingId },
      data: {
        status: validated.status,
        attendanceMarkedAt: validated.status === "BOOKED" ? null : new Date(),
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "ATTENDANCE_MARKED",
      targetType: "class_booking",
      targetId: validated.bookingId,
      details: { sessionId, status: validated.status, clientId: booking.clientId },
    })

    return NextResponse.json({ booking: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.issues }, { status: 400 })
    }
    console.error("Error marking attendance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
