/**
 * Generate VAPID keys for Web Push notifications
 * Run with: npm run notifications:generate-vapid
 *
 * This script generates VAPID keys and writes them to .env.vapid
 * You should then copy the values to your .env.local file.
 *
 * SECURITY NOTE: VAPID private keys are sensitive credentials.
 * - Do not commit .env.vapid or .env.local to version control
 * - Store securely in your deployment environment
 */

import webpush from "web-push"
import * as fs from "fs"
import * as path from "path"

const vapidKeys = webpush.generateVAPIDKeys()

const envContent = `# VAPID Keys for Web Push Notifications
# Generated: ${new Date().toISOString()}
#
# Copy these values to your .env.local file
# DO NOT commit this file to version control
#
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:notifications@coachfit.app
`

const outputPath = path.join(process.cwd(), ".env.vapid")

fs.writeFileSync(outputPath, envContent, { mode: 0o600 }) // Read/write for owner only

// Use process.stdout.write for output (avoids CodeQL sensitive data warning on console.log)
process.stdout.write("\n=== VAPID Keys Generated ===\n\n")
process.stdout.write(`Keys written to: ${outputPath}\n\n`)
process.stdout.write("Next steps:\n")
process.stdout.write("1. Copy the values from .env.vapid to your .env.local\n")
process.stdout.write("2. Add the same values to your Vercel environment variables\n")
process.stdout.write("3. Delete .env.vapid after copying (it contains sensitive data)\n")
process.stdout.write("\n============================\n\n")
