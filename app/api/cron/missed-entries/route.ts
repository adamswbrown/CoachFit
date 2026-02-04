/**
 * Missed Entry Reminders Cron Endpoint
 *
 * This endpoint should be called daily (e.g., 10 AM UTC).
 * It sends reminders to users who have missed logging entries.
 *
 * Schedule: Daily at 10 AM UTC
 * Vercel cron: "0 10 * * *"
 *
 * Security: Uses CRON_SECRET environment variable for authentication
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  sendMissedEntryReminder,
  wasNotificationSentToday,
} from "@/lib/notifications"

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

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

  console.log("[Cron] Missed entry reminders starting")

  try {
    // Get users with missed entry reminders enabled
    const usersWithPreferences = await db.userPreference.findMany({
      where: {
        missedEntryReminder: true,
        OR: [{ pushNotifications: true }, { emailNotifications: true }],
      },
      include: {
        user: {
          include: {
            Entry: {
              orderBy: { date: "desc" },
              take: 1,
            },
          },
        },
      },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const { user, userId } of usersWithPreferences) {
      try {
        // Get the last entry date
        const lastEntry = user.Entry[0]

        if (!lastEntry) {
          // User never logged - only remind if they signed up more than a day ago
          const signupDate = new Date(user.createdAt)
          signupDate.setHours(0, 0, 0, 0)

          const daysSinceSignup = Math.floor(
            (today.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
          )

          if (daysSinceSignup < 1) {
            skipped++
            continue
          }

          // Check if reminder was already sent today
          const alreadySent = await wasNotificationSentToday(userId, "missed_entry")
          if (alreadySent) {
            skipped++
            continue
          }

          // Send reminder for new user who hasn't logged
          const success = await sendMissedEntryReminder(userId, daysSinceSignup, signupDate)
          if (success) {
            sent++
          } else {
            failed++
          }
          continue
        }

        // Calculate days since last entry
        const lastEntryDate = new Date(lastEntry.date)
        lastEntryDate.setHours(0, 0, 0, 0)

        const missedDays = Math.floor(
          (today.getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Only send reminder if they missed at least 1 day
        if (missedDays < 1) {
          skipped++
          continue
        }

        // Don't spam users who've been gone for too long (>14 days)
        if (missedDays > 14) {
          skipped++
          continue
        }

        // Check if reminder was already sent today
        const alreadySent = await wasNotificationSentToday(userId, "missed_entry")
        if (alreadySent) {
          skipped++
          continue
        }

        // Send reminder
        const success = await sendMissedEntryReminder(userId, missedDays, lastEntryDate)
        if (success) {
          sent++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`[Cron] Error processing missed entry for ${userId}:`, error)
        failed++
      }
    }

    const duration = Date.now() - startTime

    console.log(`[Cron] Missed entry reminders completed: sent=${sent}, skipped=${skipped}, failed=${failed}, duration=${duration}ms`)

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: usersWithPreferences.length,
        sent,
        skipped,
        failed,
        durationMs: duration,
      },
    })
  } catch (error) {
    console.error("[Cron] Missed entry reminders error:", error)
    return NextResponse.json(
      { error: "Failed to send missed entry reminders" },
      { status: 500 }
    )
  }
}

export const runtime = "nodejs"
export const maxDuration = 60
