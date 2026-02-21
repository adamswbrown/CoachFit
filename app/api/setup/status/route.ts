import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/setup/status
 * Check if the application setup is complete.
 * This endpoint is always accessible (no auth required).
 */
export async function GET() {
  try {
    const settings = await db.systemSettings.findFirst({
      select: { setupComplete: true },
    })

    // No settings row = fresh install = not complete
    if (!settings) {
      return NextResponse.json({ setupComplete: false })
    }

    const response = NextResponse.json({
      setupComplete: settings.setupComplete,
    })

    // If setup is complete, set the cookie so middleware doesn't redirect
    if (settings.setupComplete) {
      response.cookies.set("coachfit_setup_complete", "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      })
    }

    return response
  } catch (error) {
    console.error("Error checking setup status:", error)
    // If we can't check (e.g., DB not connected), assume not complete
    return NextResponse.json({ setupComplete: false })
  }
}
