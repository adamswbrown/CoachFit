import { Resend } from "resend"

// Resend is disabled by default - must explicitly enable via RESEND_ENABLED=true
// This prevents accidental email sends during development/testing
const isResendEnabled = process.env.RESEND_ENABLED === "true" || process.env.RESEND_ENABLED === "1"

// Lazy initialization - only create Resend instance when actually sending emails
// This prevents build-time errors when RESEND_API_KEY is not available
function getResend(): Resend | null {
  // If Resend is not explicitly enabled, don't create instance
  if (!isResendEnabled) {
    return null
  }
  
  const apiKey = process.env.RESEND_API_KEY
  
  // During build time or if API key is missing, return null
  // This allows the module to load without errors
  if (!apiKey) {
    return null
  }
  
  // Only create instance when we have a valid API key and Resend is enabled
  return new Resend(apiKey)
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  isTestUser?: boolean
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  isTestUser = false,
}: SendEmailOptions): Promise<void> {
  // Suppress emails for test users
  if (isTestUser) {
    console.log(`[Email suppressed for test user] To: ${to}, Subject: ${subject}`)
    return
  }

  // Check if Resend is enabled (disabled by default)
  if (!isResendEnabled) {
    console.log(`[Email disabled - set RESEND_ENABLED=true to enable] To: ${to}, Subject: ${subject}`)
    return
  }

  // Get Resend instance (only created if API key is available)
  const resend = getResend()
  
  if (!resend) {
    console.warn("RESEND_API_KEY is not configured. Email not sent.")
    console.log(`[Email would be sent] To: ${to}, Subject: ${subject}`)
    return
  }

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "CoachSync <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML tags for text version
    })
  } catch (error) {
    console.error("Error sending email:", error)
    // Don't throw - fail gracefully so the app continues to work
    // Log the error but don't break the user flow
  }
}
