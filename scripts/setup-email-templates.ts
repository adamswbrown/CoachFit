import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function setupEmailTemplates() {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY environment variable is required")
    process.exit(1)
  }

  console.log("🚀 Setting up CoachFit email templates...\n")

  // ─────────────────────────────────────────────────────────
  // Template 1: Welcome Email
  // ─────────────────────────────────────────────────────────
  console.log("📧 Creating welcome-user template...")

  const welcomeTemplate = await resend.templates.create({
    name: "welcome-user",
    html: `<p>Hi {{{NAME}}},</p>
<p>Welcome to CoachFit.</p>
<p>You can now log in and start tracking your progress.</p>
<p>If you were invited by a coach, you'll automatically be connected when you sign in.</p>
<p>— CoachFit</p>`,
    variables: [
      {
        key: "NAME",
        type: "string",
        fallbackValue: "there",
      },
    ],
  })

  if (welcomeTemplate.error) {
    console.error("❌ Failed to create welcome-user template:", welcomeTemplate.error)
    process.exit(1)
  }

  console.log("✅ welcome-user template created")
  console.log(`   Template ID: ${welcomeTemplate.data?.id}`)

  // Wait to avoid rate limiting
  await delay(600)

  // Publish welcome template
  console.log("📤 Publishing welcome-user template...")
  const welcomePublish = await resend.templates.publish(welcomeTemplate.data!.id)

  if (welcomePublish.error) {
    console.error("❌ Failed to publish welcome-user template:", welcomePublish.error)
    process.exit(1)
  }

  console.log("✅ welcome-user template published\n")

  // Wait to avoid rate limiting (2 req/sec limit)
  await delay(600)

  // ─────────────────────────────────────────────────────────
  // Template 2: Cohort Invite Email
  // ─────────────────────────────────────────────────────────
  console.log("📧 Creating cohort-invite template...")

  const cohortInviteTemplate = await resend.templates.create({
    name: "cohort-invite",
    html: `<p>Hi,</p>
<p>You've been invited to CoachFit by your coach.</p>
<p>Create an account using this email address and you'll automatically be connected.</p>
<p><a href="{{{SIGNUP_URL}}}">Create your account</a></p>
<p>— CoachSync</p>`,
    variables: [
      {
        key: "SIGNUP_URL",
        type: "string",
        fallbackValue: "http://localhost:3000/signup",
      },
    ],
  })

  if (cohortInviteTemplate.error) {
    console.error("❌ Failed to create cohort-invite template:", cohortInviteTemplate.error)
    process.exit(1)
  }

  console.log("✅ cohort-invite template created")
  console.log(`   Template ID: ${cohortInviteTemplate.data?.id}`)

  // Wait to avoid rate limiting
  await delay(600)

  // Publish cohort-invite template
  console.log("📤 Publishing cohort-invite template...")
  const cohortPublish = await resend.templates.publish(cohortInviteTemplate.data!.id)

  if (cohortPublish.error) {
    console.error("❌ Failed to publish cohort-invite template:", cohortPublish.error)
    process.exit(1)
  }

  console.log("✅ cohort-invite template published\n")

  // ─────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════")
  console.log("✅ All templates created and published successfully!")
  console.log("═══════════════════════════════════════════════════════")
  console.log("\nTemplate IDs (save these for application integration):")
  console.log(`  welcome-user:   ${welcomeTemplate.data?.id}`)
  console.log(`  cohort-invite:  ${cohortInviteTemplate.data?.id}`)
  console.log("\nSubjects to use when sending (store in app):")
  console.log('  welcome-user:   "Welcome to CoachFit"')
  console.log('  cohort-invite:  "You\'ve been invited to CoachFit"')
}

setupEmailTemplates().catch((error) => {
  console.error("❌ Unexpected error:", error)
  process.exit(1)
})
