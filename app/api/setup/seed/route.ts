import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * POST /api/setup/seed
 * Seed the default SystemSettings row.
 * Only accessible when setup is not complete.
 */
export async function POST() {
  try {
    // Check if setup is already complete
    const existing = await db.systemSettings.findFirst({
      select: { id: true, setupComplete: true },
    })

    if (existing?.setupComplete) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 403 })
    }

    // If a row already exists (but setup not complete), skip seeding
    if (existing) {
      return NextResponse.json({
        success: true,
        message: "System settings already exist",
        seeded: false,
      })
    }

    // Create default system settings
    await db.systemSettings.create({
      data: {
        // All defaults from schema will be used
        setupComplete: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Default system settings created",
      seeded: true,
    })
  } catch (error) {
    console.error("Error seeding system settings:", error)
    return NextResponse.json(
      { error: "Failed to seed system settings" },
      { status: 500 }
    )
  }
}
