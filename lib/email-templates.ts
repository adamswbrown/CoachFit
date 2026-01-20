import { db } from "./db"

// Define available tokens for each template
export const EMAIL_TEMPLATE_KEYS = {
  WELCOME_CLIENT: "welcome_client",
  WELCOME_COACH: "welcome_coach",
  COACH_INVITE: "coach_invite",
  COHORT_INVITE: "cohort_invite",
  PASSWORD_SET: "password_set",
  PASSWORD_RESET: "password_reset",
} as const

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[keyof typeof EMAIL_TEMPLATE_KEYS]

// Token whitelist for security - only these can be substituted
const TOKEN_WHITELIST = [
  "userName",
  "userEmail",
  "coachName",
  "coachEmail",
  "cohortName",
  "loginUrl",
  "appName",
] as const

export type EmailToken = (typeof TOKEN_WHITELIST)[number]

export interface EmailVariables {
  userName?: string
  userEmail?: string
  coachName?: string
  coachEmail?: string
  cohortName?: string
  loginUrl?: string
  appName?: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/**
 * Escapes HTML to prevent XSS attacks
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Substitutes tokens in a template string with provided variables
 * Tokens are in the format {{tokenName}}
 * Only whitelisted tokens are replaced
 * HTML-escapes values for security
 */
function substituteTokens(
  template: string,
  variables: EmailVariables,
  escapeValues = true
): string {
  let result = template

  // Replace each whitelisted token
  TOKEN_WHITELIST.forEach((token) => {
    const value = variables[token]
    if (value !== undefined && value !== null) {
      const escapedValue = escapeValues ? escapeHtml(value) : value
      const regex = new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, "g")
      result = result.replace(regex, escapedValue)
    }
  })

  // Remove any remaining tokens that weren't substituted
  result = result.replace(/\{\{\s*\w+\s*\}\}/g, "")

  return result
}

/**
 * Renders an email template with the provided variables
 * Falls back to inline default if template not found or disabled
 */
export async function renderEmailTemplate(
  key: EmailTemplateKey,
  variables: EmailVariables
): Promise<RenderedEmail | null> {
  try {
    // Fetch template from database
    const template = await db.emailTemplate.findUnique({
      where: { key },
    })

    // If template exists and is enabled, use it
    if (template && template.enabled) {
      return {
        subject: substituteTokens(template.subjectTemplate, variables),
        html: substituteTokens(template.bodyTemplate, variables),
        text: substituteTokens(template.textTemplate, variables),
      }
    }

    // Template not found or disabled - return null to trigger fallback
    return null
  } catch (error) {
    console.error(`Error rendering email template ${key}:`, error)
    return null
  }
}

/**
 * Get all email templates for admin UI
 */
export async function getAllEmailTemplates() {
  return db.emailTemplate.findMany({
    orderBy: { name: "asc" },
  })
}

/**
 * Get a single email template by key
 */
export async function getEmailTemplate(key: string) {
  return db.emailTemplate.findUnique({
    where: { key },
  })
}

/**
 * Update an email template
 */
export async function updateEmailTemplate(
  key: string,
  data: {
    name?: string
    description?: string
    subjectTemplate?: string
    bodyTemplate?: string
    textTemplate?: string
    enabled?: boolean
  }
) {
  return db.emailTemplate.update({
    where: { key },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  })
}

/**
 * Reset a template to its default content
 * This would require storing defaults somewhere - for now just enable it
 */
export async function resetEmailTemplate(key: string) {
  // This is a placeholder - in a real implementation you'd reload from seed data
  return db.emailTemplate.update({
    where: { key },
    data: {
      enabled: true,
      updatedAt: new Date(),
    },
  })
}

/**
 * Preview a template with mock data
 */
export function previewEmailTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  textTemplate: string,
  mockVariables: EmailVariables
): RenderedEmail {
  return {
    subject: substituteTokens(subjectTemplate, mockVariables),
    html: substituteTokens(bodyTemplate, mockVariables),
    text: substituteTokens(textTemplate, mockVariables),
  }
}
