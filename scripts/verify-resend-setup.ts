import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function verifyResendSetup() {
  if (!process.env.RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY environment variable is required")
    process.exit(1)
  }

  console.log("🔍 Verifying Resend setup for CoachSync...\n")

  // ─────────────────────────────────────────────────────────
  // 1. Verify API Key works by listing domains
  // ─────────────────────────────────────────────────────────
  console.log("1️⃣  Checking API key validity...")
  
  const domainsResult = await resend.domains.list()
  
  if (domainsResult.error) {
    console.error("❌ API key validation failed:", domainsResult.error)
    process.exit(1)
  }
  
  console.log("✅ API key is valid")
  
  if (domainsResult.data?.data && domainsResult.data.data.length > 0) {
    console.log("   Verified domains:")
    for (const domain of domainsResult.data.data) {
      console.log(`   - ${domain.name} (${domain.status})`)
    }
  } else {
    console.log("   ⚠️  No verified domains. Using resend.dev for now.")
  }
  
  await delay(600)

  // ─────────────────────────────────────────────────────────
  // 2. List existing templates
  // ─────────────────────────────────────────────────────────
  console.log("\n2️⃣  Checking email templates...")
  
  const templatesResult = await resend.templates.list()
  
  if (templatesResult.error) {
    console.error("❌ Failed to list templates:", templatesResult.error)
  } else if (templatesResult.data?.data && templatesResult.data.data.length > 0) {
    console.log("✅ Found templates:")
    for (const template of templatesResult.data.data) {
      console.log(`   - ${template.name} (ID: ${template.id})`)
    }
  } else {
    console.log("⚠️  No templates found. Run 'npm run email:setup-templates' to create them.")
  }
  
  await delay(600)

  // ─────────────────────────────────────────────────────────
  // 3. List existing audiences (for broadcasts)
  // ─────────────────────────────────────────────────────────
  console.log("\n3️⃣  Checking audiences for broadcasts...")
  
  const audiencesResult = await resend.audiences.list()
  
  if (audiencesResult.error) {
    console.error("❌ Failed to list audiences:", audiencesResult.error)
  } else if (audiencesResult.data?.data && audiencesResult.data.data.length > 0) {
    console.log("✅ Found audiences:")
    for (const audience of audiencesResult.data.data) {
      console.log(`   - ${audience.name} (ID: ${audience.id})`)
    }
  } else {
    console.log("ℹ️  No audiences found. These are needed for broadcasts.")
  }

  // ─────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════")
  console.log("📋 Resend Setup Summary")
  console.log("═══════════════════════════════════════════════════════")
  console.log("✅ API Key: Valid")
  console.log(`✅ Domains: ${domainsResult.data?.data?.length || 0} configured`)
  console.log(`✅ Templates: ${templatesResult.data?.data?.length || 0} available`)
  console.log(`✅ Audiences: ${audiencesResult.data?.data?.length || 0} configured`)
  console.log("═══════════════════════════════════════════════════════\n")
}

verifyResendSetup().catch((error) => {
  console.error("❌ Unexpected error:", error)
  process.exit(1)
})
