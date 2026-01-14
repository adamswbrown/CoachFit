import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { z } from "zod"

// Validation schema for settings updates
const settingsSchema = z.object({
  maxClientsPerCoach: z.number().int().min(5).max(200).optional(),
  minClientsPerCoach: z.number().int().min(1).max(50).optional(),
  recentActivityDays: z.number().int().min(1).max(90).optional(),
  lowEngagementEntries: z.number().int().min(1).max(30).optional(),
  noActivityDays: z.number().int().min(5).max(180).optional(),
  criticalNoActivityDays: z.number().int().min(10).max(365).optional(),
  shortTermWindowDays: z.number().int().min(1).max(30).optional(),
  longTermWindowDays: z.number().int().min(7).max(365).optional(),
})

/**
 * GET /api/admin/settings
 * Retrieve current system settings
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get or create default settings
    let settings = await db.systemSettings.findFirst()
    
    if (!settings) {
      settings = await db.systemSettings.create({
        data: {
          maxClientsPerCoach: 50,
          minClientsPerCoach: 10,
          recentActivityDays: 14,
          lowEngagementEntries: 7,
          noActivityDays: 14,
          criticalNoActivityDays: 30,
          shortTermWindowDays: 7,
          longTermWindowDays: 30,
        },
      })
    }

    return NextResponse.json({ data: settings }, { status: 200 })
  } catch (error) {
    console.error("Error fetching system settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/settings
 * Update system settings (admin only)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()

    // Validate input
    const validationResult = settingsSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Additional validation: min < max
    const { maxClientsPerCoach, minClientsPerCoach } = validationResult.data
    if (
      maxClientsPerCoach !== undefined &&
      minClientsPerCoach !== undefined &&
      minClientsPerCoach > maxClientsPerCoach
    ) {
      return NextResponse.json(
        { error: "minClientsPerCoach must be less than maxClientsPerCoach" },
        { status: 400 }
      )
    }

    // Get existing settings or create new
    let settings = await db.systemSettings.findFirst()
    
    if (!settings) {
      settings = await db.systemSettings.create({
        data: {
          ...validationResult.data,
          maxClientsPerCoach: maxClientsPerCoach ?? 50,
          minClientsPerCoach: minClientsPerCoach ?? 10,
          recentActivityDays: validationResult.data.recentActivityDays ?? 14,
          lowEngagementEntries: validationResult.data.lowEngagementEntries ?? 7,
          noActivityDays: validationResult.data.noActivityDays ?? 14,
          criticalNoActivityDays: validationResult.data.criticalNoActivityDays ?? 30,
          shortTermWindowDays: validationResult.data.shortTermWindowDays ?? 7,
          longTermWindowDays: validationResult.data.longTermWindowDays ?? 30,
        },
      })
    } else {
      settings = await db.systemSettings.update({
        where: { id: settings.id },
        data: validationResult.data,
      })
    }

    return NextResponse.json({ data: settings }, { status: 200 })
  } catch (error) {
    console.error("Error updating system settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
