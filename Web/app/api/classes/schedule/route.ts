import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getAvailableSlots } from "@/lib/booking"
import { scheduleQuerySchema } from "@/lib/validations/booking"
import { z } from "zod"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const rawParams = {
      date: searchParams.get("date") ?? undefined,
      classType: searchParams.get("classType") ?? undefined,
    }

    const validated = scheduleQuerySchema.parse(rawParams)
    const date = new Date(validated.date)

    const slots = await getAvailableSlots(date, validated.classType)

    return NextResponse.json({ sessions: slots })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error fetching schedule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
