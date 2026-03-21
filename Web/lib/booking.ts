/**
 * Business logic for class booking.
 *
 * Credit debits and refunds are performed inline within the same db.$transaction()
 * as the booking mutation. This ensures atomicity — a failed booking creation
 * cannot leave an orphaned credit debit, and a failed credit debit rolls back
 * the booking record.
 *
 * Pattern mirrors credits.ts (ensureCreditAccount + conditional updateMany) but
 * runs inside the caller's transaction client so nesting is avoided.
 */

import { db } from "@/lib/db"
import { BookingSource, BookingStatus, CreditLedgerReason } from "@prisma/client"
import type { Prisma } from "@prisma/client"

// ---------------------------------------------------------------------------
// Internal helpers (replicate credits.ts pattern inside a tx)
// ---------------------------------------------------------------------------

async function ensureCreditAccountTx(
  tx: Prisma.TransactionClient,
  clientId: string
): Promise<void> {
  await tx.clientCreditAccount.upsert({
    where: { clientId },
    update: {},
    create: { clientId, balance: 0 },
  })
}

async function debitCreditsTx(
  tx: Prisma.TransactionClient,
  clientId: string,
  amount: number,
  bookingId: string
): Promise<void> {
  await ensureCreditAccountTx(tx, clientId)

  const result = await tx.clientCreditAccount.updateMany({
    where: { clientId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  })

  if (result.count === 0) {
    const account = await tx.clientCreditAccount.findUnique({
      where: { clientId },
      select: { balance: true },
    })
    throw new Error(
      `Insufficient credits: balance ${account?.balance ?? 0}, requested ${amount}`
    )
  }

  await tx.clientCreditLedger.create({
    data: {
      clientId,
      deltaCredits: -amount,
      reason: CreditLedgerReason.BOOKING_DEBIT,
      bookingId,
    },
  })
}

async function refundCreditsTx(
  tx: Prisma.TransactionClient,
  clientId: string,
  amount: number,
  bookingId: string
): Promise<void> {
  await ensureCreditAccountTx(tx, clientId)

  await tx.clientCreditAccount.update({
    where: { clientId },
    data: { balance: { increment: amount } },
  })

  await tx.clientCreditLedger.create({
    data: {
      clientId,
      deltaCredits: amount,
      reason: CreditLedgerReason.REFUND,
      bookingId,
    },
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type CreateBookingResult = {
  id: string
  sessionId: string
  clientId: string
  status: BookingStatus
  source: BookingSource
  createdAt: Date
}

/**
 * Book a client into a class session.
 *
 * Validates booking window, capacity, and duplicate bookings, then atomically
 * creates the ClassBooking and debits the required credits.
 */
export async function createBooking(
  clientId: string,
  sessionId: string,
  source: BookingSource = BookingSource.CLIENT,
  bookedByUserId?: string
): Promise<CreateBookingResult> {
  return db.$transaction(async (tx) => {
    // 1. Fetch session with template and current confirmed booking count
    const session = await tx.classSession.findUnique({
      where: { id: sessionId },
      include: {
        classTemplate: true,
        _count: {
          select: {
            bookings: { where: { status: BookingStatus.BOOKED } },
          },
        },
      },
    })

    if (!session) {
      throw new Error("Class session not found")
    }

    // 2. Session must be schedulable
    if (session.status !== "SCHEDULED") {
      throw new Error("Class session is not available for booking")
    }

    const template = session.classTemplate
    const now = new Date()

    // 3. Booking window: must be within bookingOpenHoursBefore of now
    const openFrom = new Date(
      session.startsAt.getTime() - template.bookingOpenHoursBefore * 60 * 60 * 1000
    )
    if (now < openFrom) {
      throw new Error("Booking window is not yet open for this class")
    }

    // 4. Booking cutoff: must be more than bookingCloseMinutesBefore before start
    const closeAt = new Date(
      session.startsAt.getTime() - template.bookingCloseMinutesBefore * 60 * 1000
    )
    if (now >= closeAt) {
      throw new Error("Booking window has closed for this class")
    }

    // 5. No duplicate booking for this client + session
    const existingBooking = await tx.classBooking.findUnique({
      where: {
        sessionId_clientId: { sessionId, clientId },
      },
    })
    if (existingBooking) {
      if (existingBooking.status === BookingStatus.BOOKED) {
        throw new Error("You are already booked into this class")
      }
      if (existingBooking.status === BookingStatus.WAITLISTED) {
        throw new Error("You are already on the waitlist for this class")
      }
      // Cancelled booking — allow re-booking by falling through
    }

    // 6. Check capacity
    const effectiveCapacity = session.capacityOverride ?? template.capacity
    const confirmedBookings = session._count.bookings

    if (confirmedBookings >= effectiveCapacity) {
      throw new Error("Class is full")
    }

    // 7. Create booking (upsert handles the case where a cancelled booking exists)
    const booking = existingBooking
      ? await tx.classBooking.update({
          where: { id: existingBooking.id },
          data: {
            status: BookingStatus.BOOKED,
            source,
            bookedByUserId: bookedByUserId ?? null,
            canceledAt: null,
          },
        })
      : await tx.classBooking.create({
          data: {
            sessionId,
            clientId,
            status: BookingStatus.BOOKED,
            source,
            bookedByUserId: bookedByUserId ?? null,
          },
        })

    // 8. Debit credits atomically in the same transaction
    await debitCreditsTx(tx, clientId, template.creditsRequired, booking.id)

    return {
      id: booking.id,
      sessionId: booking.sessionId,
      clientId: booking.clientId,
      status: booking.status,
      source: booking.source,
      createdAt: booking.createdAt,
    }
  })
}

export type CancelBookingResult = {
  booking: {
    id: string
    status: BookingStatus
    canceledAt: Date | null
  }
  refunded: boolean
}

/**
 * Cancel a booking.
 *
 * If cancelled before the cutoff window: status → CANCELLED, credits refunded.
 * If cancelled after the cutoff:         status → LATE_CANCEL, no refund.
 */
export async function cancelBooking(
  bookingId: string,
  cancelledByUserId: string
): Promise<CancelBookingResult> {
  return db.$transaction(async (tx) => {
    const booking = await tx.classBooking.findUnique({
      where: { id: bookingId },
      include: {
        session: {
          include: { classTemplate: true },
        },
      },
    })

    if (!booking) {
      throw new Error("Booking not found")
    }

    if (booking.status !== BookingStatus.BOOKED) {
      throw new Error(`Cannot cancel a booking with status: ${booking.status}`)
    }

    const now = new Date()
    const cutoffAt = new Date(
      booking.session.startsAt.getTime() -
        booking.session.classTemplate.cancelCutoffMinutes * 60 * 1000
    )

    const isBeforeCutoff = now < cutoffAt
    const newStatus = isBeforeCutoff ? BookingStatus.CANCELLED : BookingStatus.LATE_CANCEL
    const canceledAt = new Date()

    const updated = await tx.classBooking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        canceledAt,
      },
    })

    // Refund credits only for on-time cancellations
    if (isBeforeCutoff) {
      await refundCreditsTx(
        tx,
        booking.clientId,
        booking.session.classTemplate.creditsRequired,
        bookingId
      )
    }

    return {
      booking: {
        id: updated.id,
        status: updated.status,
        canceledAt: updated.canceledAt,
      },
      refunded: isBeforeCutoff,
    }
  })
}

export type SessionSlot = {
  id: string
  startsAt: Date
  endsAt: Date
  status: string
  capacityOverride: number | null
  classTemplate: {
    id: string
    name: string
    classType: string
    capacity: number
    creditsRequired: number
    cancelCutoffMinutes: number
  }
  instructor: {
    id: string
    name: string | null
    image: string | null
  } | null
  _count: { bookings: number }
  spotsRemaining: number
}

/**
 * Get available class sessions for a given date.
 *
 * Returns sessions that are SCHEDULED and within their booking window.
 * Each session includes a computed spotsRemaining field.
 */
export async function getAvailableSlots(
  date: Date,
  classType?: string
): Promise<SessionSlot[]> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const now = new Date()

  const sessions = await db.classSession.findMany({
    where: {
      startsAt: { gte: startOfDay, lte: endOfDay, gt: now },
      status: "SCHEDULED",
      ...(classType ? { classTemplate: { classType } } : {}),
    },
    include: {
      classTemplate: {
        select: {
          id: true,
          name: true,
          classType: true,
          capacity: true,
          creditsRequired: true,
          cancelCutoffMinutes: true,
          bookingOpenHoursBefore: true,
        },
      },
      instructor: {
        select: { id: true, name: true, image: true },
      },
      _count: {
        select: {
          bookings: { where: { status: BookingStatus.BOOKED } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  })

  return sessions.map((session) => {
    const effectiveCapacity = session.capacityOverride ?? session.classTemplate.capacity
    const confirmedBookings = session._count.bookings
    const spotsRemaining = Math.max(0, effectiveCapacity - confirmedBookings)

    return {
      id: session.id,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      status: session.status,
      capacityOverride: session.capacityOverride,
      classTemplate: {
        id: session.classTemplate.id,
        name: session.classTemplate.name,
        classType: session.classTemplate.classType,
        capacity: session.classTemplate.capacity,
        creditsRequired: session.classTemplate.creditsRequired,
        cancelCutoffMinutes: session.classTemplate.cancelCutoffMinutes,
      },
      instructor: session.instructor
        ? {
            id: session.instructor.id,
            name: session.instructor.name,
            image: session.instructor.image,
          }
        : null,
      _count: { bookings: confirmedBookings },
      spotsRemaining,
    }
  })
}

export type ClientBooking = {
  id: string
  status: BookingStatus
  createdAt: Date
  session: {
    id: string
    startsAt: Date
    endsAt: Date
    classTemplate: { name: string; classType: string }
    instructor: { name: string | null } | null
  }
}

/**
 * Get bookings for a client, optionally filtered by status.
 */
export async function getClientBookings(
  clientId: string,
  status?: BookingStatus
): Promise<ClientBooking[]> {
  const bookings = await db.classBooking.findMany({
    where: {
      clientId,
      ...(status ? { status } : {}),
    },
    include: {
      session: {
        include: {
          classTemplate: {
            select: { name: true, classType: true },
          },
          instructor: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { session: { startsAt: "desc" } },
  })

  return bookings.map((b) => ({
    id: b.id,
    status: b.status,
    createdAt: b.createdAt,
    session: {
      id: b.session.id,
      startsAt: b.session.startsAt,
      endsAt: b.session.endsAt,
      classTemplate: {
        name: b.session.classTemplate.name,
        classType: b.session.classTemplate.classType,
      },
      instructor: b.session.instructor
        ? { name: b.session.instructor.name }
        : null,
    },
  }))
}
