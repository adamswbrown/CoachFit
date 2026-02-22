import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * POST /api/setup/complete
 * Mark setup as complete. Sets the database flag and the cookie.
 * Only accessible when setup is not complete.
 */
export async function POST() {
  try {
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

    // Verify at least one admin user exists
    const adminCount = await db.user.count({
      where: {
        roles: { has: "ADMIN" },
      },
    })

    if (adminCount === 0) {
      return NextResponse.json(
        { error: "At least one admin user must be created before completing setup." },
        { status: 400 }
      )
    }

    // Mark setup as complete
    await db.systemSettings.update({
      where: { id: settings.id },
      data: { setupComplete: true },
    })

    const response = NextResponse.json({
      success: true,
      message: "Setup complete! Redirecting to login...",
    })

    // Set the cookie so middleware allows access
    response.cookies.set("coachfit_setup_complete", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    return response
  } catch (error) {
    console.error("Error completing setup:", error)
    return NextResponse.json(
      { error: "Failed to complete setup" },
      { status: 500 }
    )
  }
}
