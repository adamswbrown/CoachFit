import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { userPreferenceSchema } from "@/lib/validations"
import { NextResponse } from "next/server"

/**
 * POST /api/onboarding/preferences
 * Updates user's unit and date format preferences without requiring full onboarding re-run
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isClient(session.user)) {
    return NextResponse.json({ error: "Only clients can view preferences" }, { status: 403 })
  }

  try {
    const preference = await db.userPreference.findUnique({
      where: { userId: session.user.id },
    })

    return NextResponse.json({
      data: {
        preference: preference ?? {
          userId: session.user.id,
          weightUnit: "lbs",
          measurementUnit: "inches",
          dateFormat: "MM/dd/yyyy",
        },
      },
    })
  } catch (error) {
    console.error("Error fetching preferences:", error)
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isClient(session.user)) {
    return NextResponse.json({ error: "Only clients can update preferences" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = userPreferenceSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    const preference = await db.userPreference.upsert({
      where: { userId: session.user.id },
      update: {
        weightUnit: data.weightUnit,
        measurementUnit: data.measurementUnit,
        dateFormat: data.dateFormat,
      },
      create: {
        userId: session.user.id,
        weightUnit: data.weightUnit,
        measurementUnit: data.measurementUnit,
        dateFormat: data.dateFormat,
      },
    })

    return NextResponse.json({
      data: {
        message: "Preferences updated successfully",
        preference,
      },
    })
  } catch (error) {
    console.error("Error updating preferences:", error)
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    )
  }
}
