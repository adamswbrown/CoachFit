import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { z } from "zod"

const DEFAULT_SETTINGS = {
  maxClientsPerCoach: 50,
  minClientsPerCoach: 10,
  recentActivityDays: 14,
  lowEngagementEntries: 7,
  noActivityDays: 14,
  criticalNoActivityDays: 30,
  shortTermWindowDays: 7,
  longTermWindowDays: 30,
  adminOverrideEmail: null,
  healthkitEnabled: true,
  iosIntegrationEnabled: true,
  adherenceGreenMinimum: 6,
  adherenceAmberMinimum: 3,
}

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
  adminOverrideEmail: z.string().email().nullable().optional(),
  healthkitEnabled: z.boolean().optional(),
  iosIntegrationEnabled: z.boolean().optional(),
  adherenceGreenMinimum: z.number().int().min(1).max(7).optional(),
  adherenceAmberMinimum: z.number().int().min(0).max(6).optional(),
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

    try {
      // Try to get or create settings
      let settings = await db.systemSettings.findFirst()

      if (!settings) {
        settings = await db.systemSettings.create({
          data: DEFAULT_SETTINGS,
        })
      }

      return NextResponse.json({ data: settings }, { status: 200 })
    } catch (dbError: any) {
      // If database schema is incomplete, return defaults with helpful error
      console.error("Database error fetching settings:", dbError?.message)
      
      // Return defaults if we can't fetch from DB (likely schema mismatch)
      // This allows the UI to load while migrations are pending
      return NextResponse.json({ 
        data: DEFAULT_SETTINGS,
        warning: "Using default settings - database may need migration"
      }, { status: 200 })
    }
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
    const {
      maxClientsPerCoach,
      minClientsPerCoach,
      adherenceGreenMinimum,
      adherenceAmberMinimum,
    } = validationResult.data
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

    if (
      adherenceGreenMinimum !== undefined &&
      adherenceAmberMinimum !== undefined &&
      adherenceAmberMinimum >= adherenceGreenMinimum
    ) {
      return NextResponse.json(
        { error: "adherenceAmberMinimum must be less than adherenceGreenMinimum" },
        { status: 400 }
      )
    }

    try {
      // Get existing settings or create new
      let settings = await db.systemSettings.findFirst()

      if (!settings) {
        settings = await db.systemSettings.create({
          data: {
            ...DEFAULT_SETTINGS,
            ...validationResult.data,
            maxClientsPerCoach: maxClientsPerCoach ?? DEFAULT_SETTINGS.maxClientsPerCoach,
            minClientsPerCoach: minClientsPerCoach ?? DEFAULT_SETTINGS.minClientsPerCoach,
            recentActivityDays: validationResult.data.recentActivityDays ?? DEFAULT_SETTINGS.recentActivityDays,
            lowEngagementEntries: validationResult.data.lowEngagementEntries ?? DEFAULT_SETTINGS.lowEngagementEntries,
            noActivityDays: validationResult.data.noActivityDays ?? DEFAULT_SETTINGS.noActivityDays,
            criticalNoActivityDays:
              validationResult.data.criticalNoActivityDays ?? DEFAULT_SETTINGS.criticalNoActivityDays,
            shortTermWindowDays: validationResult.data.shortTermWindowDays ?? DEFAULT_SETTINGS.shortTermWindowDays,
            longTermWindowDays: validationResult.data.longTermWindowDays ?? DEFAULT_SETTINGS.longTermWindowDays,
            adminOverrideEmail: validationResult.data.adminOverrideEmail ?? DEFAULT_SETTINGS.adminOverrideEmail,
            healthkitEnabled: validationResult.data.healthkitEnabled ?? DEFAULT_SETTINGS.healthkitEnabled,
            iosIntegrationEnabled: validationResult.data.iosIntegrationEnabled ?? DEFAULT_SETTINGS.iosIntegrationEnabled,
            adherenceGreenMinimum: validationResult.data.adherenceGreenMinimum ?? DEFAULT_SETTINGS.adherenceGreenMinimum,
            adherenceAmberMinimum: validationResult.data.adherenceAmberMinimum ?? DEFAULT_SETTINGS.adherenceAmberMinimum,
          },
        })
      } else {
        settings = await db.systemSettings.update({
          where: { id: settings.id },
          data: validationResult.data,
        })
      }

      return NextResponse.json({ data: settings }, { status: 200 })
    } catch (dbError: any) {
      // If database schema is incomplete, return what we can with a warning
      console.error("Database error updating settings:", dbError?.message)
      
      // Return merged defaults + valid data
      const merged = { ...DEFAULT_SETTINGS, ...validationResult.data }
      return NextResponse.json({ 
        data: merged,
        warning: "Settings not persisted - database may need migration"
      }, { status: 200 })
    }
  } catch (error) {
    console.error("Error updating system settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
