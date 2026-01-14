import { Resend } from "resend"

// Lazy initialization to avoid build errors when RESEND_API_KEY is missing
let resend: Resend | null = null
function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text: string
  isTestUser?: boolean
}

export async function sendTransactionalEmail(
  options: SendEmailOptions
): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, text, isTestUser } = options

  try {
    // Suppress emails for test users - log to console instead
    if (isTestUser) {
      console.log("[TEST EMAIL - Not sent]", {
        to,
        subject,
        preview: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
      })
      return { success: true }
    }

    // If no API key is configured, log and return success (fail gracefully)
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Email not sent:", { to, subject })
      return { success: true } // Return success to not block user flows
    }

    const client = getResendClient()
    if (!client) {
      console.warn("Resend client not initialized. Email not sent:", { to, subject })
      return { success: true } // Return success to not block user flows
    }

    const result = await client.emails.send({
      from: "CoachFit <onboarding@resend.dev>", // Default Resend domain, should be updated to custom domain
      to,
      subject,
      html,
      text,
    })

    if (result.error) {
      console.error("Resend API error:", result.error)
      return { success: false, error: result.error.message || "Failed to send email" }
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error sending email:", error)
    return { success: false, error: error.message || "Failed to send email" }
  }
}
