import { Resend } from "resend"
import {
  renderEmailTemplate,
  type EmailTemplateKey,
  type EmailVariables,
} from "./email-templates"

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

export interface SendSystemEmailOptions {
  templateKey: EmailTemplateKey
  to: string
  variables: EmailVariables
  isTestUser?: boolean
  fallbackSubject?: string
  fallbackHtml?: string
  fallbackText?: string
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

    const from = process.env.EMAIL_FROM || "CoachFit <onboarding@resend.dev>"

    const result = await client.emails.send({
      from,
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

/**
 * Send a system email using templates from the database
 * Falls back to provided fallback content if template not found or disabled
 */
export async function sendSystemEmail(
  options: SendSystemEmailOptions
): Promise<{ success: boolean; error?: string }> {
  const {
    templateKey,
    to,
    variables,
    isTestUser,
    fallbackSubject,
    fallbackHtml,
    fallbackText,
  } = options

  try {
    // Try to render from template
    const rendered = await renderEmailTemplate(templateKey, variables)

    let subject: string
    let html: string
    let text: string

    if (rendered) {
      // Use template
      subject = rendered.subject
      html = rendered.html
      text = rendered.text
    } else {
      // Use fallback
      if (!fallbackSubject || !fallbackHtml || !fallbackText) {
        console.error(
          `Template ${templateKey} not found/disabled and no fallback provided`
        )
        return { success: false, error: "Email template not available" }
      }
      subject = fallbackSubject
      html = fallbackHtml
      text = fallbackText
      console.warn(`Using fallback for template ${templateKey}`)
    }

    // Send the email
    return sendTransactionalEmail({
      to,
      subject,
      html,
      text,
      isTestUser,
    })
  } catch (error: any) {
    console.error(`Error sending system email ${templateKey}:`, error)
    return { success: false, error: error.message || "Failed to send email" }
  }
}
