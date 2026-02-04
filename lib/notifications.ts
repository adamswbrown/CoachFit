/**
 * Notification Service for CoachFit
 * Handles both Web Push notifications and Email notifications
 */

import webpush from "web-push"
import { db } from "./db"
import { sendTransactionalEmail } from "./email"
import { EMAIL_TEMPLATE_KEYS, renderEmailTemplate } from "./email-templates"

// Types
export type NotificationType =
  | "daily_reminder"
  | "weekly_questionnaire"
  | "missed_entry"
  | "missed_questionnaire"
  | "coach_note"

export type NotificationChannel = "push" | "email"

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: {
    url?: string
    type?: NotificationType
    [key: string]: unknown
  }
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

/**
 * Safely strip HTML tags from a string.
 * Uses repeated replacement to handle nested/malformed tags like <scr<script>ipt>
 */
function stripHtmlTags(html: string): string {
  let result = html
  let previous = ""
  // Repeat until no more changes (handles nested malicious tags)
  while (result !== previous) {
    previous = result
    result = result.replace(/<[^>]*>/g, "")
  }
  return result.trim()
}

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:notifications@coachfit.app"

let webPushConfigured = false

function configureWebPush() {
  if (webPushConfigured) return true
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Notifications] VAPID keys not configured - push notifications disabled")
    return false
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  webPushConfigured = true
  return true
}

// Daily reminder time mapping
const REMINDER_TIMES: Record<string, number> = {
  morning: 8,    // 8:00 AM
  afternoon: 14, // 2:00 PM
  evening: 18,   // 6:00 PM
}

export function getReminderHour(timePreference: string): number {
  return REMINDER_TIMES[timePreference] || REMINDER_TIMES.morning
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!configureWebPush()) {
    return { success: false, sent: 0, failed: 0 }
  }

  // Get user's push subscriptions
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
  })

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  // Default notification options
  const notificationPayload = {
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/badge-72x72.png",
    tag: payload.tag || payload.data?.type || "coachfit-notification",
    data: {
      url: payload.data?.url || "/client-dashboard",
      ...payload.data,
    },
    actions: payload.actions,
  }

  // Send to all subscriptions
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(notificationPayload)
      )
      sent++
    } catch (error: unknown) {
      const webPushError = error as { statusCode?: number }
      console.error(`[Notifications] Push failed for subscription ${subscription.id}:`, error)

      // Remove invalid subscriptions (410 Gone or 404 Not Found)
      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        await db.pushSubscription.delete({
          where: { id: subscription.id },
        })
        console.log(`[Notifications] Removed expired subscription ${subscription.id}`)
      }
      failed++
    }
  }

  return { success: sent > 0 || failed === 0, sent, failed }
}

/**
 * Log a notification that was sent
 */
export async function logNotification(
  userId: string,
  type: NotificationType,
  channel: NotificationChannel,
  title: string,
  body: string,
  status: "sent" | "failed" = "sent",
  metadata?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    await db.notificationLog.create({
      data: {
        userId,
        type,
        channel,
        title,
        body,
        status,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        errorMessage,
      },
    })
  } catch (error) {
    console.error("[Notifications] Failed to log notification:", error)
  }
}

/**
 * Send daily check-in reminder
 */
export async function sendDailyReminder(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      UserPreference: true,
    },
  })

  if (!user) return false

  const preferences = user.UserPreference
  if (!preferences?.dailyReminderEnabled) return false

  const title = "Time to log your daily stats"
  const body = "Track your progress by recording your weight, steps, and more."
  const url = "/client-dashboard"

  let success = false

  // Send push notification
  if (preferences.pushNotifications) {
    const pushResult = await sendPushNotification(userId, {
      title,
      body,
      data: { url, type: "daily_reminder" },
      actions: [
        { action: "log", title: "Log Now" },
        { action: "dismiss", title: "Later" },
      ],
    })
    if (pushResult.sent > 0) success = true

    await logNotification(userId, "daily_reminder", "push", title, body, pushResult.success ? "sent" : "failed")
  }

  // Send email notification
  if (preferences.emailNotifications) {
    const appUrl = process.env.NEXTAUTH_URL || "https://coachfit.app"
    const emailSent = await sendNotificationEmail(
      user.email,
      EMAIL_TEMPLATE_KEYS.DAILY_CHECKIN_REMINDER,
      {
        userName: user.name || "there",
        dashboardUrl: `${appUrl}/client-dashboard`,
        appName: "CoachFit",
        unsubscribeUrl: `${appUrl}/client-dashboard/settings`,
      },
      {
        subject: "Time to log your daily stats",
        fallbackHtml: `
          <h2>Hi ${user.name || "there"},</h2>
          <p>It's time to log your daily stats! Track your progress by recording your weight, steps, and more.</p>
          <p><a href="${appUrl}/client-dashboard" style="display: inline-block; padding: 12px 24px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 6px;">Log Now</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            <a href="${appUrl}/client-dashboard/settings">Manage notification preferences</a>
          </p>
        `,
      }
    )
    if (emailSent) success = true

    await logNotification(userId, "daily_reminder", "email", title, body, emailSent ? "sent" : "failed")
  }

  return success
}

/**
 * Send weekly questionnaire reminder (Sunday 9 AM)
 */
export async function sendWeeklyQuestionnaireReminder(userId: string, cohortId: string, weekNumber: number): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      UserPreference: true,
    },
  })

  if (!user) return false

  const preferences = user.UserPreference
  if (!preferences?.weeklyReminderEnabled) return false

  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    include: { User: true },
  })

  if (!cohort) return false

  const title = "Weekly questionnaire available"
  const body = `Week ${weekNumber} questionnaire is ready to fill out for ${cohort.name}.`
  const appUrl = process.env.NEXTAUTH_URL || "https://coachfit.app"
  const url = `/client-dashboard/questionnaire/${cohortId}?week=${weekNumber}`

  let success = false

  // Send push notification
  if (preferences.pushNotifications) {
    const pushResult = await sendPushNotification(userId, {
      title,
      body,
      data: { url, type: "weekly_questionnaire", cohortId, weekNumber },
      actions: [
        { action: "fill", title: "Fill Now" },
        { action: "dismiss", title: "Later" },
      ],
    })
    if (pushResult.sent > 0) success = true

    await logNotification(
      userId,
      "weekly_questionnaire",
      "push",
      title,
      body,
      pushResult.success ? "sent" : "failed",
      { cohortId, weekNumber }
    )
  }

  // Send email notification
  if (preferences.emailNotifications) {
    const emailSent = await sendNotificationEmail(
      user.email,
      EMAIL_TEMPLATE_KEYS.WEEKLY_QUESTIONNAIRE_REMINDER,
      {
        userName: user.name || "there",
        cohortName: cohort.name,
        coachName: cohort.User.name || "Your Coach",
        weekNumber: weekNumber.toString(),
        questionnaireUrl: `${appUrl}${url}`,
        appName: "CoachFit",
        unsubscribeUrl: `${appUrl}/client-dashboard/settings`,
      },
      {
        subject: `Week ${weekNumber} questionnaire ready - ${cohort.name}`,
        fallbackHtml: `
          <h2>Hi ${user.name || "there"},</h2>
          <p>Your Week ${weekNumber} questionnaire for <strong>${cohort.name}</strong> is ready to fill out.</p>
          <p>Your coach ${cohort.User.name || ""} is looking forward to your feedback!</p>
          <p><a href="${appUrl}${url}" style="display: inline-block; padding: 12px 24px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 6px;">Fill Questionnaire</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            <a href="${appUrl}/client-dashboard/settings">Manage notification preferences</a>
          </p>
        `,
      }
    )
    if (emailSent) success = true

    await logNotification(
      userId,
      "weekly_questionnaire",
      "email",
      title,
      body,
      emailSent ? "sent" : "failed",
      { cohortId, weekNumber }
    )
  }

  return success
}

/**
 * Send missed entry reminder
 */
export async function sendMissedEntryReminder(userId: string, missedDays: number, lastEntryDate: Date): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      UserPreference: true,
    },
  })

  if (!user) return false

  const preferences = user.UserPreference
  if (!preferences?.missedEntryReminder) return false

  const title = missedDays === 1 ? "You missed logging yesterday" : `You haven't logged in ${missedDays} days`
  const body = "Keep your streak going! Log your stats to stay on track."
  const appUrl = process.env.NEXTAUTH_URL || "https://coachfit.app"
  const url = "/client-dashboard"

  let success = false

  // Send push notification
  if (preferences.pushNotifications) {
    const pushResult = await sendPushNotification(userId, {
      title,
      body,
      data: { url, type: "missed_entry", missedDays },
      actions: [
        { action: "log", title: "Log Now" },
        { action: "dismiss", title: "Remind Later" },
      ],
    })
    if (pushResult.sent > 0) success = true

    await logNotification(
      userId,
      "missed_entry",
      "push",
      title,
      body,
      pushResult.success ? "sent" : "failed",
      { missedDays }
    )
  }

  // Send email notification
  if (preferences.emailNotifications) {
    const formattedDate = lastEntryDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })

    const emailSent = await sendNotificationEmail(
      user.email,
      EMAIL_TEMPLATE_KEYS.MISSED_ENTRY_REMINDER,
      {
        userName: user.name || "there",
        missedDays: missedDays.toString(),
        lastEntryDate: formattedDate,
        dashboardUrl: `${appUrl}/client-dashboard`,
        appName: "CoachFit",
        unsubscribeUrl: `${appUrl}/client-dashboard/settings`,
      },
      {
        subject: missedDays === 1 ? "You missed logging yesterday" : `You haven't logged in ${missedDays} days`,
        fallbackHtml: `
          <h2>Hi ${user.name || "there"},</h2>
          <p>${missedDays === 1 ? "You missed logging yesterday." : `You haven't logged your stats in ${missedDays} days.`}</p>
          <p>Your last entry was on ${formattedDate}. Keep your momentum going!</p>
          <p><a href="${appUrl}/client-dashboard" style="display: inline-block; padding: 12px 24px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 6px;">Log Now</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            <a href="${appUrl}/client-dashboard/settings">Manage notification preferences</a>
          </p>
        `,
      }
    )
    if (emailSent) success = true

    await logNotification(
      userId,
      "missed_entry",
      "email",
      title,
      body,
      emailSent ? "sent" : "failed",
      { missedDays }
    )
  }

  return success
}

/**
 * Send missed questionnaire reminder
 */
export async function sendMissedQuestionnaireReminder(
  userId: string,
  cohortId: string,
  weekNumber: number
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      UserPreference: true,
    },
  })

  if (!user) return false

  const preferences = user.UserPreference
  if (!preferences?.missedQuestionnaireReminder) return false

  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    include: { User: true },
  })

  if (!cohort) return false

  const title = "Don't forget your questionnaire"
  const body = `Your Week ${weekNumber} questionnaire for ${cohort.name} is still pending.`
  const appUrl = process.env.NEXTAUTH_URL || "https://coachfit.app"
  const url = `/client-dashboard/questionnaire/${cohortId}?week=${weekNumber}`

  let success = false

  // Send push notification
  if (preferences.pushNotifications) {
    const pushResult = await sendPushNotification(userId, {
      title,
      body,
      data: { url, type: "missed_questionnaire", cohortId, weekNumber },
      actions: [
        { action: "fill", title: "Fill Now" },
        { action: "dismiss", title: "Later" },
      ],
    })
    if (pushResult.sent > 0) success = true

    await logNotification(
      userId,
      "missed_questionnaire",
      "push",
      title,
      body,
      pushResult.success ? "sent" : "failed",
      { cohortId, weekNumber }
    )
  }

  // Send email notification
  if (preferences.emailNotifications) {
    const emailSent = await sendNotificationEmail(
      user.email,
      EMAIL_TEMPLATE_KEYS.MISSED_QUESTIONNAIRE_REMINDER,
      {
        userName: user.name || "there",
        cohortName: cohort.name,
        coachName: cohort.User.name || "Your Coach",
        weekNumber: weekNumber.toString(),
        questionnaireUrl: `${appUrl}${url}`,
        appName: "CoachFit",
        unsubscribeUrl: `${appUrl}/client-dashboard/settings`,
      },
      {
        subject: `Reminder: Week ${weekNumber} questionnaire pending - ${cohort.name}`,
        fallbackHtml: `
          <h2>Hi ${user.name || "there"},</h2>
          <p>Your Week ${weekNumber} questionnaire for <strong>${cohort.name}</strong> is still pending.</p>
          <p>Your coach ${cohort.User.name || ""} is waiting for your feedback to better support you!</p>
          <p><a href="${appUrl}${url}" style="display: inline-block; padding: 12px 24px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 6px;">Fill Questionnaire</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            <a href="${appUrl}/client-dashboard/settings">Manage notification preferences</a>
          </p>
        `,
      }
    )
    if (emailSent) success = true

    await logNotification(
      userId,
      "missed_questionnaire",
      "email",
      title,
      body,
      emailSent ? "sent" : "failed",
      { cohortId, weekNumber }
    )
  }

  return success
}

/**
 * Send coach note notification
 */
export async function sendCoachNoteNotification(
  userId: string,
  coachId: string,
  notePreview: string
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      UserPreference: true,
    },
  })

  if (!user) return false

  const preferences = user.UserPreference
  if (!preferences?.coachNoteNotification) return false

  const coach = await db.user.findUnique({
    where: { id: coachId },
  })

  if (!coach) return false

  const title = `${coach.name || "Your coach"} left you a note`
  const body = notePreview.length > 100 ? notePreview.substring(0, 100) + "..." : notePreview
  const appUrl = process.env.NEXTAUTH_URL || "https://coachfit.app"
  const url = "/client-dashboard"

  let success = false

  // Send push notification
  if (preferences.pushNotifications) {
    const pushResult = await sendPushNotification(userId, {
      title,
      body,
      data: { url, type: "coach_note", coachId },
      actions: [
        { action: "view", title: "View Note" },
        { action: "dismiss", title: "Later" },
      ],
    })
    if (pushResult.sent > 0) success = true

    await logNotification(
      userId,
      "coach_note",
      "push",
      title,
      body,
      pushResult.success ? "sent" : "failed",
      { coachId }
    )
  }

  // Send email notification
  if (preferences.emailNotifications) {
    const emailSent = await sendNotificationEmail(
      user.email,
      EMAIL_TEMPLATE_KEYS.COACH_NOTE_NOTIFICATION,
      {
        userName: user.name || "there",
        coachName: coach.name || "Your Coach",
        notePreview: notePreview,
        dashboardUrl: `${appUrl}/client-dashboard`,
        appName: "CoachFit",
        unsubscribeUrl: `${appUrl}/client-dashboard/settings`,
      },
      {
        subject: `${coach.name || "Your coach"} left you a note`,
        fallbackHtml: `
          <h2>Hi ${user.name || "there"},</h2>
          <p><strong>${coach.name || "Your coach"}</strong> left you a note:</p>
          <blockquote style="border-left: 4px solid #1E3A8A; padding-left: 16px; margin: 16px 0; color: #374151;">
            ${notePreview}
          </blockquote>
          <p><a href="${appUrl}/client-dashboard" style="display: inline-block; padding: 12px 24px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 6px;">View in Dashboard</a></p>
          <p style="color: #666; font-size: 12px; margin-top: 24px;">
            <a href="${appUrl}/client-dashboard/settings">Manage notification preferences</a>
          </p>
        `,
      }
    )
    if (emailSent) success = true

    await logNotification(
      userId,
      "coach_note",
      "email",
      title,
      body,
      emailSent ? "sent" : "failed",
      { coachId }
    )
  }

  return success
}

/**
 * Helper function to send notification emails with template fallback
 */
async function sendNotificationEmail(
  to: string,
  templateKey: string,
  variables: Record<string, string | undefined>,
  fallback: { subject: string; fallbackHtml: string }
): Promise<boolean> {
  try {
    // Try to render from template
    const rendered = await renderEmailTemplate(templateKey as any, variables as any)

    if (rendered) {
      const result = await sendTransactionalEmail({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
      return result.success
    }

    // Use fallback
    const result = await sendTransactionalEmail({
      to,
      subject: fallback.subject,
      html: fallback.fallbackHtml,
      text: stripHtmlTags(fallback.fallbackHtml),
    })
    return result.success
  } catch (error) {
    console.error("[Notifications] Failed to send email:", error)
    return false
  }
}

/**
 * Check if a notification was already sent today
 */
export async function wasNotificationSentToday(
  userId: string,
  type: NotificationType,
  channel?: NotificationChannel
): Promise<boolean> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const where: {
    userId: string
    type: string
    sentAt: { gte: Date }
    channel?: string
  } = {
    userId,
    type,
    sentAt: { gte: today },
  }

  if (channel) {
    where.channel = channel
  }

  const existing = await db.notificationLog.findFirst({ where })
  return !!existing
}

/**
 * Get users who should receive daily reminders at the current hour
 */
export async function getUsersForDailyReminder(hour: number): Promise<string[]> {
  // Map hour to time preference
  let timePreference: string
  if (hour >= 6 && hour < 12) {
    timePreference = "morning"
  } else if (hour >= 12 && hour < 17) {
    timePreference = "afternoon"
  } else {
    timePreference = "evening"
  }

  // Only match exact preference time
  const targetHour = REMINDER_TIMES[timePreference]
  if (hour !== targetHour) {
    return []
  }

  const users = await db.userPreference.findMany({
    where: {
      dailyReminderEnabled: true,
      dailyReminderTime: timePreference,
      OR: [
        { pushNotifications: true },
        { emailNotifications: true },
      ],
    },
    select: { userId: true },
  })

  return users.map((u) => u.userId)
}
