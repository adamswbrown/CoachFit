import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { upsertEntrySchema } from "@/lib/validations"
import { Role } from "@prisma/client"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Defensive check: verify role is CLIENT
    if (!session.user.roles.includes(Role.CLIENT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = upsertEntrySchema.parse(body)

    // Convert date string to Date object and normalize to start of day
    const date = new Date(validated.date)
    date.setHours(0, 0, 0, 0)

    // Check for existing entry
    const existing = await db.entry.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date: date,
        },
      },
    })

    // Prepare update data - only include fields that were provided and are not NaN
    // Note: heightInches is not included as it's part of the user profile, not entries
    const updateData: {
      weightLbs?: number | null
      steps?: number | null
      calories?: number | null
      sleepQuality?: number | null
      perceivedEffort?: number | null
      notes?: string | null
      customResponses?: any
    } = {}

    if (validated.weightLbs !== undefined && !isNaN(validated.weightLbs)) {
      updateData.weightLbs = validated.weightLbs
    }
    if (validated.steps !== undefined && !isNaN(validated.steps)) {
      updateData.steps = validated.steps
    }
    if (validated.calories !== undefined && !isNaN(validated.calories)) {
      updateData.calories = validated.calories
    }
    if (validated.sleepQuality !== undefined && !isNaN(validated.sleepQuality)) {
      updateData.sleepQuality = validated.sleepQuality
    }
    if (validated.perceivedEffort !== undefined && !isNaN(validated.perceivedEffort)) {
      updateData.perceivedEffort = validated.perceivedEffort
    }
    if (validated.notes !== undefined) {
      updateData.notes = validated.notes || null
    }
    if ((validated as any).customResponses !== undefined) {
      updateData.customResponses = (validated as any).customResponses || null
    }

    // Check if we're updating or creating
    const isUpdate = !!existing

    let entry

    if (existing) {
      // UPDATE existing entry - only update provided fields (partial update)
      // Prisma's @updatedAt will handle updatedAt automatically
      entry = await db.entry.update({
        where: {
          id: existing.id,
        },
        data: updateData,
      })
    } else {
      // CREATE new entry - let database DEFAULT handle updatedAt
      // Prisma's @updatedAt only sets it on UPDATE, not CREATE
      // The database migration set DEFAULT CURRENT_TIMESTAMP for updatedAt
      entry = await db.entry.create({
        data: {
          userId: session.user.id,
          date: date,
          // Don't include updatedAt - let database DEFAULT handle it
          ...updateData,
        },
      })
    }

    return NextResponse.json(entry, { status: isUpdate ? 200 : 201 })
  } catch (error: any) {
    console.error("Error upserting entry:", error)
    console.error("Error details:", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    })

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Entry already exists for this date" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error", message: error?.message || "Unknown error" },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Defensive check: verify role is CLIENT
    if (!session.user.roles.includes(Role.CLIENT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const entries = await db.entry.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        date: "desc",
      },
      skip,
      take: limit,
    })

    return NextResponse.json(entries, { status: 200 })
  } catch (error) {
    console.error("Error fetching entries:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
