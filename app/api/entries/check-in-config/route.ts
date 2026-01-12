import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!session.user.roles.includes(Role.CLIENT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get client's cohort membership - just get the cohortId, no need for relation
    const membership = await db.cohortMembership.findFirst({
      where: { userId: session.user.id },
      select: {
        cohortId: true,
      },
    })

    if (!membership || !membership.cohortId) {
      // Client not in any cohort - return default config (all fields enabled)
      return NextResponse.json(
        {
          cohortId: null,
          config: null,
          enabledPrompts: ["sleepQuality", "perceivedEffort", "notes"], // Default enabled
          customPrompt1: null,
          customPrompt1Type: null,
        },
        { status: 200 }
      )
    }

    // Fetch check-in config directly using cohort ID
    // Use findUnique with proper error handling
    let config = null
    try {
      config = await db.cohortCheckInConfig.findUnique({
        where: { cohortId: membership.cohortId },
      })
    } catch (configError) {
      // If config doesn't exist or query fails, use defaults (not a critical error)
      console.warn("Could not fetch check-in config, using defaults:", configError)
      config = null
    }

    return NextResponse.json(
      {
        cohortId: membership.cohortId,
        config: config,
        enabledPrompts: config?.enabledPrompts || ["sleepQuality", "perceivedEffort", "notes"],
        customPrompt1: config?.customPrompt1 || null,
        customPrompt1Type: config?.customPrompt1Type || null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error fetching check-in config:", error)
    console.error("Error details:", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: "Internal server error", message: error?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
