import dotenv from "dotenv"
dotenv.config({ path: ".env" })
dotenv.config({ path: ".env.local", override: true })

import { Resend } from "resend"

const WEBHOOK_ENDPOINT = "https://gcgyms.com/api/webhooks/resend"

const WEBHOOK_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.opened",
  "email.clicked",
] as const

async function setupResendWebhook() {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY environment variable is required")
    process.exit(1)
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  console.log("🚀 Setting up Resend webhook for email delivery tracking...\n")

  // ─────────────────────────────────────────────────────────
  // Check for existing webhooks
  // ─────────────────────────────────────────────────────────
  console.log("📋 Checking for existing webhooks...")

  const listResult = await resend.webhooks.list()

  if (listResult.error) {
    console.error("❌ Failed to list webhooks:", listResult.error)
    process.exit(1)
  }

  const existingWebhook = listResult.data?.data?.find(
    (wh) => wh.endpoint === WEBHOOK_ENDPOINT
  )

  if (existingWebhook) {
    console.log(`\n⚠️  Webhook already exists for ${WEBHOOK_ENDPOINT}`)
    console.log(`   ID:     ${existingWebhook.id}`)
    console.log(`   Status: ${existingWebhook.status}`)
    console.log(`   Events: ${existingWebhook.events?.join(", ") || "all"}`)
    console.log(`   Created: ${existingWebhook.created_at}`)

    // Retrieve the signing secret
    const getResult = await resend.webhooks.get(existingWebhook.id)
    if (getResult.data) {
      console.log("\n═══════════════════════════════════════════════════════")
      console.log("🔑 Webhook Signing Secret")
      console.log("═══════════════════════════════════════════════════════")
      console.log(`\n   ${(getResult.data as any).signing_secret}\n`)
      console.log("═══════════════════════════════════════════════════════")
      console.log("\n📝 Add this to your environment variables:")
      console.log(`   RESEND_WEBHOOK_SECRET=${(getResult.data as any).signing_secret}`)
      console.log("\n   In Vercel: Settings > Environment Variables > Add")
    } else {
      console.log("\n⚠️  Could not retrieve signing secret. Check the Resend dashboard.")
    }

    return
  }

  // ─────────────────────────────────────────────────────────
  // Create new webhook
  // ─────────────────────────────────────────────────────────
  console.log(`\n📡 Creating webhook endpoint: ${WEBHOOK_ENDPOINT}`)
  console.log(`   Events: ${WEBHOOK_EVENTS.join(", ")}`)

  const createResult = await resend.webhooks.create({
    endpoint: WEBHOOK_ENDPOINT,
    events: [...WEBHOOK_EVENTS],
  })

  if (createResult.error) {
    console.error("\n❌ Failed to create webhook:", createResult.error)
    process.exit(1)
  }

  const { id, signing_secret } = createResult.data!

  console.log("\n✅ Webhook created successfully!")
  console.log(`   ID: ${id}`)

  console.log("\n═══════════════════════════════════════════════════════")
  console.log("🔑 Webhook Signing Secret (SAVE THIS NOW)")
  console.log("═══════════════════════════════════════════════════════")
  console.log(`\n   ${signing_secret}\n`)
  console.log("═══════════════════════════════════════════════════════")

  console.log("\n📝 Next steps:")
  console.log("   1. Add to your .env.local:")
  console.log(`      RESEND_WEBHOOK_SECRET=${signing_secret}`)
  console.log("\n   2. Add to Vercel environment variables:")
  console.log("      Settings > Environment Variables > Add")
  console.log(`      Name:  RESEND_WEBHOOK_SECRET`)
  console.log(`      Value: ${signing_secret}`)
  console.log("\n   3. Redeploy to pick up the new environment variable")

  console.log("\n═══════════════════════════════════════════════════════")
  console.log("📋 Webhook Summary")
  console.log("═══════════════════════════════════════════════════════")
  console.log(`Endpoint: ${WEBHOOK_ENDPOINT}`)
  console.log(`ID:       ${id}`)
  console.log(`Events:   ${WEBHOOK_EVENTS.join(", ")}`)
  console.log("═══════════════════════════════════════════════════════\n")
}

setupResendWebhook().catch((err) => {
  console.error("❌ Unexpected error:", err)
  process.exit(1)
})
