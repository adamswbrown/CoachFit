/**
 * Weekly Questionnaire Reminders Cron Endpoint
 *
 * This endpoint should be called every Sunday at 9 AM UTC.
 * It sends reminders to users who have pending questionnaires for the current week.
 *
 * Schedule: Every Sunday at 9 AM UTC
 * Vercel cron: "0 9 * * 0"
 *
 * Security: Uses CRON_SECRET environment variable for authentication
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  sendWeeklyQuestionnaireReminder,
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

/**
 * Calculate the current week number for a cohort based on its start date
 */
function getCohortWeekNumber(cohortStartDate: Date): number {
  const now = new Date()
  const startDate = new Date(cohortStartDate)
  startDate.setHours(0, 0, 0, 0)

  const diffTime = now.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1

  return Math.max(1, weekNumber)
}

export async function GET(request: NextRequest) {
  // Verify cron authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const today = new Date()

  // Only run on Sundays (unless in development mode)
  if (process.env.NODE_ENV !== "development" && today.getDay() !== 0) {
    return NextResponse.json({
      success: true,
      message: "Skipped - not Sunday",
    })
  }

  console.log("[Cron] Weekly questionnaire reminders starting")

  try {
    // Get all active cohorts with questionnaire bundles
    const cohortsWithQuestionnaires = await db.cohort.findMany({
      where: {
        cohortStartDate: { not: null },
        questionnaireBundle: { isNot: null },
      },
      include: {
        memberships: {
          include: {
            user: {
              include: {
                UserPreference: true,
              },
            },
          },
        },
        questionnaireBundle: true,
        weeklyQuestionnaireResponses: true,
      },
    })

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const cohort of cohortsWithQuestionnaires) {
      if (!cohort.cohortStartDate) continue

      const currentWeek = getCohortWeekNumber(cohort.cohortStartDate)

      // Get users in this cohort who haven't completed the questionnaire for this week
      for (const membership of cohort.memberships) {
        const user = membership.user
        const userId = user.id

        // Check if user has weekly reminder enabled
        if (!user.UserPreference?.weeklyReminderEnabled) {
          skipped++
          continue
        }

        // Check if user already completed this week's questionnaire
        const existingResponse = cohort.weeklyQuestionnaireResponses.find(
          (r) => r.userId === userId && r.weekNumber === currentWeek && r.status === "completed"
        )

        if (existingResponse) {
          skipped++
          continue
        }

        // Check if reminder was already sent today
        const alreadySent = await wasNotificationSentToday(userId, "weekly_questionnaire")
        if (alreadySent) {
          skipped++
          continue
        }

        // Send reminder
        try {
          const success = await sendWeeklyQuestionnaireReminder(userId, cohort.id, currentWeek)
          if (success) {
            sent++
          } else {
            failed++
          }
        } catch (error) {
          console.error(`[Cron] Error sending questionnaire reminder to ${userId}:`, error)
          failed++
        }
      }
    }

    const duration = Date.now() - startTime

    console.log(`[Cron] Weekly questionnaire reminders completed: sent=${sent}, skipped=${skipped}, failed=${failed}, duration=${duration}ms`)

    return NextResponse.json({
      success: true,
      stats: {
        cohortsProcessed: cohortsWithQuestionnaires.length,
        sent,
        skipped,
        failed,
        durationMs: duration,
      },
    })
  } catch (error) {
    console.error("[Cron] Weekly questionnaire reminders error:", error)
    return NextResponse.json(
      { error: "Failed to send questionnaire reminders" },
      { status: 500 }
    )
  }
}

export const runtime = "nodejs"
export const maxDuration = 60
