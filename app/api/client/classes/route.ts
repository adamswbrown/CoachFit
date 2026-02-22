import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { BookingStatus, SessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { classSessionQuerySchema } from "@/lib/validations"
import { getClassBookingDefaults, getClientCreditSummary } from "@/lib/classes-service"
import { getEffectiveSessionCapacity, isBookingOpen, resolveBookingPolicy } from "@/lib/classes-policy"
import { getSessionOccupancyCounts } from "@/lib/classes-domain"
import { getSystemSettings } from "@/lib/system-settings"

const querySchema = classSessionQuerySchema.extend({
  includePast: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

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

    const searchParams = req.nextUrl.searchParams
    const parsed = querySchema.parse({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      cohortId: searchParams.get("cohortId") || undefined,
      classType: searchParams.get("classType") || undefined,
      includePast: searchParams.get("includePast") === "true",
    })

    const now = new Date()
    const windowStart = parsed.from
      ? new Date(parsed.from)
      : new Date(Date.now() - 60 * 60 * 1000)
    const windowEnd = parsed.to
      ? new Date(parsed.to)
      : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)

    const defaults = await getClassBookingDefaults()

    const sessions = await db.classSession.findMany({
      where: {
        status: SessionStatus.SCHEDULED,
        startsAt: {
          gte: parsed.includePast ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : windowStart,
          lte: windowEnd,
        },
        classTemplate: {
          isActive: true,
          ...(parsed.classType ? { classType: parsed.classType } : {}),
          ...(parsed.cohortId ? { cohortId: parsed.cohortId } : {}),
          OR: [
            { scope: "FACILITY" },
            {
              scope: "COHORT",
              cohort: {
                memberships: {
                  some: {
                    userId: session.user.id,
                  },
                },
              },
            },
          ],
        },
      },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        classTemplate: {
          include: {
            ownerCoach: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            cohort: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        bookings: {
          where: {
            status: {
              in: [
                BookingStatus.BOOKED,
                BookingStatus.WAITLISTED,
                BookingStatus.ATTENDED,
                BookingStatus.NO_SHOW,
              ],
            },
          },
          select: {
            id: true,
            clientId: true,
            status: true,
            waitlistPosition: true,
          },
        },
      },
      orderBy: {
        startsAt: "asc",
      },
      take: 400,
    })

    const sessionRows = sessions.map((row) => {
      const policy = resolveBookingPolicy(
        {
          bookingOpenHoursBefore: row.classTemplate.bookingOpenHoursBefore,
          bookingCloseMinutesBefore: row.classTemplate.bookingCloseMinutesBefore,
          cancelCutoffMinutes: row.classTemplate.cancelCutoffMinutes,
          waitlistCapacity: row.classTemplate.waitlistCapacity,
          capacity: row.classTemplate.capacity,
        },
        {
          bookingOpenHoursBefore: defaults.bookingOpenHoursDefault,
          bookingCloseMinutesBefore: defaults.bookingCloseMinutesDefault,
          cancelCutoffMinutes: defaults.lateCancelCutoffMinutesDefault,
          waitlistCapacity: defaults.defaultWaitlistCap,
          capacity: defaults.defaultClassCapacity,
        },
      )

      const { bookedCount, waitlistedCount } = getSessionOccupancyCounts(row.bookings)
      const capacity = getEffectiveSessionCapacity(row.classTemplate, {
        capacityOverride: row.capacityOverride,
      })

      const myBooking = row.bookings.find((booking) => booking.clientId === session.user.id) || null
      const bookingOpen = isBookingOpen(now, row.startsAt, policy)

      return {
        ...row,
        bookingOpen,
        bookedCount,
        waitlistedCount,
        capacity,
        myBooking,
        isFull: bookedCount >= capacity,
      }
    })

    const [creditSummary, products] = await Promise.all([
      getClientCreditSummary(session.user.id, now),
      db.creditProduct.findMany({
        where: {
          isActive: true,
          classEligible: true,
        },
        select: {
          id: true,
          name: true,
          creditMode: true,
          creditsPerPeriod: true,
          periodType: true,
          purchasePriceGbp: true,
          currency: true,
          appliesToClassTypes: true,
          purchasableByProviderOnly: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ])

    return NextResponse.json(
      {
        sessions: sessionRows,
        creditSummary,
        products,
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

    console.error("Error loading client classes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
