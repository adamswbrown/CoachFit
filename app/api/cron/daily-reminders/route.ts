/**
 * Daily Reminders Cron Endpoint
 *
 * This endpoint should be called hourly by a cron job (e.g., Vercel Cron).
 * It sends daily check-in reminders to users based on their preferred time.
 *
 * Schedule: Run every hour at minute 0
 * Vercel cron: "0 * * * *"
 *
 * Security: Uses CRON_SECRET environment variable for authentication
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  sendDailyReminder,
  getUsersForDailyReminder,
  wasNotificationSentToday,
} from "@/lib/notifications"

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // If no secret configured, allow in development
  if (!cronSecret) {
    if (process.env.NODE_ENV === "development") {
      return true
    }
    console.warn("[Cron] CRON_SECRET not configured")
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  // Verify cron authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const currentHour = new Date().getUTCHours()

  console.log(`[Cron] Daily reminders starting at UTC hour ${currentHour}`)

  try {
    // Get users who should receive reminders at this hour
    const userIds = await getUsersForDailyReminder(currentHour)

    console.log(`[Cron] Found ${userIds.length} users for daily reminders`)

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const userId of userIds) {
      try {
        // Check if user already logged today
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const todayEntry = await db.entry.findFirst({
          where: {
            userId,
            date: { gte: today },
          },
        })

        if (todayEntry) {
          // User already logged today, skip reminder
          skipped++
          continue
        }

        // Check if reminder was already sent today
        const alreadySent = await wasNotificationSentToday(userId, "daily_reminder")
        if (alreadySent) {
          skipped++
          continue
        }

        // Send reminder
        const success = await sendDailyReminder(userId)
        if (success) {
          sent++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`[Cron] Error sending reminder to ${userId}:`, error)
        failed++
      }
    }

    const duration = Date.now() - startTime

    console.log(`[Cron] Daily reminders completed: sent=${sent}, skipped=${skipped}, failed=${failed}, duration=${duration}ms`)

    return NextResponse.json({
      success: true,
      stats: {
        hour: currentHour,
        totalUsers: userIds.length,
        sent,
        skipped,
        failed,
        durationMs: duration,
      },
    })
  } catch (error) {
    console.error("[Cron] Daily reminders error:", error)
    return NextResponse.json(
      { error: "Failed to send daily reminders" },
      { status: 500 }
    )
  }
}

// Vercel cron configuration
export const runtime = "nodejs"
export const maxDuration = 60 // 1 minute max
