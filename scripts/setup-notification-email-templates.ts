/**
 * Setup Notification Email Templates in Resend
 *
 * Creates email templates for:
 * - Daily check-in reminder
 * - Missed entry reminder
 * - Missed questionnaire reminder
 * - Coach note notification
 *
 * Run with: npm run notifications:setup-templates
 */

import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function setupNotificationTemplates() {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY environment variable is required")
    process.exit(1)
  }

  console.log("🔔 Setting up CoachFit notification email templates...\n")

  // ─────────────────────────────────────────────────────────
  // Template 1: Daily Check-in Reminder
  // ─────────────────────────────────────────────────────────
  console.log("📧 Creating daily-checkin-reminder template...")

  const dailyReminderTemplate = await resend.templates.create({
    name: "daily-checkin-reminder",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #1E3A8A; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Time to Log Your Stats</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi {{{NAME}}},</p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Track your progress by recording your weight, steps, and more. Consistent tracking helps you and your coach understand your journey.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{{DASHBOARD_URL}}}" style="display: inline-block; padding: 14px 32px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Log Now</a>
      </div>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        <a href="{{{UNSUBSCRIBE_URL}}}" style="color: #6b7280;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    variables: [
      { key: "NAME", type: "string", fallbackValue: "there" },
      { key: "DASHBOARD_URL", type: "string", fallbackValue: "https://coachfit.app/client-dashboard" },
      { key: "UNSUBSCRIBE_URL", type: "string", fallbackValue: "https://coachfit.app/client-dashboard/settings" },
    ],
  })

  if (dailyReminderTemplate.error) {
    console.error("❌ Failed to create daily-checkin-reminder template:", dailyReminderTemplate.error)
  } else {
    console.log("✅ daily-checkin-reminder template created")
    console.log(`   Template ID: ${dailyReminderTemplate.data?.id}`)
    await delay(600)
    await resend.templates.publish(dailyReminderTemplate.data!.id)
    console.log("✅ daily-checkin-reminder template published\n")
  }

  await delay(600)

  // ─────────────────────────────────────────────────────────
  // Template 2: Missed Entry Reminder
  // ─────────────────────────────────────────────────────────
  console.log("📧 Creating missed-entry-reminder template...")

  const missedEntryTemplate = await resend.templates.create({
    name: "missed-entry-reminder",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #f59e0b; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">We Noticed You Missed a Day</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi {{{NAME}}},</p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">You haven't logged your stats in <strong>{{{MISSED_DAYS}}} day(s)</strong>.</p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">Your last entry was on <strong>{{{LAST_ENTRY_DATE}}}</strong>.</p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Keep your momentum going - even a quick check-in helps!</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{{DASHBOARD_URL}}}" style="display: inline-block; padding: 14px 32px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Log Now</a>
      </div>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        <a href="{{{UNSUBSCRIBE_URL}}}" style="color: #6b7280;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    variables: [
      { key: "NAME", type: "string", fallbackValue: "there" },
      { key: "MISSED_DAYS", type: "string", fallbackValue: "1" },
      { key: "LAST_ENTRY_DATE", type: "string", fallbackValue: "yesterday" },
      { key: "DASHBOARD_URL", type: "string", fallbackValue: "https://coachfit.app/client-dashboard" },
      { key: "UNSUBSCRIBE_URL", type: "string", fallbackValue: "https://coachfit.app/client-dashboard/settings" },
    ],
  })

  if (missedEntryTemplate.error) {
    console.error("❌ Failed to create missed-entry-reminder template:", missedEntryTemplate.error)
  } else {
    console.log("✅ missed-entry-reminder template created")
    console.log(`   Template ID: ${missedEntryTemplate.data?.id}`)
    await delay(600)
    await resend.templates.publish(missedEntryTemplate.data!.id)
    console.log("✅ missed-entry-reminder template published\n")
  }

  await delay(600)

  // ─────────────────────────────────────────────────────────
  // Template 3: Missed Questionnaire Reminder
  // ─────────────────────────────────────────────────────────
  console.log("📧 Creating missed-questionnaire-reminder template...")

  const missedQuestionnaireTemplate = await resend.templates.create({
    name: "missed-questionnaire-reminder",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #7c3aed; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Questionnaire Reminder</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi {{{NAME}}},</p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Your <strong>Week {{{WEEK_NUMBER}}}</strong> questionnaire for <strong>{{{COHORT_NAME}}}</strong> is still pending.</p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Your coach {{{COACH_NAME}}} is waiting for your feedback to better support you!</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{{QUESTIONNAIRE_URL}}}" style="display: inline-block; padding: 14px 32px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Fill Questionnaire</a>
      </div>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        <a href="{{{UNSUBSCRIBE_URL}}}" style="color: #6b7280;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    variables: [
      { key: "NAME", type: "string", fallbackValue: "there" },
      { key: "WEEK_NUMBER", type: "string", fallbackValue: "1" },
      { key: "COHORT_NAME", type: "string", fallbackValue: "Your Cohort" },
      { key: "COACH_NAME", type: "string", fallbackValue: "Your Coach" },
      { key: "QUESTIONNAIRE_URL", type: "string", fallbackValue: "https://coachfit.app/client-dashboard" },
      { key: "UNSUBSCRIBE_URL", type: "string", fallbackValue: "https://coachfit.app/client-dashboard/settings" },
    ],
  })

  if (missedQuestionnaireTemplate.error) {
    console.error("❌ Failed to create missed-questionnaire-reminder template:", missedQuestionnaireTemplate.error)
  } else {
    console.log("✅ missed-questionnaire-reminder template created")
    console.log(`   Template ID: ${missedQuestionnaireTemplate.data?.id}`)
    await delay(600)
    await resend.templates.publish(missedQuestionnaireTemplate.data!.id)
    console.log("✅ missed-questionnaire-reminder template published\n")
  }

  await delay(600)

  // ─────────────────────────────────────────────────────────
  // Template 4: Coach Note Notification
  // ─────────────────────────────────────────────────────────
  console.log("📧 Creating coach-note-notification template...")

  const coachNoteTemplate = await resend.templates.create({
    name: "coach-note-notification",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #059669; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">New Note from Your Coach</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi {{{NAME}}},</p>
      <p style="color: #374151; font-size: 16px; margin: 0 0 16px;"><strong>{{{COACH_NAME}}}</strong> left you a note:</p>
      <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #374151; font-size: 15px; margin: 0; line-height: 1.6;">{{{NOTE_PREVIEW}}}</p>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{{DASHBOARD_URL}}}" style="display: inline-block; padding: 14px 32px; background: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">View in Dashboard</a>
      </div>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        <a href="{{{UNSUBSCRIBE_URL}}}" style="color: #6b7280;">Manage notification preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    variables: [
      { key: "NAME", type: "string", fallbackValue: "there" },
      { key: "COACH_NAME", type: "string", fallbackValue: "Your Coach" },
      { key: "NOTE_PREVIEW", type: "string", fallbackValue: "Your coach left you feedback." },
      { key: "DASHBOARD_URL", type: "string", fallbackValue: "https://coachfit.app/client-dashboard" },
      { key: "UNSUBSCRIBE_URL", type: "string", fallbackValue: "https://coachfit.app/client-dashboard/settings" },
    ],
  })

  if (coachNoteTemplate.error) {
    console.error("❌ Failed to create coach-note-notification template:", coachNoteTemplate.error)
  } else {
    console.log("✅ coach-note-notification template created")
    console.log(`   Template ID: ${coachNoteTemplate.data?.id}`)
    await delay(600)
    await resend.templates.publish(coachNoteTemplate.data!.id)
    console.log("✅ coach-note-notification template published\n")
  }

  // ─────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════")
  console.log("✅ Notification templates setup complete!")
  console.log("═══════════════════════════════════════════════════════")
  console.log("\nTemplate IDs:")
  if (dailyReminderTemplate.data?.id) console.log(`  daily-checkin-reminder:     ${dailyReminderTemplate.data.id}`)
  if (missedEntryTemplate.data?.id) console.log(`  missed-entry-reminder:      ${missedEntryTemplate.data.id}`)
  if (missedQuestionnaireTemplate.data?.id) console.log(`  missed-questionnaire:       ${missedQuestionnaireTemplate.data.id}`)
  if (coachNoteTemplate.data?.id) console.log(`  coach-note-notification:    ${coachNoteTemplate.data.id}`)
}

setupNotificationTemplates().catch((error) => {
  console.error("❌ Unexpected error:", error)
  process.exit(1)
})
