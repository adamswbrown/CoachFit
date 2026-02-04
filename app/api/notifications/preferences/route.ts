/**
 * Notification Preferences API
 * GET - Get user's notification preferences
 * PUT - Update user's notification preferences
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

// Validation schema for preferences update
const preferencesSchema = z.object({
  dailyReminderEnabled: z.boolean().optional(),
  dailyReminderTime: z.enum(["morning", "afternoon", "evening"]).optional(),
  weeklyReminderEnabled: z.boolean().optional(),
  missedEntryReminder: z.boolean().optional(),
  missedQuestionnaireReminder: z.boolean().optional(),
  coachNoteNotification: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
})

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get or create default preferences
    let preferences = await db.userPreference.findUnique({
      where: { userId: session.user.id },
    })

    if (!preferences) {
      preferences = await db.userPreference.create({
        data: { userId: session.user.id },
      })
    }

    // Get subscription count for UI display
    const subscriptionCount = await db.pushSubscription.count({
      where: { userId: session.user.id },
    })

    return NextResponse.json({
      preferences: {
        dailyReminderEnabled: preferences.dailyReminderEnabled,
        dailyReminderTime: preferences.dailyReminderTime,
        weeklyReminderEnabled: preferences.weeklyReminderEnabled,
        missedEntryReminder: preferences.missedEntryReminder,
        missedQuestionnaireReminder: preferences.missedQuestionnaireReminder,
        coachNoteNotification: preferences.coachNoteNotification,
        emailNotifications: preferences.emailNotifications,
        pushNotifications: preferences.pushNotifications,
      },
      subscriptionCount,
    })
  } catch (error) {
    console.error("[API] Get notification preferences error:", error)
    return NextResponse.json(
      { error: "Failed to get notification preferences" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = preferencesSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid preferences data", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const updateData = parsed.data

    // Upsert preferences
    const preferences = await db.userPreference.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
    })

    // If push notifications are disabled, remove all subscriptions
    if (updateData.pushNotifications === false) {
      await db.pushSubscription.deleteMany({
        where: { userId: session.user.id },
      })
    }

    return NextResponse.json({
      success: true,
      preferences: {
        dailyReminderEnabled: preferences.dailyReminderEnabled,
        dailyReminderTime: preferences.dailyReminderTime,
        weeklyReminderEnabled: preferences.weeklyReminderEnabled,
        missedEntryReminder: preferences.missedEntryReminder,
        missedQuestionnaireReminder: preferences.missedQuestionnaireReminder,
        coachNoteNotification: preferences.coachNoteNotification,
        emailNotifications: preferences.emailNotifications,
        pushNotifications: preferences.pushNotifications,
      },
    })
  } catch (error) {
    console.error("[API] Update notification preferences error:", error)
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 }
    )
  }
}
