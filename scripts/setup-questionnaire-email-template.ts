import { db } from "../lib/db"

async function setupQuestionnaireEmailTemplate() {
  console.log("🚀 Setting up Weekly Questionnaire Reminder email template...\n")

  try {
    // Check if template already exists
    const existing = await db.emailTemplate.findUnique({
      where: { key: "weekly_questionnaire_reminder" },
    })

    if (existing) {
      console.log("⚠️  Template already exists. Updating...\n")
      
      await db.emailTemplate.update({
        where: { key: "weekly_questionnaire_reminder" },
        data: {
          name: "Weekly Questionnaire Reminder",
          description: "Reminder email sent to clients who haven't completed their weekly questionnaire",
          subjectTemplate: "Reminder: Complete Week {{weekNumber}} Questionnaire",
          bodyTemplate: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9fafb; padding: 30px; }
    .button { background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Week {{weekNumber}} Check-In Reminder</h1>
    </div>
    <div class="content">
      <p>Hi {{clientName}},</p>
      
      <p>This is a friendly reminder from {{coachName}} to complete your Week {{weekNumber}} questionnaire for <strong>{{cohortName}}</strong>.</p>
      
      <p>Your weekly questionnaire helps your coach understand your progress, challenges, and wins so they can provide you with the best support possible.</p>
      
      <p>It only takes a few minutes to complete:</p>
      
      <div style="text-align: center;">
        <a href="{{questionnaireUrl}}" class="button">Complete Questionnaire</a>
      </div>
      
      <p>If you've already started your questionnaire, don't worry - your progress is saved! Just click the link above to continue where you left off.</p>
      
      <p>Thanks for staying committed to your goals!</p>
      
      <p>Best,<br>{{coachName}}</p>
    </div>
    <div class="footer">
      <p>This email was sent by your coach via CoachFit.</p>
    </div>
  </div>
</body>
</html>
          `.trim(),
          textTemplate: `Hi {{clientName}},

This is a friendly reminder from {{coachName}} to complete your Week {{weekNumber}} questionnaire for {{cohortName}}.

Your weekly questionnaire helps your coach understand your progress, challenges, and wins so they can provide you with the best support possible.

Complete your questionnaire here: {{questionnaireUrl}}

If you've already started your questionnaire, don't worry - your progress is saved! Just use the link above to continue where you left off.

Thanks for staying committed to your goals!

Best,
{{coachName}}

---
This email was sent by your coach via CoachFit.`,
          enabled: true,
          updatedAt: new Date(),
        },
      })

      console.log("✅ Template updated successfully!")
    } else {
      await db.emailTemplate.create({
        data: {
          key: "weekly_questionnaire_reminder",
          name: "Weekly Questionnaire Reminder",
          description: "Reminder email sent to clients who haven't completed their weekly questionnaire",
          subjectTemplate: "Reminder: Complete Week {{weekNumber}} Questionnaire",
          bodyTemplate: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9fafb; padding: 30px; }
    .button { background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Week {{weekNumber}} Check-In Reminder</h1>
    </div>
    <div class="content">
      <p>Hi {{clientName}},</p>
      
      <p>This is a friendly reminder from {{coachName}} to complete your Week {{weekNumber}} questionnaire for <strong>{{cohortName}}</strong>.</p>
      
      <p>Your weekly questionnaire helps your coach understand your progress, challenges, and wins so they can provide you with the best support possible.</p>
      
      <p>It only takes a few minutes to complete:</p>
      
      <div style="text-align: center;">
        <a href="{{questionnaireUrl}}" class="button">Complete Questionnaire</a>
      </div>
      
      <p>If you've already started your questionnaire, don't worry - your progress is saved! Just click the link above to continue where you left off.</p>
      
      <p>Thanks for staying committed to your goals!</p>
      
      <p>Best,<br>{{coachName}}</p>
    </div>
    <div class="footer">
      <p>This email was sent by your coach via CoachFit.</p>
    </div>
  </div>
</body>
</html>
          `.trim(),
          textTemplate: `Hi {{clientName}},

This is a friendly reminder from {{coachName}} to complete your Week {{weekNumber}} questionnaire for {{cohortName}}.

Your weekly questionnaire helps your coach understand your progress, challenges, and wins so they can provide you with the best support possible.

Complete your questionnaire here: {{questionnaireUrl}}

If you've already started your questionnaire, don't worry - your progress is saved! Just use the link above to continue where you left off.

Thanks for staying committed to your goals!

Best,
{{coachName}}

---
This email was sent by your coach via CoachFit.`,
          enabled: true,
        },
      })

      console.log("✅ Template created successfully!")
    }

    console.log("\n📧 Weekly Questionnaire Reminder template is now available for use.")
    console.log("   Key: weekly_questionnaire_reminder")
    console.log("\nDone! ✨")
  } catch (error) {
    console.error("❌ Error setting up template:", error)
    process.exit(1)
  }
}

setupQuestionnaireEmailTemplate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
