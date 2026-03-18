import { PrismaClient } from "@prisma/client"
import { EMAIL_TEMPLATE_KEYS } from "../lib/email-templates"

const prisma = new PrismaClient()

const DEFAULT_TEMPLATES = [
  {
    key: EMAIL_TEMPLATE_KEYS.WELCOME_CLIENT,
    name: "Welcome Email - Client",
    description: "Sent when a new client signs up or is created via OAuth",
    subjectTemplate: "Welcome to CoachFit",
    bodyTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Welcome to CoachFit!</h2>
        <p>Hi {{userName}},</p>
        <p>Welcome to CoachFit! We're excited to have you on board.</p>
        <p>You're all set — your coach will guide you next.</p>
        <p style="margin-top: 24px;">
          <a
            href="{{loginUrl}}"
            style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"
          >
            Sign in to your dashboard
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you have any questions, please contact your coach.
        </p>
      </div>
    `,
    textTemplate: `Welcome to CoachFit!\n\nHi {{userName}},\n\nWelcome to CoachFit! We're excited to have you on board.\n\nYou're all set — your coach will guide you next.\n\nSign in to your dashboard: {{loginUrl}}\n\nIf you have any questions, please contact your coach.`,
    availableTokens: ["userName", "loginUrl"],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.WELCOME_COACH,
    name: "Welcome Email - Coach",
    description: "Sent when a new coach account is created by admin",
    subjectTemplate: "Welcome to CoachFit - Your Coach Account",
    bodyTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Welcome to CoachFit!</h2>
        <p>Hi {{userName}},</p>
        <p>Your coach account has been created. You can now log in and start managing your cohorts and clients.</p>
        <p><strong>Email:</strong> {{userEmail}}</p>
        <p><strong>Password:</strong> (the one provided by your administrator)</p>
        <p style="margin-top: 24px;">
          <a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Sign in to your dashboard
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you have any questions, please contact your administrator.
        </p>
      </div>
    `,
    textTemplate: `Welcome to CoachFit!\n\nHi {{userName}},\n\nYour coach account has been created.\n\nEmail: {{userEmail}}\nPassword: (the one provided by your administrator)\n\nSign in: {{loginUrl}}\n\nIf you have any questions, please contact your administrator.`,
    availableTokens: ["userName", "userEmail", "loginUrl"],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.COACH_INVITE,
    name: "Coach Invitation",
    description: "Sent when a coach invites a client (global invite)",
    subjectTemplate: "You've been invited to CoachFit",
    bodyTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">You've been invited to CoachFit</h2>
        <p>Hi there,</p>
        <p><strong>{{coachName}}</strong> has invited you to join CoachFit to track your fitness progress.</p>
        <p>Sign up to get started.</p>
        <p style="margin-top: 24px;">
          <a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Sign up to get started
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you have any questions, please contact your coach.
        </p>
      </div>
    `,
    textTemplate: `You've been invited to CoachFit\n\n{{coachName}} has invited you to join CoachFit to track your fitness progress.\n\nSign up to get started: {{loginUrl}}\n\nIf you have any questions, please contact your coach.`,
    availableTokens: ["coachName", "loginUrl"],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.COHORT_INVITE,
    name: "Cohort Invitation",
    description: "Sent when a client is invited to a specific cohort",
    subjectTemplate: "You've been invited to CoachFit",
    bodyTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">You've been invited to CoachFit</h2>
        <p>Hi there,</p>
        <p><strong>{{coachName}}</strong> has invited you to join the <strong>{{cohortName}}</strong> cohort.</p>
        <p>Sign up to get started and begin tracking your progress.</p>
        <p style="margin-top: 24px;">
          <a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Sign up to get started
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you have any questions, please contact your coach.
        </p>
      </div>
    `,
    textTemplate: `You've been invited to CoachFit\n\n{{coachName}} has invited you to join the {{cohortName}} cohort.\n\nSign up to get started: {{loginUrl}}\n\nIf you have any questions, please contact your coach.`,
    availableTokens: ["coachName", "cohortName", "loginUrl"],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PASSWORD_SET,
    name: "Password Set (First Time)",
    description: "Sent when admin sets a password for an OAuth-only user",
    subjectTemplate: "You Can Now Sign In with Email & Password",
    bodyTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">New Sign-In Option Available</h2>
        <p>Hi {{userName}},</p>
        <p>Good news! Your administrator has set up a password for your CoachFit account.</p>
        <p>You can now sign in using <strong>either</strong>:</p>
        <ul>
          <li>Your Google account (as before)</li>
          <li>Your email and new password</li>
        </ul>
        <p>Contact your administrator for your password, then sign in:</p>
        <p style="margin-top: 24px;">
          <a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Sign in
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you did not expect this, please contact your administrator.
        </p>
      </div>
    `,
    textTemplate: `New Sign-In Option Available\n\nHi {{userName}},\n\nGood news! Your administrator has set up a password for your CoachFit account.\n\nYou can now sign in using either:\n- Your Google account (as before)\n- Your email and new password\n\nContact your administrator for your password, then sign in: {{loginUrl}}\n\nIf you did not expect this, please contact your administrator.`,
    availableTokens: ["userName", "loginUrl"],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.PASSWORD_RESET,
    name: "Password Reset",
    description: "Sent when admin resets a user's existing password",
    subjectTemplate: "Your CoachFit Password Has Been Reset",
    bodyTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Password Reset</h2>
        <p>Hi {{userName}},</p>
        <p>Your password has been reset by an administrator.</p>
        <p>Please contact your administrator for your new password, then sign in:</p>
        <p style="margin-top: 24px;">
          <a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Sign in
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you did not expect this, please contact your administrator immediately.
        </p>
      </div>
    `,
    textTemplate: `Password Reset\n\nHi {{userName}},\n\nYour password has been reset by an administrator.\n\nPlease contact your administrator for your new password, then sign in: {{loginUrl}}\n\nIf you did not expect this, please contact your administrator immediately.`,
    availableTokens: ["userName", "loginUrl"],
  },
  {
    key: EMAIL_TEMPLATE_KEYS.WEEKLY_QUESTIONNAIRE_REMINDER,
    name: "Weekly Questionnaire Reminder",
    description: "Sent to clients who haven't completed their weekly questionnaire",
    subjectTemplate: "Reminder: Complete Week {{weekNumber}} Questionnaire",
    bodyTemplate: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Weekly Questionnaire Reminder</h2>
        <p>Hi {{clientName}},</p>
        <p>This is a friendly reminder from <strong>{{coachName}}</strong> to complete your <strong>Week {{weekNumber}}</strong> questionnaire for <strong>{{cohortName}}</strong>.</p>
        <p>Your weekly questionnaire helps your coach understand your progress, challenges, and wins.</p>
        <p style="margin-top: 24px;">
          <a href="{{questionnaireUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Complete Questionnaire
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          Best,<br>{{coachName}}
        </p>
      </div>
    `,
    textTemplate: `Weekly Questionnaire Reminder\n\nHi {{clientName}},\n\nThis is a friendly reminder from {{coachName}} to complete your Week {{weekNumber}} questionnaire for {{cohortName}}.\n\nYour weekly questionnaire helps your coach understand your progress, challenges, and wins.\n\nComplete your questionnaire here: {{questionnaireUrl}}\n\nBest,\n{{coachName}}`,
    availableTokens: ["clientName", "coachName", "weekNumber", "cohortName", "questionnaireUrl"],
  },
]

async function seedEmailTemplates() {
  console.log("Seeding email templates...")

  for (const template of DEFAULT_TEMPLATES) {
    try {
      await prisma.emailTemplate.upsert({
        where: { key: template.key },
        update: {
          // Only update metadata, not the content (preserve customizations)
          name: template.name,
          description: template.description,
          availableTokens: template.availableTokens,
        },
        create: {
          ...template,
          isSystem: true,
          enabled: true,
        },
      })
      console.log(`✓ Seeded template: ${template.name}`)
    } catch (error) {
      console.error(`✗ Failed to seed template ${template.name}:`, error)
    }
  }

  console.log("Email templates seeding complete!")
}

// Run if called directly
if (require.main === module) {
  seedEmailTemplates()
    .then(() => {
      console.log("Done!")
    })
    .catch((error) => {
      console.error("Error:", error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export { seedEmailTemplates }
