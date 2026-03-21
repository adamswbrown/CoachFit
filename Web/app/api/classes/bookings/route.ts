import { NextRequest, NextResponse } from "next/server"
import { getSessionWithMobile } from "@/lib/auth-mobile"
import { getClientBookings } from "@/lib/booking"
import { clientBookingsQuerySchema } from "@/lib/validations/booking"
import { BookingStatus } from "@prisma/client"
import { z } from "zod"

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionWithMobile()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const rawParams = {
      status: searchParams.get("status") ?? undefined,
    }

    const validated = clientBookingsQuerySchema.parse(rawParams)

    const bookings = await getClientBookings(
      session.user.id,
      validated.status as BookingStatus | undefined
    )

    return NextResponse.json({ bookings })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error fetching bookings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
