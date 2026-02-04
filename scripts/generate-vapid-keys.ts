/**
 * Generate VAPID keys for Web Push notifications
 * Run with: npx ts-node scripts/generate-vapid-keys.ts
 *
 * Add the generated keys to your .env.local file:
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public_key>
 * VAPID_PRIVATE_KEY=<private_key>
 * VAPID_SUBJECT=mailto:your-email@example.com
 */

import webpush from "web-push"

const vapidKeys = webpush.generateVAPIDKeys()

console.log("\n=== VAPID Keys Generated ===\n")
console.log("Add these to your .env.local file:\n")
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
console.log(`VAPID_SUBJECT=mailto:notifications@coachfit.app`)
console.log("\n============================\n")
