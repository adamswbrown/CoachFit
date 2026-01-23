import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "@/lib/legal-content"
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
  defaultCheckInFrequencyDays: 7,
  notificationTimeUtc: "09:00",
  adminOverrideEmail: null,
  healthkitEnabled: false,
  iosIntegrationEnabled: false,
  adherenceGreenMinimum: 7,
  adherenceAmberMinimum: 6,
  attentionMissedCheckinsPolicy: "option_a",
  bodyFatLowPercent: 12.5,
  bodyFatMediumPercent: 20.0,
  bodyFatHighPercent: 30.0,
  bodyFatVeryHighPercent: 37.5,
  minDailyCalories: 1000,
  maxDailyCalories: 5000,
  minProteinPerLb: 0.4,
  maxProteinPerLb: 2.0,
  defaultCarbsPercent: 40,
  defaultProteinPercent: 30,
  defaultFatPercent: 30,
  showPersonalizedPlan: true,
  termsContentHtml: DEFAULT_TERMS_HTML,
  privacyContentHtml: DEFAULT_PRIVACY_HTML,
  dataProcessingContentHtml: DEFAULT_DATA_PROCESSING_HTML,
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
  defaultCheckInFrequencyDays: z.number().int().min(1).max(365).optional(),
  notificationTimeUtc: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Use HH:mm in 24-hour UTC")
    .optional(),
  adminOverrideEmail: z.string().email().nullable().optional(),
  healthkitEnabled: z.boolean().optional(),
  iosIntegrationEnabled: z.boolean().optional(),
  adherenceGreenMinimum: z.number().int().min(1).max(7).optional(),
  adherenceAmberMinimum: z.number().int().min(0).max(6).optional(),
  attentionMissedCheckinsPolicy: z.enum(["option_a", "option_b"]).optional(),
  bodyFatLowPercent: z.number().min(5).max(30).optional(),
  bodyFatMediumPercent: z.number().min(10).max(40).optional(),
  bodyFatHighPercent: z.number().min(15).max(50).optional(),
  bodyFatVeryHighPercent: z.number().min(20).max(60).optional(),
  minDailyCalories: z.number().int().min(500).max(4000).optional(),
  maxDailyCalories: z.number().int().min(2000).max(8000).optional(),
  minProteinPerLb: z.number().min(0.2).max(1).optional(),
  maxProteinPerLb: z.number().min(1).max(3).optional(),
  defaultCarbsPercent: z.number().min(0).max(100).optional(),
  defaultProteinPercent: z.number().min(0).max(100).optional(),
  defaultFatPercent: z.number().min(0).max(100).optional(),
  showPersonalizedPlan: z.boolean().optional(),
  termsContentHtml: z.string().optional(),
  privacyContentHtml: z.string().optional(),
  dataProcessingContentHtml: z.string().optional(),
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
    const normalizeNotificationTimeUtc = (value?: string | null) => {
      if (!value) return value ?? null
      const trimmed = value.trim()
      const withoutSeconds = trimmed.length === 8 ? trimmed.slice(0, 5) : trimmed
      const parts = withoutSeconds.split(":")
      if (parts.length < 2) return withoutSeconds
      const hour = parts[0].padStart(2, "0")
      const minute = parts[1].padStart(2, "0")
      return `${hour}:${minute}`
    }

    const normalizedData = {
      ...validationResult.data,
      notificationTimeUtc: normalizeNotificationTimeUtc(validationResult.data.notificationTimeUtc),
    }

    const {
      maxClientsPerCoach,
      minClientsPerCoach,
      adherenceGreenMinimum,
      adherenceAmberMinimum,
      minDailyCalories,
      maxDailyCalories,
      minProteinPerLb,
      maxProteinPerLb,
      defaultCarbsPercent,
      defaultProteinPercent,
      defaultFatPercent,
    } = normalizedData
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
            recentActivityDays: normalizedData.recentActivityDays ?? DEFAULT_SETTINGS.recentActivityDays,
            lowEngagementEntries: normalizedData.lowEngagementEntries ?? DEFAULT_SETTINGS.lowEngagementEntries,
            noActivityDays: normalizedData.noActivityDays ?? DEFAULT_SETTINGS.noActivityDays,
            criticalNoActivityDays:
              normalizedData.criticalNoActivityDays ?? DEFAULT_SETTINGS.criticalNoActivityDays,
            shortTermWindowDays: normalizedData.shortTermWindowDays ?? DEFAULT_SETTINGS.shortTermWindowDays,
            longTermWindowDays: normalizedData.longTermWindowDays ?? DEFAULT_SETTINGS.longTermWindowDays,
            defaultCheckInFrequencyDays:
              normalizedData.defaultCheckInFrequencyDays ?? DEFAULT_SETTINGS.defaultCheckInFrequencyDays,
            notificationTimeUtc:
              normalizedData.notificationTimeUtc ?? DEFAULT_SETTINGS.notificationTimeUtc,
            adminOverrideEmail: normalizedData.adminOverrideEmail ?? DEFAULT_SETTINGS.adminOverrideEmail,
            healthkitEnabled: normalizedData.healthkitEnabled ?? DEFAULT_SETTINGS.healthkitEnabled,
            iosIntegrationEnabled: normalizedData.iosIntegrationEnabled ?? DEFAULT_SETTINGS.iosIntegrationEnabled,
            adherenceGreenMinimum: normalizedData.adherenceGreenMinimum ?? DEFAULT_SETTINGS.adherenceGreenMinimum,
            adherenceAmberMinimum: normalizedData.adherenceAmberMinimum ?? DEFAULT_SETTINGS.adherenceAmberMinimum,
            attentionMissedCheckinsPolicy:
              normalizedData.attentionMissedCheckinsPolicy ??
              DEFAULT_SETTINGS.attentionMissedCheckinsPolicy,
            minDailyCalories: normalizedData.minDailyCalories ?? DEFAULT_SETTINGS.minDailyCalories,
            maxDailyCalories: normalizedData.maxDailyCalories ?? DEFAULT_SETTINGS.maxDailyCalories,
            minProteinPerLb: normalizedData.minProteinPerLb ?? DEFAULT_SETTINGS.minProteinPerLb,
            maxProteinPerLb: normalizedData.maxProteinPerLb ?? DEFAULT_SETTINGS.maxProteinPerLb,
            defaultCarbsPercent: normalizedData.defaultCarbsPercent ?? DEFAULT_SETTINGS.defaultCarbsPercent,
            defaultProteinPercent: normalizedData.defaultProteinPercent ?? DEFAULT_SETTINGS.defaultProteinPercent,
            defaultFatPercent: normalizedData.defaultFatPercent ?? DEFAULT_SETTINGS.defaultFatPercent,
            showPersonalizedPlan: normalizedData.showPersonalizedPlan ?? DEFAULT_SETTINGS.showPersonalizedPlan,
            termsContentHtml: normalizedData.termsContentHtml ?? DEFAULT_SETTINGS.termsContentHtml,
            privacyContentHtml: normalizedData.privacyContentHtml ?? DEFAULT_SETTINGS.privacyContentHtml,
            dataProcessingContentHtml: normalizedData.dataProcessingContentHtml ?? DEFAULT_SETTINGS.dataProcessingContentHtml,
          },
        })
      } else {
        settings = await db.systemSettings.update({
          where: { id: settings.id },
          data: normalizedData,
        })
      }

      return NextResponse.json({ data: settings }, { status: 200 })
    } catch (dbError: any) {
      // If database schema is incomplete, return what we can with a warning
      console.error("Database error updating settings:", dbError?.message)
      
      // Return merged defaults + valid data
      const merged = { ...DEFAULT_SETTINGS, ...normalizedData }
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
