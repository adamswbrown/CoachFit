// Resend is disabled by default - must explicitly enable via RESEND_ENABLED=true
// This prevents accidental email sends during development/testing
const isResendEnabled = process.env.RESEND_ENABLED === "true" || process.env.RESEND_ENABLED === "1"

// Type for Resend to avoid importing it at module level
type ResendInstance = {
  emails: {
    send: (options: {
      from: string
      to: string[]
      subject: string
      html: string
      text?: string
    }) => Promise<any>
  }
}

// Lazy initialization with dynamic import - only load Resend when actually sending emails
// This prevents build-time errors when RESEND_API_KEY is not available
// Dynamic import ensures Resend module is not evaluated during build
async function getResend(): Promise<ResendInstance | null> {
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
  
  // Only import and create instance when we have a valid API key and Resend is enabled
  // Dynamic import prevents module evaluation during build
  try {
    // Check if we're in a build environment - skip Resend initialization during build
    // Vercel sets NODE_ENV=production during build, but we can also check for build-time indicators
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.VERCEL === "1") {
      // During Vercel build, don't try to import Resend
      // This prevents build errors when RESEND_API_KEY is not set
      return null
    }
    
    // Use dynamic import to prevent Resend from being loaded during build
    const resendModule = await import("resend")
    const Resend = resendModule.Resend || resendModule.default?.Resend || resendModule.default
    
    if (!Resend) {
      console.error("Resend class not found in module")
      return null
    }
    
    return new Resend(apiKey) as ResendInstance
  } catch (error: any) {
    // Silently fail during build - this is expected when RESEND_API_KEY is not set
    // The error message "Missing API key" indicates Resend is being initialized during build
    if (error?.message?.includes("Missing API key") || !apiKey) {
      // This is expected during build - return null silently
      return null
    }
    console.error("Failed to import Resend:", error)
    return null
  }
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
  // Use dynamic import to prevent build-time errors
  const resend = await getResend()
  
  if (!resend) {
    const reason = !isResendEnabled 
      ? "RESEND_ENABLED is not set to 'true'"
      : "RESEND_API_KEY is not configured"
    console.warn(`${reason}. Email not sent.`)
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
