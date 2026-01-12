import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const AUDIENCE_NAME = "CoachSync Users"

async function setupBroadcastAudience() {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY environment variable is required")
    process.exit(1)
  }

  console.log("🚀 Setting up CoachSync broadcast audience...\n")

  // ─────────────────────────────────────────────────────────
  // Check if audience already exists
  // ─────────────────────────────────────────────────────────
  console.log("📋 Checking for existing audiences...")
  
  const audiencesResult = await resend.audiences.list()
  
  if (audiencesResult.error) {
    console.error("❌ Failed to list audiences:", audiencesResult.error)
    process.exit(1)
  }

  const existingAudience = audiencesResult.data?.data?.find(
    (a) => a.name === AUDIENCE_NAME
  )

  if (existingAudience) {
    console.log(`✅ Audience "${AUDIENCE_NAME}" already exists`)
    console.log(`   Audience ID: ${existingAudience.id}`)
    console.log("\n═══════════════════════════════════════════════════════")
    console.log("📋 Broadcast Audience Summary")
    console.log("═══════════════════════════════════════════════════════")
    console.log(`Audience Name: ${AUDIENCE_NAME}`)
    console.log(`Audience ID:   ${existingAudience.id}`)
    console.log("═══════════════════════════════════════════════════════\n")
    console.log("Save this Audience ID to use with broadcasts.")
    return
  }

  await delay(600)

  // ─────────────────────────────────────────────────────────
  // Create the audience
  // ─────────────────────────────────────────────────────────
  console.log(`\n📧 Creating audience: "${AUDIENCE_NAME}"...`)

  const createResult = await resend.audiences.create({
    name: AUDIENCE_NAME,
  })

  if (createResult.error) {
    console.error("❌ Failed to create audience:", createResult.error)
    process.exit(1)
  }

  console.log("✅ Audience created successfully!")
  console.log(`   Audience ID: ${createResult.data?.id}`)

  // ─────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════")
  console.log("📋 Broadcast Audience Summary")
  console.log("═══════════════════════════════════════════════════════")
  console.log(`Audience Name: ${AUDIENCE_NAME}`)
  console.log(`Audience ID:   ${createResult.data?.id}`)
  console.log("═══════════════════════════════════════════════════════\n")
  console.log("Save this Audience ID to use with broadcasts.")
  console.log("\nTo add contacts to this audience, use:")
  console.log("  resend.contacts.create({")
  console.log(`    audienceId: "${createResult.data?.id}",`)
  console.log('    email: "user@example.com",')
  console.log('    firstName: "John",')
  console.log('    lastName: "Doe",')
  console.log("  })")
}

setupBroadcastAudience().catch((error) => {
  console.error("❌ Unexpected error:", error)
  process.exit(1)
})
