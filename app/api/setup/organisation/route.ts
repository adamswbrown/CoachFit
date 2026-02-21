import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"

const organisationSchema = z.object({
  organisationName: z.string().min(1, "Organisation name is required").max(100),
  timezone: z.string().min(1, "Timezone is required"),
  unitSystem: z.enum(["metric", "imperial"], {
    error: "Unit system must be metric or imperial",
  }),
})

/**
 * POST /api/setup/organisation
 * Save organisation configuration during setup.
 * Only accessible when setup is not complete.
 */
export async function POST(request: Request) {
  try {
    // Check if setup is already complete
    const settings = await db.systemSettings.findFirst({
      select: { id: true, setupComplete: true },
    })
    if (settings?.setupComplete) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 403 })
    }

    if (!settings) {
      return NextResponse.json(
        { error: "System settings not found. Complete database setup first." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = organisationSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { organisationName, timezone, unitSystem } = parsed.data

    await db.systemSettings.update({
      where: { id: settings.id },
      data: {
        organisationName,
        timezone,
        unitSystem,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Organisation settings saved",
    })
  } catch (error) {
    console.error("Error saving organisation settings:", error)
    return NextResponse.json(
      { error: "Failed to save organisation settings" },
      { status: 500 }
    )
  }
}
